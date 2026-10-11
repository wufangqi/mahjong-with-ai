# WUF-58 review — 连续进行一场完整游戏

- **Fixed point**: `95306dd`（`origin/feature/wuf-49-ai-shuanghu-mvp` tip）
- **HEAD**: `5169da3` on `feature/wuf-58`
- **Diff**: `git diff origin/feature/wuf-49-ai-shuanghu-mvp...HEAD`
- **对照**: issue AC + `.aidlc/issues/wuf-49-ai-shuanghu-mvp/dev/wuf-58/implement.md` + CONTEXT（一场/庄家/对手）+ ADR-0005 / 0009 / 0007 / 0008 / 0010
- **本地复验**: `vitest` — `easy` / `seatView` / `match`（9）通过
- **Verdict**: `pass`
- **合入**: 子票 pass → 合入 `feature/wuf-49-ai-shuanghu-mvp`（不合 `main`）

## Standards

### Documented standards

1. **Soft — CONTEXT.md vocabulary（一场 / 庄家）** — `index.html` menu blurb  
   Copy: `开始一场本地对局。第一局随机庄；…`  
   - **一场** Avoid: `对局` → uses `对局`.  
   - **庄家** Avoid: `庄` → uses `随机庄` (not `庄家`).  
   UI copy only; non-blocking.

2. **OK — ADR-0005 DecisionProvider boundary** — `src/ai/types.ts`, `seatView.ts`, `easy.ts`, `session.ts`  
   View is own hand/drawn + public rivers/melds/concealedCount + dealer/turn/wallRemaining + legal list; omits other hands, wall order, seed/rng. `choose` only picks from `legalActions`. Illegal return throws in `applyAiAction`.

3. **OK — ADR-0009** — no gameplay `Math.random` in the diff; easy is priority-only (no RNG needed). Shuffle/dealer still via seeded hand start.

4. **OK — ADR-0007 / 0008 / 0010** — no core event/presentation bleed; `src/ai` + `src/game` + `src/play` DOM/Vite, no React; no new network/persistence surface.

Skip tooling-enforced items.

### Baseline smells (judgement only)

| Smell | Hunk / note |
| --- | --- |
| **Speculative Generality** | `index.html` hidden `#start` / `data-testid="start-hand"` “Compat alias”; e2e already uses `start-match`. |
| **Duplicated Code** | `session.ts` `chooseAiAction` + `applyAiAction` both call `listLegalActions` for the same seat. |
| **Repeated Switches** | `easy.ts` sequential `find` by `a.type`; parallel type `switch` in `applyAiAction` / `decisionEquals`. Acceptable seam for the action union. |

无硬性 documented-standard 阻断。

## Spec

**Verdict:** AC covered; no blocking Spec gaps. Domain **存档** absent (out of scope for this ticket).

### (a) Missing / partial

- **存档** (CONTEXT: 「最近一场在每个已完成动作后的局面…」) — not in diff. AC does not require it → note only, not fail.
- **胡后下一局** e2e only proves 流局连庄 + 结束; 胡牌换庄 is unit-only (`match.test.ts` 平胡). Implementation present, browser path thinner than 流局.

### (b) Scope creep

- Spec: 「AI 只要能胡就胡」— `easy.ts` also ranks 杠/碰/吃/摸打; beyond AC (ok for easy, not requested).
- Spec: 「一场没有总分…」— HUD adds `第 N 局 · 无整场总分` (`app.ts`); cosmetic, not match scoring.
- `DecisionProvider` inject seam — aligns with ADR-0005 / implement.md; not an AC deliverable by itself.

### (c) Looks done but wrong

None found against quoted AC / 庄家 rules / ADR seat-view fields. First dealer from seeded `StartHand`; `SeatVisibleState` omits wall order / other hands / seed (ADR-0005); easy has no `Math.random` (ADR-0009).

### AC → evidence

| AC | Evidence |
| --- | --- |
| 主菜单开场；第一局随机庄；同种子可复现 | `match.ts` `startMatch`; `match.test.ts`; e2e `main-menu` / `start-match` seed 42 |
| 三 easy：只见己手+公开；合法动作 | `buildSeatView` / `seatView.test.ts`; `chooseAiAction`+`applyAiAction`; `easy.test.ts` |
| AI 能胡必胡；玩家可过胡 | `easy.ts` ClaimWin/DeclareWin first; `session.test.ts` pass 平胡; UI `pass-win` |
| 结算后下一局/结束；流局连庄 / 胡后换庄 | `MatchSession.nextHand`/`endMatch`; `startNextHand`+`nextDealerAfterWin`; match + e2e 流局 |
| 无整场总分/筹码/胜负；玩家在下 | `MatchSnapshot` 无分字段; `PLAYER_SEAT=0` + table layout unchanged |

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | UI copy vocabulary soft drift；minor smells | `对局`/`随机庄` copy（非阻断） |
| Spec | 五条 AC 满足；存档 out of scope；胡后换庄 e2e 偏薄 | 无阻断项 |

**Verdict `pass`**. 合入 `mt_integrate_branch`；不合 `main`。
