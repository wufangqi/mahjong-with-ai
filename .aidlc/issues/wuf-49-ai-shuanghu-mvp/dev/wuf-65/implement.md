# WUF-65 implement — 加载、性能与资源稳定预算

## 结论

工作分支 `feature/wuf-65` 已从 `origin/feature/wuf-49-ai-shuanghu-mvp` tip 创建并 push。落地可重复测量的验收接缝、真实加载进度、InstancedMesh 牌批处理（图集），以及传输量 / 运行时报告落盘。

## 验收对照

| 验收项 | 状态 | 如何重复测量 |
| --- | --- | --- |
| 首屏压缩传输量 ≤3 MB（代码 + Three.js + 默认主题 + 字体） | 通过（本次 ~0.41 MiB） | `npm run build && npm run budget:measure` → `budget-report.json` |
| 冷缓存模拟 Fast 4G ≤3 s 进入主菜单，并显示真实加载进度 | 通过（e2e） | `npm run test:e2e -- e2e/budget.spec.ts`（boot-loading 文案随 fonts→theme→renderer→menu 推进） |
| UHD 620 / 1080p / Chrome：mid 对局目标 60 fps，top ≥30 fps | 接缝已落盘；CI 主机仅记录 sample | `__play.sampleFps()`；完整门槛需在 UHD 620 级设备上跑同一 e2e / 手工采样 |
| 静态场景 draw call ≤100；两套主题按需资源各 ≤1 MB | 通过（draw calls e2e；court-palace ~0.5 KB gzip） | draw：`__play.drawCallCount()`；主题：`budget-report.json` / `measureThemeOnDemandChunk` |
| 50 局 / 100 场面 / 20 主题切换后无持续内存增长 | 增长判定单测 + e2e 缩短 soak（20 主题 / 20 场面）通过 | `hasSustainedGrowth`；完整 50/100 可在同 API 上加长循环 |

## 主要改动

1. **`src/budget/`** — 预算常量、加载进度 tracker、稳定增长判定；Node 侧 `firstScreen.ts` 测 dist 传输量（不进浏览器包）。
2. **`tools/budget/measure.mjs`** — CLI 写出 `budget-report.json`；`npm run budget:measure`；已挂入 `npm run ci`。
3. **Boot UI** — `#boot-loading` 真实阶段进度；`main.ts` / `bootPlayApp({ onStage })`。
4. **`TileInstanceBatch`** — 牌面图集 + InstancedMesh（含点选 / 拖拽）；`TableView.drawCallCount()`。
5. **`e2e/budget.spec.ts`** — 冷启动、draw call、FPS sample、主题/场面 soak；写出 `budget-runtime.json`。

## 本地验证

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run budget:measure
npx playwright install chromium
npm run test:e2e
```

本次：typecheck / unit / budget:measure / e2e（budget + smoke）均通过。

## 后续

不跳过 review。不自行合回集成线 / `main`。不另开无关 PR。不调用 code-review。
