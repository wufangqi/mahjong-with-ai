# WUF-54 review — 吃 / 碰 / 过与行牌裁决

- **Fixed point**: `a977ec8`（`origin/feature/wuf-49-ai-shuanghu-mvp` tip / implement 前）
- **HEAD**: `e5c0b7c` on `feature/wuf-54`
- **Diff**: `git diff origin/feature/wuf-49-ai-shuanghu-mvp...HEAD`
- **对照**: issue AC + `.aidlc/issues/wuf-49-ai-shuanghu-mvp/dev/wuf-54/implement.md` + WUF-49 stories 18–20 / 25–26 / 28–30 / 33
- **本地复验**: `npm run typecheck` / `npm test`（41）均通过
- **Verdict**: `pass`

## Standards

### Documented standards

1. **Judgement / residual — ADR-0010（用户文案集中管理）**  
   zh-CN still split: chrome in `index.html`（`胡` / `碰` / `过`）, runtime status + dynamic `吃 …` in `src/play/app.ts`, faces in `tileLabels.ts`. Surface grows with claim UI; same non-blocking residual as WUF-50/52.

2. **Residual — ADR-0007（胡牌事件载荷）**（非阻断）  
   `HandWon` still `{ winners, discarder, tile }` — no 手牌 / 副露 / 番型 / 番数. New `ClaimResponseOpened` / `MeldFormed` stay domain-shaped (no `tier` / chrome). Melds only appear on state after resolve; UI does not read `locked` early — aligns with the window comment on `ResponseWindow`.

3. **OK — ADR-0008**  
   Root Vite/TS + Vitest + Playwright; native DOM; no React; prototype unused by this path.

4. **OK — ADR-0009**  
   No gameplay `Math.random` in the diff; conservation includes `melds.tiles`.

5. **OK — 分层与词汇**  
   Legality/resolution in `src/core`（`claims.ts` + `hand.ts`）→ session locks commands → play renders. Glossary terms 吃 / 碰 / 过 / 响应 / 副露 used consistently.

### Baseline smells (judgement only)

| Smell | Hunk / note |
| --- | --- |
| **Duplicated Code** | Identical `asSeat` in `claims.ts` and `hand.ts`. Concealed-size formula `13 - melds×3` / `14 - melds×3` repeated in `hand.ts`, `winning.ts`, e2e/session tests. Pass-drain `while (…pending…)` copied across `claims.test.ts` / `round.test.ts`. |
| **Middle Man** | `passWin(): void { this.passResponse(); }` — deprecated pure delegate kept for globals/compat. |
| **Mysterious Name** | Button `id="pass-win"` while API/testid move to `passResponse` / `pass-response`. |

No hard documented-standard breach beyond prior ADR-0007/0010 residuals. Skip tooling-enforced items.

## Spec

### (a) Missing / partial

1. **Partial — source seat not shown in UI**  
   AC: 「成功响应的牌从牌河移入副露并标明来源」  
   Spec story 25: 「shown in the meld with its source seat」  
   Core stores `Meld.fromSeat` / `MeldFormed.fromSeat` and removes the discard from the river (`hand.ts` `applyMeld`). `tableView.layoutMelds` only gold-highlights `claimedTileId`; **`fromSeat` is never rendered**, so public「来源」is data-only + claimed-tile highlight, not an explicit source-seat cue. Non-blocking for this slice (implement treats highlight as 来源 presentation).

2. **Partial — equal-priority seat resolution under-exercised**  
   AC: 「同级响应由离出牌者最近的座位成功」  
   Spec story 30: equal-priority nearest-seat  
   `nearestAfter` / `resolveClaimsWindow` implement concurrent pung ordering, but tests only call `nearestAfter` in isolation — no two-seat pung lock scenario. Behaviour looks present; confidence is thin. Non-blocking.

### (b) Scope creep

None material relative to `implement.md` + stories 18–20, 25–26, 28–30, 33. Mid-hand 胡 in the same claim window, exposed-meld win/waiting math, and win-only after wall empty match implement notes / stories 28 & 33. Kong correctly omitted.

### (c) Looks done but wrong

None found against the cited AC/stories. Chow = discarder’s 下家 (`canChowFrom` / story 18); pung any non-discarder (story 20); explicit `ClaimChow` tileIds + UI options (story 19 / AC); pung before chow (AC / story 29 minus kong); collect-then-resolve with no timer (AC); AI locks into `locked` without `MeldFormed` until pending empty (AC); claimant discards without draw (story 26).

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | ADR-0007/0010 residuals + minor smells | ADR-0010 copy split（非阻断） |
| Spec | 五条 AC 功能路径满足；来源座位 UI 与双碰同级缺强测 | `fromSeat` 未渲染（非阻断） |

**子票 Work**：`pass` 后合入 Demand 级 `mt_integrate_branch`（`feature/wuf-49-ai-shuanghu-mvp`）。不合 `main`。
