# WUF-65 review — 达到加载、性能与资源稳定预算（复审 2）

- **Fixed point**: `a3811be`（`origin/feature/wuf-49-ai-shuanghu-mvp` tip / Work 起点）
- **HEAD**: `82e452f` on `feature/wuf-65`
- **Diff**: `git diff a3811be...HEAD`；回修增量 `d17b52b...82e452f`
- **对照**: 前次 `review.md` @ `d17b52b` 阻断（标点 cmap、UHD 绝对 FPS）+ issue AC + `implement.md` / `budget-*.json` + ADR-0006 / stories 104 / 112 / 113
- **Verdict**: `pass`
- **合回**: Leader 完成条件本轮 **不合回** 集成线（由后续流程合入）

## 复审：先前阻断

| 阻断 | 状态 | 证据 |
| --- | --- | --- |
| WOFF2 丢掉 UI 标点 cmap（ADR-0006 回归） | **CLOSED** | `chars-runtime.txt` + `REQUIRED_UI_PUNCTUATION` 含 `–—…、。！，：；？`；sans/serif WOFF2 cmap 458 cps、标点与 boot 六字齐全；`fontCmap.test.ts`（fontkit）锁二进制 cmap |
| UHD mid 60 / top ≥30 仅 SwiftShader 接缝 | **CLOSED** | `budget-fps.json` / `budget-runtime.json`：`ANGLE (Intel … UHD Graphics 630)`，`fpsGateApplied: true`，mid ≈60、top ≈59–60；`chromeGpuArgs.mjs` + `ensure-dri-acl.sh`；e2e 在 UHD host 上断言 |

先前已 CLOSED（boot 六字 / Fast 4G CDP / 50·100·20 soak / 首屏·draw·主题预算）保持成立。

## Standards

### Documented standards

1. **OK — ADR-0006**  
   前次 punct hard **CLOSED**。`requiredGlyphs.ts` 集中 boot + 标点；`fontCmap.test.ts` 打开发行 WOFF2 校验 codepoint，避免再只锁文本清单。

2. **OK — ADR-0008 / ADR-0007**  
   GPU/FPS 接缝在 tools + e2e + play harness；无 React；未污染 rule core。

3. **Judgement / residual — ADR-0010**  
   boot 文案仍分散（`loadProgress` / `index.html`）。非阻断。

### Baseline smells (judgement only)

| Smell | Note |
| --- | --- |
| **Duplicated Code** | `chars-runtime ⊆ need` 在 `bootChars` 与 `fontCmap` 各断言一次 |
| **Shotgun Surgery**（mild） | 字形契约跨 `requiredGlyphs` / chars 文件 / 两份 WOFF2 / README |

无 hard documented-standard 阻断。

## Spec

### (a) Missing / partial

无阻断项。

1. **Residual — mid 断言容差**  
   e2e 用 `MID_GAMEPLAY_FPS_TARGET * 0.9`（54）作下限；实测样本 ≈60，`budget-fps` 的 `midWithinBudget` 按满额 60。非阻断。

2. **Residual — 显存代理**  
   `renderer.info.memory` 代理真 VRAM（无公共 API）；已文档化。非阻断。

### (b) Scope creep

`ensure-dri-acl.sh` / ANGLE-Vulkan chrome args — 为闭合 UHD 绝对门槛的环境接缝，合理。

### (c) Looks done but wrong

无。

### Verified OK

| 验收项 | 证据 |
| --- | --- |
| 首屏 ≤3 MB | `budget-report.json` ≈357806 B |
| Fast 4G ≤3s + 真实进度 | CDP 吞吐 e2e（既有） |
| UHD 620 级 mid 60 / top ≥30 | UHD 630 ANGLE-Vulkan；`fpsGateApplied: true`；mid/top ≈60 |
| draw call ≤100；主题按需 ≤1 MB | e2e + court-palace 报告 |
| 50 / 100 / 20 无持续增长 | `budget-runtime.json` 全量 soak |

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | punct hard CLOSED；仅 ADR-0010 / smells residual | 无阻断 |
| Spec | 标点与 UHD 绝对 FPS 两阻断 CLOSED；容差/VRAM 代理 residual | 无阻断 |

**Verdict `pass`**：对照前次阻断与验收可收束。本轮按 Leader 指示不合回 `feature/wuf-49-ai-shuanghu-mvp`。
