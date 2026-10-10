# WUF-57 review — 一张出牌让多家原子胡牌

- **Fixed point**: `origin/feature/wuf-49-ai-shuanghu-mvp` tip（implement 前）
- **HEAD**: `44f0e35` on `feature/wuf-57`
- **Diff**: `git diff origin/feature/wuf-49-ai-shuanghu-mvp...HEAD`
- **对照**: issue AC + `.aidlc/issues/wuf-49-ai-shuanghu-mvp/dev/wuf-57/implement.md` + ADR-0004 + WUF-49 US 9/28/46–48/76–77
- **本地复验**: `npm run typecheck` / `npm test`（107）均通过
- **Verdict**: `pass`
- **合入**: 子票 pass → 合入 `feature/wuf-49-ai-shuanghu-mvp`（不合 `main`）

## Standards

### Documented standards

No hard breaches found against the cited sources.

1. **OK — Layering / paths**（`src/core` rules, `src/game` session, `src/play` presentation; ADR-0003 / ADR-0007 / ADR-0008）  
   Domain seat order + next dealer live in `claims.ts`; tier→scene order in `winPresentation.ts`; session only adapts `WinSettlement` → seats. Production under root `src/`, no React.

2. **OK — ADR-0007 / ADR-0003**  
   `HandWon` still carries winners / discarder / patterns / fan only; tiers stay in play (`orderWinnersForScenes` / `planWinScene`). Multi-win remains one atomic `HandWon`.

3. **OK — CONTEXT / ADR-0004 vocabulary**  
   Naming stays on 一炮多响 / 点炮 / 特效档 concepts (`orderWinnerSeats`, `nextDealerAfterWin`, scene tiers).

Skip tooling-enforced items.

### Baseline smells (judgement only)

| Smell | Hunk / note |
| --- | --- |
| **Duplicated Code** | `multiWin.test.ts` re-copies `openClaimWindow` / similar `resolveAll` already in `claims.test.ts` / `kong.test.ts`. Repo already tolerates per-file helpers. |
| **Middle Man** | `session.ts` `nextDealerFromSettlement` thin-unwraps to `nextDealerAfterWin`. Acceptable seam. |
| **Duplicated Code** (minor) | `hand.ts` orders seats in `resolveClaimsWindow` and again in `emitHandWon`. Harmless double-sort. |

## Spec

### (a) Missing / partial

1. **Partial — win beats 吃/杠 (test seam)**  
   Spec:「胡牌响应压过所有吃碰杠…」/ WUF-49 US28.  
   `resolveClaimsWindow` still settles any `win` locks before kong/pung/chow. New seam proves win vs pung (`multiWin.test.ts`), not vs chow/kong. Code path correct; non-blocking.

2. **No material product gap** on atomic multi-win, per-winner fan, scene tier order, or next-dealer rule relative to the listed ACs.

### (b) Scope creep

1. **Core `HandWon` / `winSettlement` winner array sorted by `orderWinnerSeats`.**  
   AC/US76–77 require that order for *scenes* (and nearest winner for dealer); WUF-49 only requires `HandWon` to “contain every winner,” with scene expansion in presentation. Seat-sorting the domain event is extra but harmless / deterministic.

2. Public re-exports of `seatsAfter` / `orderWinnerSeats` / `nextDealerAfterWin` from `src/core/index.ts` (support plumbing, not an AC).

### (c) Looks done but wrong

None found. Presentation `orderWinnersForScenes` matches US76–77 (tier then `seatsAfter`); `nextDealerAfterWin` matches US9 / AC 庄家; first `ClaimWin` leaves `awaiting_claim_response` with no `HandWon` (US47 / ADR「不截胡」); core omits basic/big/top (tiers presentation-only).

### Tests vs AC

| AC | Evidence |
| --- | --- |
| 胡压过吃碰杠，合法胡者同时成功 | `multiWin.test.ts`（win vs pung；2–3 winners）。Chow/kong：code path only |
| 原子 HandWon，不提前终止 | `multiWin.test.ts` |
| 独立番型/番数/特效档 | `multiWin.test.ts`（patterns/fan）；`winPresentation.test.ts`（tier） |
| 场面 top→big→basic，同档下家起 | `winPresentation.test.ts`（`orderWinnersForScenes` / scheduler） |
| 下家起第一赢家坐庄 | `claims.test.ts`（`nextDealerAfterWin`）；`session.ts` 已接线 |

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | no hard breaches；minor smells | test-helper duplication（非阻断） |
| Spec | 五条 AC 功能路径满足；win vs chow/kong 新测偏薄 | 场面顺序写进 core HandWon（scope creep，非阻断） |

**Verdict `pass`**. 合入 `mt_integrate_branch`；不合 `main`。
