# WUF-56 review — 完整番型白名单与三档场面

- **Fixed point**: `75d0018`（`feature/wuf-49-ai-shuanghu-mvp` tip / implement 前）
- **HEAD**: `f818652` on `feature/wuf-56`
- **Diff**: `git diff origin/feature/wuf-49-ai-shuanghu-mvp...HEAD`
- **对照**: issue AC + `.aidlc/issues/wuf-49-ai-shuanghu-mvp/dev/wuf-56/implement.md` + WUF-49 stories 34–42 / 72–75 / 119–121 + ADR-0002
- **本地复验**: `npm run typecheck` / `npm test`（100）均通过
- **Verdict**: `pass`
- **合入**: 子票 pass → 已合入 `feature/wuf-49-ai-shuanghu-mvp`（不合 `main`）

## Standards

### Documented standards

1. **Judgement / residual — WUF-49 Impl Decisions（data-driven lifecycle tracks）**  
   Spec: “Win presentation uses a data-driven timeline of lifecycle-managed tracks.”  
   `src/preview/scene.ts` `BasicWin` / `BigWin` / `TopWin` only consume `durationMs`, banner copy, and banner `startMs` from `timelineFor`; `camera` / `particles` / `audio` / `tiles` tracks in `WIN_TIMELINES` do not start/finish/dispose. Effect choreography stays in class bodies. Matches `implement.md` scope（时长与横幅）；full track lifecycle remains residual vs Demand-level decision.

2. **Judgement / residual — WUF-49 US-119 / Impl Decisions（build-time schema）**  
   Shipped timelines validated at module load (`assertShippedTimelinesValid` in `timelines.ts`) and in `timelines.test.ts`. No dedicated `package.json` build/ci schema step. Acceptable while preview module is imported in test/build path; incomplete vs “during build” wording.

3. **OK — ADR-0002**  
   Whitelist adds `pengpenghu` / `qingyise`; stacks with non-平胡; 平胡 only when no other listed pattern.

4. **OK — ADR-0007 / presentation mapper**  
   Core `evaluateWin` / `HandWon` stay free of tier/theme; `sceneTierForPatterns` in `winPresentation.ts` maps highest pattern tier.

5. **OK — ADR-0008 / core purity**  
   Preview timeline config stays under `src/preview/`; core remains render-free. Top banner copy uses `十三幺`（CONTEXT avoid-term vs prior `国士无双`).

No new hard documented-standard breach that blocks this Work’s AC. Skip tooling-enforced items.

### Baseline smells (judgement only)

| Smell | Hunk / note |
| --- | --- |
| **Duplicated Code** | Three Effect constructors repeat `timelineFor` + `tracks.find(banner)`. `tryOnlyTriplets` ≈ `tryStandard` minus chow (`winning.ts`). |
| **Speculative Generality** | `TimelineTrackKind` rows unused by playback (unless counted under residual #1). |
| **Mysterious Name** | `WinTimelineConfig.hand: TimelineTier` mirrors `tier` rather than a hand id. |

## Spec

### (a) Missing / partial

1. **Partial — track-driven preview**  
   AC:「basic、big、top 均可在固定预览中播放并通过配置 Schema 校验」  
   Schema + duration/banner wiring + fixed-hand map covered; tracks do not drive Three.js choreography. Playback still works via existing Effect classes. Non-blocking for Work AC / `implement.md`.

2. **Partial — build-time schema gate**  
   WUF-49: schema-validated at build time. Unit/module-load yes; explicit build step no. Non-blocking vs AC wording「通过配置 Schema 校验」.

### (b) Scope creep

1. Rich track kinds beyond what preview consumes — exceeds minimal banner/duration surface; harmless.
2. Banner copy `国士无双` → `十三幺` — presentation-only; aligns with ADR-0002 / CONTEXT.

### (c) Looks done but wrong

1. **Fragile dual API** — Story 37/36 need exposed melds. `evaluateWin(..., exposedMeldCount)` without `options.melds` uses `melds = []`, so 清一色/碰碰胡 mis-evaluate for callers that omit meld codes. Live `hand.ts` always passes `melds` — OK for product path. Non-blocking.

### Tests vs AC

| AC | Evidence |
| --- | --- |
| 碰碰胡/清一色/七对/十三幺正反例 | `winning.test.ts` |
| 七对四张=两对；十三幺无副露 | `winning.test.ts` |
| 非平胡 1 番可叠加；自摸/庄不加番 | `winning.test.ts`（叠加/平胡互斥；无自摸庄家加番路径） |
| 特效档取最高命中番型 | `winPresentation.test.ts` |
| basic/big/top 预览 + Schema | `timelines.test.ts` + `scene.ts` wiring |

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | track lifecycle / build-gate residuals + minor smells | data-driven tracks only partially wired（非阻断） |
| Spec | 五条 AC 功能路径满足；track 驱动与 build gate 偏薄 | dual API without melds 脆弱（非阻断；直播路径已传 melds） |

**Verdict `pass`**. 合入 `mt_integrate_branch`；不合 `main`。
