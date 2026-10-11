# WUF-65 review — 达到加载、性能与资源稳定预算（复审）

- **Fixed point**: `a3811be`（`origin/feature/wuf-49-ai-shuanghu-mvp` tip / Work 起点）
- **HEAD**: `7623048` on `feature/wuf-65`（回修后）
- **Diff**: `git diff a3811be...HEAD`；回修增量 `fbc4b3c...7623048`
- **对照**: 前次 `review.md` 阻断 + issue AC + 更新后 `implement.md` / `budget-*.json` + stories 104 / 112 / 113 + ADR-0006 / 0008 / 0010
- **Verdict**: `fail`
- **合回**: 本轮 **不合回** 集成线（Leader 完成条件）

## 复审：先前阻断

| 阻断 | 状态 | 证据 |
| --- | --- | --- |
| Boot 文案缺字（ADR-0006 / story 104）`默进菜就绪度` | **CLOSED**（本项） | `chars-runtime.txt` 已含；WOFF2 cmap 含六字；`bootChars.test.ts` 锁 `LOAD_STAGES` + `就绪` + `加载进度` |
| Fast 4G 仅延迟无吞吐 | **CLOSED** | CDP `Network.emulateNetworkConditions` 1.6/0.75 Mbps + 150 ms；冷启动 e2e ≤3s + 进度条非 `0%` |
| Soak ≠ 50/100/20 | **CLOSED** | e2e 全量循环；`budget-runtime.json`：50 / 100 / 20；heap + `renderer.info.memory` 代理均无 sustained growth |
| mid/top FPS 未测 / 无门槛 | **PARTIAL** | 接缝闭合：`sampleFps` + `playSceneDemo('top')` + `budget:fps`；`if (uhdClass)` 才断言 60/30。本机 PCI UHD 630 但 Chromium 无 DRM/`render` 组 → SwiftShader，`fpsGateApplied: false`，绝对 AC **仍未在真 iGPU 上证明** |
| 显存 / heap 静默通过 | **residual** | GPU 资源计数始终采样；heap 仍在 `performance.memory` 缺失时跳过长度断言（软） |

## Standards

### Documented standards

1. **Hard — ADR-0006（新阻断）**  
   重建子集在补上 boot 六字的同时，**丢掉**先前 WOFF2 中的标点 cmap：`–—…、。！，：；？`（sans/serif 均 452→448 cps；文件体积同步下降）。这些标点仍出现在用户可见文案（如 `app.ts` `join('、')`、`对手思考中…`；`index.html` 菜单句号/顿号与 `…` placeholder）。`chars-runtime.txt` 从未收录它们；`bootChars.test.ts` 只比对文本清单、不校验 WOFF2 cmap → 回归未被锁住。  
   **Prior boot 六字 hard：CLOSED。本项新 hard：OPEN。**

2. **Judgement / residual — ADR-0010**  
   boot 文案仍分散在 `loadProgress.ts` / `index.html`。非阻断。

3. **OK — ADR-0008 / ADR-0007 / CONTEXT**  
   测量与 e2e 接缝未污染 rule core；无 React；无 Avoid 词新增问题。

### Baseline smells (judgement only)

| Smell | Note |
| --- | --- |
| **Duplicated Code** | `isUhd620Class` 在 e2e 与 `measure-fps.mjs` 各一份 |
| **Primitive Obsession** | `hasSustainedGrowth` 的 bytes 旋钮复用于 GPU **计数**样本 |
| **Duplicated Code** | soak 内三处相同 GPU growth 选项 |

## Spec

### (a) Missing / partial

1. **阻断 — 标点缺字（story 104 / ADR-0006 回归）**  
   Spec：「startup does not show broken glyphs」。回修关闭了 boot 标签缺字，但重建字体使 HUD/菜单常用 `、` `…` `。` 等从子集消失 → 仍可 broken glyphs。

2. **PARTIAL — UHD 620 mid 60 / top ≥30**  
   Spec/AC 绝对门槛。测量与条件门已落盘；当前证据仅为 SwiftShader 样本（~8 fps）+ 主机 PCI 记录。未在可绑定 Intel UHD 的浏览器会话中跑通断言 → **不可标 AC 已满足**（环境缺口；需 DRM 可用的 headed 复验或 `needs-human` 设备证据，但本轮因字体回归仍判 fail）。

3. **Residual — 真 VRAM**  
   无公共 VRAM API；`renderer.info.memory` 为代理（已文档化）。可接受为接缝，非单独阻断。

### (b) Scope creep

`budget:fps` CLI、PCI/`browserGpuAccess` 诊断 — 合理验收接缝。

### (c) Looks done but wrong

1. 「Boot 字体已修」≠ 子集整体健康（标点回退）。  
2. 「FPS 接缝闭合」≠ 参考机 60/30 已验收。

### Verified OK

| 验收项 | 证据 |
| --- | --- |
| 首屏 ≤3 MB | `budget-report.json` ≈354600 B |
| Fast 4G 冷启动 ≤3s + 真实进度 | CDP 吞吐 + e2e |
| draw call ≤100 | e2e |
| court-palace 按需 ≤1 MB | ≈481 B |
| 50/100/20 无持续增长（heap + GPU 代理） | `budget-runtime.json` |

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | 先前 boot 六字 CLOSED；**标点 cmap 回退**为新 ADR-0006 hard | **WOFF2 丢掉 `、…。` 等** |
| Spec | Fast4G / soak CLOSED；FPS 仅接缝；标点回归阻断 story 104 | **字体回归 + FPS 未在真 UHD 证明** |

**Verdict `fail`**：回修闭合了前次三项主阻断中的字体六字 / Fast4G / soak，但字体重建引入标点缺字回归，且绝对 FPS 仍缺可绑定 iGPU 的证据。返修建议：把 UI 所用标点写入 `chars-runtime.txt`（或保留旧 punct unicodes）、重建并增加 **WOFF2 cmap ⊆ 所需字符** 的测试；在 `render`/`video` 组可用的 headed 会话跑 `budget:fps` / e2e 使 `fpsGateApplied: true`。不合回 `feature/wuf-49-ai-shuanghu-mvp`。
