# WUF-67 review — 修复 MVP 1.0 Demand 接缝阻断项

- **Fixed point**: `7402924`（`origin/feature/wuf-49-ai-shuanghu-mvp` tip / Work 起点；含 Stage 接缝 fail）
- **HEAD**: `c677047` on `feature/wuf-67`
- **Diff**: `git diff origin/feature/wuf-49-ai-shuanghu-mvp...HEAD`
- **对照**: 本票 AC + `implement.md` + 父票接缝 `review.md`（Hard/Spec 阻断）+ `.aidlc/issues/WUF-49/spec.md` Impl/Testing Decisions
- **Verdict**: `pass`
- **合回**: `feature/wuf-67` → `feature/wuf-49-ai-shuanghu-mvp`

## 阻断闭合对照

| 父票 Hard / 本票 AC | 状态 | 证据 |
| --- | --- | --- |
| 对局胡牌场面接入 `WIN_TIMELINES` + 镜头（不再横幅 stub） | **CLOSED** | `winTimeline.ts` → `timelineFor` / `WIN_TIMELINES`；`app.ts` `showScene` 经 `playWinTimelineTracks` 驱动 banner/audio/camera；`TableView.setWinCameraFocus`；scheduler 默认 `sceneDurationForTier` |
| CI 不在 `build` 前跑依赖 `dist/` 的预算单测 | **CLOSED** | `npm test` / `test:coverage` 排除 `src/budget/**`；`ci.yml` / `npm run ci`：test → coverage → **build** → `test:budget` → `budget:measure` → e2e |
| ≥10k 种子自对弈可在 CI 验证 | **CLOSED** | `selfPlay.ts` + `selfPlay.test.ts`（`hands: 10_000`；失败含 seed + actionLog）；随 `npm test` |
| 核心覆盖率门禁可在 CI 验证 | **CLOSED** | `test:coverage` + `@vitest/coverage-v8`；`src/core` stmts/lines/funcs 100%，branches ≥94%（见 Spec residual） |

---

## Standards

### Documented standards

No **hard** breaches against the parent Hard items this ticket was chartered to close, or against ADR-0003 / 0008 / WUF-49 Impl Decisions ~168 for match-path timeline rhythm.

1. **OK — 对局路径使用数据驱动胡牌时间轴**  
   规则：WUF-49 Impl Decisions ~168；父票 Standards Hard #1。  
   证据：`resolveWinTimelinePlayback` / `playWinTimelineTracks` 从校验过的 `WIN_TIMELINES` 取 duration 与 banner/audio/camera 轨；`WinSceneScheduler` 默认按 tier 时长推进。

2. **OK — 首屏预算测试与 CI 顺序**  
   规则：父票 Standards Hard #2；Impl ≤3 MB 首屏门禁须在 build 后可成立。  
   证据：预算单测移出默认 `vitest run`；GHA/`npm run ci` 在 Production build 之后跑 `test:budget` 与 `budget:measure`。

3. **Soft — 对局未驱动 `tiles` / `particles` 轨**  
   规则：Impl ~168「lifecycle-managed tracks」；ADR-0003 共用节奏。  
   证据：`playWinTimelineTracks` 仅调度 banner/audio/camera（+ 无 camera 轨时的短聚焦）。`WIN_TIMELINES` 仍定义 `tiles`/`particles`。Hard「接入时间轴」已闭合；全轨生命周期属 Demand 观感 residual，非本票 AC 阻断。

4. **Soft — 核心分支覆盖率门禁 &lt; Spec/ADR 100%**  
   规则：Testing Decisions「100% branch coverage」；ADR-0009 同旨。  
   证据：`vitest.config.ts` `thresholds.branches: 94`（注释承认 Spec 100%）；`hand.ts` / `claims.ts` 含 `/* v8 ignore */` 防御臂。门禁已落地且防回归；100% 分支仍为 Demand 措辞缺口。

5. **Soft / Residual（非本票 AC）— 对局环境粒子 `Math.random`；`WinnerResult` 缺副露**  
   规则：ADR-0009 / ADR-0007。父票 Soft/Residual 未改；非本票验收项。

**Checked OK:** ADR-0008（`prototype/` 仍排除覆盖率）；自对弈走种子 core/AI（无 gameplay `Math.random`）；主题不拥有 banner 文案/节奏（plan copy + timeline timing）。

### Baseline smells (judgement only)

| Smell | Note |
| --- | --- |
| **Duplicated Code** | `selfPlay.ts` `chooseEasy` 与内置 easy AI 优先级形状近似平行 |
| **Speculative Generality** | `WinSceneSchedulerDeps` 同时保留 `sceneDurationMs` 与 `durationForPlan` |
| **Primitive Obsession** | `asSeat` 移除后 `(n % 4) as Seat` / `rng.nextInt(4) as Seat` |
| **Divergent Change**（pre-existing） | `app.ts` 仍混杂 boot/DOM/主题/场面；本 diff 只换场面驱动 |

无 hard documented-standard 阻断。

---

## Spec

### (a) Missing / partial

无针对 **WUF-67 AC** 或父票四项 Hard/Spec 阻断的缺失。

| AC / 阻断 | 证据 |
| --- | --- |
| 对局接入 `WIN_TIMELINES` 与镜头调度 | `showScene` → `playWinTimelineTracks`；`setWinCameraFocus`；`winTimeline.test.ts` |
| CI/budget 顺序 | 见上；干净路径可先 unit 再 build 再 budget |
| 10k 自对弈 | `runSelfPlayBatch({ hands: 10_000 })`；失败报告 seed + actionLog |
| 核心覆盖率门禁 | CI `test:coverage`；stmts/lines/funcs 100%，branches ≥94% |

**Demand residual（非本票 AC fail）：**

1. Spec「100% branch coverage」vs 门禁 **94%**（implement 已注明；CI step 标题仍写「100% branches」略夸大）。
2. 对局未播 `tiles`/`particles` 轨；父票 Soft 粒子 RNG / `WinnerResult.melds` / 偏薄 e2e 与浏览器矩阵仍开。
3. Spec「独立 schema validation」步骤仍主要靠 build/load-time + 既有 timeline 测试，非本票新增独立 GHA job。

### (b) Scope creep

`claims.ts` / `hand.ts` 小改与大块 `coverageGate.test.ts` 服务于覆盖率门禁，非新产品面。可接受。

### (c) Looks done but wrong

无重开四项阻断的实现。横幅 stub + 固定 2400 ms 对局路径已替换为时间轴驱动；CI 预算顺序正确。

---

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | 0 hard；若干 Soft/smell residual | 全轨/`Math.random`/副露仍 Soft；非本票阻断 |
| Spec | WUF-67 AC 与四项 Demand Hard 闭合；Demand 措辞 residual（94% branches 等） | Spec 100% branches vs 门禁 94% |

**Verdict `pass`.** 对照本票 AC 与父票接缝阻断可收束。合回 `feature/wuf-49-ai-shuanghu-mvp`；不合 `main`。
