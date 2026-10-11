# WUF-65 implement — 加载、性能与资源稳定预算

## 结论

工作分支 `feature/wuf-65` 已从 `origin/feature/wuf-49-ai-shuanghu-mvp` tip 创建并 push。落地可重复测量的验收接缝、真实加载进度、InstancedMesh 牌批处理（图集），以及传输量 / 运行时报告落盘。

**Review fail 回修**（对照 `review.md` @ `fbc4b3c`）：

1. Boot 文案字符已写入 `tools/font-subset/chars-runtime.txt` 并重建 WOFF2（`默/进/菜/就/绪/度`）；`bootChars.test.ts` 锁 ADR-0006。
2. 冷启动 e2e 改为 CDP `Network.emulateNetworkConditions`（1.6 Mbps down / 0.75 Mbps up / 150 ms RTT），不再只用固定延迟。
3. e2e 闭合 **50 局 / 100 场面 / 20 主题** soak；`playSceneDemo('top')` + `sampleFps` 测 mid/top；`npm run budget:fps` 为硬件 FPS 接缝。本机 PCI 为 UHD Graphics 630（UHD 620 级），但 agent 运行时不在 `render`/`video` 组，Chromium 只能 SwiftShader — 绝对 60/30 门槛在探测到 UHD-class `gpuProbe` 时启用。

## 验收对照

| 验收项 | 状态 | 如何重复测量 |
| --- | --- | --- |
| 首屏压缩传输量 ≤3 MB | 通过 | `npm run build && npm run budget:measure` → `budget-report.json` |
| 冷缓存 Fast 4G ≤3 s 进主菜单 + 真实进度 | 通过 | `e2e/budget.spec.ts`（CDP 吞吐节流） |
| UHD 620 级 mid 60 / top ≥30 fps | 接缝闭合；硬件门槛在 UHD `gpuProbe` 时断言 | `budget:fps` / e2e soak；见 `budget-fps.json` + `budget-runtime.json` |
| 静态 draw call ≤100；主题按需 ≤1 MB | 通过 | e2e + `budget-report.json` |
| 50 局 / 100 场面 / 20 主题无持续增长 | 通过（heap + `renderer.info.memory` 代理显存） | `e2e/budget.spec.ts` 全量 soak |

## 主要改动

1. **`src/budget/`** — 预算常量、加载进度、稳定增长判定、boot 字符子集测试；Node 侧 `firstScreen.ts`。
2. **`tools/budget/`** — `measure.mjs` / `measure-fps.mjs`；`npm run budget:measure` / `budget:fps`。
3. **Boot UI** — `#boot-loading` 真实阶段；字体子集含全部 boot 文案。
4. **`TileInstanceBatch`** — 图集 InstancedMesh；`drawCallCount()`。
5. **`e2e/budget.spec.ts`** — Fast 4G CDP、全量 soak、mid/top FPS、运行时 JSON。

## 本地验证

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run budget:measure
npx playwright install chromium
npm run test:e2e
# 有 DISPLAY + DRM 时：
BUDGET_FPS_HEADED=1 npm run budget:fps
```

## 后续

不跳过 review。不自行合回集成线 / `main`。不另开无关 PR。不调用 code-review。
