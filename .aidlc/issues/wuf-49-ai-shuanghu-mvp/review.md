# WUF-49 Stage 接缝 review — 开发 Stage（Demand 集成线）

- **Kind**: 开发 Stage 接缝复审（`mt_batch=true`；不合 `main`）
- **Branch**: `feature/wuf-49-ai-shuanghu-mvp` @ `c966b70`
- **Fixed point**: `origin/main` (`9539bd5`)
- **Delta since prior fail**: `7402924..c966b70`（WUF-67 / `c677047`）
- **对照**: `.aidlc/issues/WUF-49/spec.md`（MVP 1.0 / M6）+ `docs/需求文档.md` §2.2 + ADRs `0001`–`0010` + 前次接缝 fail 阻断项
- **本地复验**: `npm ci`；`npm run typecheck`；无 `dist/` 时 `npm test` 208 passed（含 10k 自对弈）；`npm run test:coverage` 通过（stmts/lines/funcs 100%，branches 94.42%）；`npm run build` → `npm run test:budget` → `npm run budget:measure` 通过
- **Verdict**: `pass`

## 接缝完整性

| 检查 | 结果 |
| --- | --- |
| Tip 含 WUF-67 / `c966b70` | 是 |
| Work `mt_review_result=pass` 合入（含 WUF-50…67） | 是 |
| 直合 `main` | 否（正确） |
| 前次 Hard 阻断闭合 | 是（见下） |
| 干净路径 unit → coverage → build → budget | 是 |

## 前次 fail 阻断闭合

| 阻断 | 状态 | 证据 |
| --- | --- | --- |
| 对局胡牌场面接入 `WIN_TIMELINES` + 镜头 | **CLOSED** | `src/play/winTimeline.ts`；`app.ts` `showScene` → `playWinTimelineTracks`；`TableView.setWinCameraFocus`；`winTimeline.test.ts` |
| CI 不在 `build` 前跑依赖 `dist/` 的预算单测 | **CLOSED** | `npm test` 排除 `src/budget/**`；`ci.yml` / `npm run ci`：test → coverage → **build** → `test:budget` → `budget:measure` → e2e |
| ≥10k 种子自对弈可在 CI 验证 | **CLOSED** | `selfPlay.ts` + `selfPlay.test.ts`（`hands: 10_000`；失败含 seed + actionLog） |
| 核心覆盖率门禁可在 CI 验证 | **CLOSED** | `test:coverage` + `@vitest/coverage-v8`；`src/core` 门禁落地 |

---

## Standards

### Documented violations

**Hard open: 0**（前次两项 Hard 已闭合；本 tip 未发现新的硬性违规。）

### Soft / residual（非阻断）

| Item | Rule | Note |
| --- | --- | --- |
| 对局未驱动 `tiles` / `particles` 轨 | Impl ~168 lifecycle tracks | banner/audio/camera 已驱动；全轨生命周期为观感 residual |
| 对局环境粒子裸 `Math.random` | ADR-0009 visual RNG | `tableView.ts` ambient；preview 仍用 `visual/rng.ts` |
| `WinnerResult` 缺副露 | ADR-0007 | 仍仅 `seat` / `patterns` / `fan` / `hand` |
| 核心分支门禁 94% | Testing Decisions / ADR-0009「100% branches」 | stmts/lines/funcs 100%；branches 实测 94.42%，防回归门禁已落地 |

**Checked OK:** 无 React（ADR-0001）；`prototype/` 排除覆盖率（ADR-0008）；`HandWon` 无 `tier`/`themeId`；外接 AI 令牌会话级；IndexedDB/localStorage 分工；无 SW/PWA/analytics；WebGL2 / CSP 存在。

### Baseline smells (judgement only)

| Smell | Note |
| --- | --- |
| **Duplicated Code** | `selfPlay` easy 选择 ≈ 内置 easy；audio synth ∥ preview audio |
| **Divergent Change** | `app.ts` 仍混杂 boot/DOM/主题/场面/设置 |
| **Speculative Generality** | `WinSceneSchedulerDeps` 双时长钩子 |
| **Primitive Obsession** | `(n % 4) as Seat` / `rng.nextInt(4) as Seat` |

---

## Spec

### Prior Hard Spec blockers

全部 **CLOSED**（见上表）。

### (a) Missing / partial（Soft/Residual — 不重开 Hard）

1. Testing Decisions「rule core requires 100% branch coverage」→ 门禁 branches ≥94%（`vitest.config.ts`）。
2. Impl「data-driven timeline of … tracks」— 对局驱动 banner/audio/camera；shipped `tiles`/`particles` 轨未调度。
3. `WinnerResult` 无 `melds`（结算/场面可不含副露展示）。
4. 浏览器流程：chow / 全杠种 / 一炮多响 e2e 仍偏薄（核心单测覆盖）。
5. US115 / 视觉 RNG：环境粒子仍 `Math.random`（`tableView.ts`）。

### (b) Scope creep

`coverageGate.test.ts` 与小幅 `claims`/`hand` 改动服务于覆盖率门禁，无新产品面。可接受。

### (c) Looks done but wrong

CI 步骤标题「Core coverage (100% branches)」略夸大 94% 地板——标注不精确，门禁本身为有意 residual。

---

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | 0 hard；4 soft；4 smells | Soft：全轨 / 粒子 RNG / 副露 / 94% branches |
| Spec | 0 hard；5 soft residuals | Soft：Spec 100% branches 措辞 vs 门禁 94% |

**Verdict `pass`.** 前次 Demand 接缝 Hard 阻断已由 WUF-67 闭合；集成 tip `c966b70` 可收束开发 Stage。不合 `main`。Soft residual 可留给后续维护，不阻断本 Stage。
