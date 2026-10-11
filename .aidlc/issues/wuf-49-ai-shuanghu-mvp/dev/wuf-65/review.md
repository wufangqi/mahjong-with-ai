# WUF-65 review — 达到加载、性能与资源稳定预算

- **Fixed point**: `a3811be`（`origin/feature/wuf-49-ai-shuanghu-mvp` tip / Work 起点）
- **HEAD**: `502b29a` on `feature/wuf-65`
- **Diff**: `git diff a3811be...HEAD`
- **对照**: issue AC + `implement.md` + `budget-report.json` / `budget-runtime.json` + WUF-49 stories 104 / 112 / 113 + Constraints / Testing + ADR-0006 / 0008 / 0010 / CONTEXT
- **Verdict**: `fail`
- **合回**: 本轮 **不合回** 集成线（Leader 完成条件）；返修后重新 review

## Standards

### Documented standards

1. **Hard — ADR-0006**（`.aidlc/domain/docs/adr/0006-bundle-subset-source-han-fonts.md`：构建只保留实际使用字符）  
   新 boot 文案未进入 `tools/font-subset/chars-runtime.txt`，本 diff 也未重生成 WOFF2。缺失字形：`默`（加载默认主题）、`进`/`菜`（进入主菜单）、`就`/`绪`（就绪）、`进`/`度`（`aria-label`「加载进度」）。`加载字体` / `准备桌面` 已覆盖。与 story 104「不出现 broken glyphs」直接冲突。

2. **Judgement / residual — ADR-0010**（用户文案集中管理）  
   boot 文案分散在 `src/budget/loadProgress.ts`（`LOAD_STAGES` / `就绪`）与 `index.html`（初始标签 / aria-label）。与既有菜单硬编码先例一致，非本票唯一新增，但加重分散。非单独阻断（字体子集才是阻断）。

3. **OK — ADR-0008**  
   Vite/TS/Three.js、原生 DOM、Vitest + Playwright；`prototype/` 未进生产测量路径；`budget:measure` 排除 preview / courtPalace。

4. **OK — ADR-0007 / 分层**  
   预算逻辑在 `src/budget` + tools；牌批处理在 play 渲染层；未污染 rule core。

5. **OK — CONTEXT glossary**  
   新 UI 未见 Avoid 词（对局 / 庄 等）。

### Baseline smells (judgement only)

| Smell | Note |
| --- | --- |
| **Duplicated Code** | 传输图遍历在 `src/budget/firstScreen.ts` 与 `tools/budget/measure.mjs` 各一份（扩展名 / 魔法数字已漂移） |
| **Duplicated Code** | e2e 硬编码 `3000` / `100`，未复用 `limits.ts` 常量 |
| **Speculative Generality** | `STABILITY_*` 全量 soak 常量导出，运行时 e2e 用更短循环 |
| **Middle Man** | `__play.hasSustainedGrowth` 纯转发 |

无其他 hard documented-standard 阻断；**ADR-0006 为阻断项**。

## Spec

### (a) Missing / partial

1. **阻断 — 加载文案缺字（story 104）**  
   Spec：「loading screen with real progress until fonts and the default theme are ready, so that startup does not show broken glyphs」。boot 阶段标签含未子集化汉字 → 首屏进度本身可出现缺字。

2. **阻断 — Fast 4G 模拟不成立**  
   Spec/AC：「Cold startup under simulated Fast 4G must reach the main menu within three seconds」。`e2e/budget.spec.ts` 仅 `setTimeout(40)` 延迟，**无**下行吞吐节流（注释写 ~1.6 Mbps 但未实现）→ ≤3s 断言不能代表 Fast 4G。

3. **阻断 — 稳定 soak 未达 AC 规模**  
   Spec Testing / AC：「50 hands, 100 scenes, and 20 theme switches」。e2e 为 20 主题 / 20 场面，**无** 50 局循环；`hasSustainedGrowth` 单测 ≠ 全量 soak。

4. **阻断 / 设备缺口 — FPS 门槛未验收**  
   Spec/AC：UHD 620 @1080p Chrome mid 60 fps、top ≥30 fps。仅有 `__play.sampleFps()` + `expect(midFps).toBeGreaterThan(0)`；`budget-runtime.json` 样本 ≈6.65；无 top 场面样本、无 60/30 断言。参考机未跑则该条未闭合。

5. **Partial — 显存**  
   AC：「无持续内存或显存增长」。仅 `performance.memory.usedJSHeapSize`；heap 不可用时样本为空并当作无增长（静默通过）。无显存接缝。

6. **Partial — 主题按需各 ≤1 MB**  
   只测量 `courtPalace-*`；classic-green 计入首屏。AC「两套…各」证据一侧完整。

7. **Residual — 真实进度断言偏薄**  
   阶段接缝已接线；e2e 只断言 label 非空，未断言阶段推进 / 进度条变化。

### (b) Scope creep

`TileInstanceBatch` / InstancedMesh 服务于 draw-call（及性能）预算，属合理实现手段。`renderer` / `menu` 加载阶段略宽于 story 104「fonts + default theme」字面，仍服务加载 AC。

### (c) Looks done but wrong

1. 冷启动「通过」≠ 已验证 Fast 4G。  
2. 稳定「通过」≠ 50/100/20 + 显存。  
3. FPS「接缝」≠ 参考机验收。

### Verified OK（可保留）

| 验收项 | 证据 |
| --- | --- |
| 首屏压缩传输 ≤3 MB | `budget-report.json` totalBytes ≈428403；`npm run budget:measure` |
| 静态 draw call ≤100 | e2e `drawCallCount()` ≤100；报告 drawCalls=1 |
| court-palace 按需 ≤1 MB | themeOnDemand ≈481 B gzip |
| 加载进度接缝 | `LoadProgressTracker` + `bootPlayApp({ onStage })` + `#boot-loading` |

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | ADR-0006 缺字（hard）；ADR-0010 / smells residual | **ADR-0006 字体子集** |
| Spec | Fast 4G / 全量 soak / FPS / 显存 / boot 缺字未闭合；传输量与 draw call 已过 | **加载缺字 + Fast 4G + soak/FPS** |

**Verdict `fail`**：回 implement — 至少补齐 boot 字符进子集并重建字体、落实带宽型 Fast 4G（或等价可辩护模型）、按 AC 或可重复全量脚本闭合 50/100/20（含显存或明确不可测边界）、并在 UHD 620 级环境留下可对照的 mid/top FPS 证据。本轮不合回 `feature/wuf-49-ai-shuanghu-mvp`。
