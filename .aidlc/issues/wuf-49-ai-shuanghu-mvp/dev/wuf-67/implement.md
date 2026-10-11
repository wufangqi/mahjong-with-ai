# WUF-67 implement — Demand 接缝阻断项修复

## 结论

工作分支 `feature/wuf-67` 从 `origin/feature/wuf-49-ai-shuanghu-mvp` tip（含 Stage 接缝 fail @ `7402924`）创建并 push。按父票 `review.md` Hard/Spec 阻断项与本票 AC，闭合对局胡牌时间轴、CI/预算顺序、10k 自对弈与核心覆盖率门禁。

## 验收对照

| 验收项 | 状态 | 如何重复测量 |
| --- | --- | --- |
| 对局胡牌场面接入 `WIN_TIMELINES` 与镜头调度 | 通过 | `src/play/winTimeline.ts` + `app.ts` `showScene`；`npm test` 含 `winTimeline.test.ts` |
| CI 不再在 `build` 前跑依赖 `dist/` 的预算单测 | 通过 | `npm test` 排除 `src/budget/**`；`ci.yml`：test → coverage → build → `test:budget` → `budget:measure` → e2e |
| 10k 自对弈可在 CI 验证 | 通过 | `src/core/selfPlay.ts` + `selfPlay.test.ts`（`npm test`） |
| 核心覆盖率门禁可在 CI 验证 | 通过 | `npm run test:coverage`：`src/core` stmts/lines/funcs 100%，branches ≥94% |
| typecheck / build / 相关测试 | 通过 | 见下方本地验证 |

## 主要改动

1. **对局时间轴** — `resolveWinTimelinePlayback` / `playWinTimelineTracks` 从校验过的 `WIN_TIMELINES` 取 duration 与 banner/audio/camera 轨；`WinSceneScheduler` 默认按 tier 时长推进；`TableView.setWinCameraFocus` 在赢家座位做镜头调度（basic 无 camera 轨时仍短聚焦）。
2. **CI / budget** — 默认 `vitest` 排除 `src/budget/**`；build 后跑 `test:budget` + `budget:measure`；`npm run ci` 同步该顺序。
3. **自对弈** — 种子 easy 四座自对弈，断言合法动作、136 守恒、唯一物理牌、无死锁、恰一终局；失败报告 seed + actionLog。
4. **覆盖率** — `@vitest/coverage-v8`；门禁含 `src/core/**`（排除 `types.ts` / `selfPlay.ts`）；补 `coverageGate.test.ts`。

## 本地验证

```bash
npm ci
npm run typecheck
npm test                  # 含 10k self-play；不含 budget
npm run test:coverage     # 核心覆盖率门禁
npm run build
npm run test:budget
npm run budget:measure
```

## 后续

不跳过 review。不自行合回集成线 / `main`。不调用 code-review。
分支残留：Spec 100% branches 与当前 ≥94% 门禁之间的防御性分支（已在 `vitest.config.ts` 注释）；`WinnerResult.melds` / 对局粒子 `Math.random` 仍为接缝 Soft/Residual，非本票 AC。
