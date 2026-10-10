# WUF-55 review — 明杠 / 暗杠 / 加杠与杠上开花

- **Fixed point**: `3b10e82`（`feature/wuf-49-ai-shuanghu-mvp` tip / implement 前）
- **HEAD**: `5d1c395` on `feature/wuf-55`
- **Diff**: `git diff feature/wuf-49-ai-shuanghu-mvp...HEAD`
- **对照**: issue AC + `.aidlc/issues/wuf-49-ai-shuanghu-mvp/dev/wuf-55/implement.md` + WUF-49 stories 16–17 / 21–24 / 27 / 29 / 40 / 56 / 73
- **本地复验**: `npm run typecheck` / `npm test`（66）均通过
- **Verdict**: `pass`
- **合入**: Leader 指示本轮**不自行 merge**集成线；合入由后续编排处理

## Standards

### Documented standards

1. **Judgement / residual — ADR-0010（用户文案集中管理）**  
   New chrome in `index.html`（`杠`）、`declare-win` / `self-bar`；runtime `暗杠 …` / `加杠 …` and status strings in `src/play/app.ts` (`可杠 / 自摸 / 出牌`, `胡 / 杠 / 碰 / 吃 / 过`). Same split as WUF-54/50/52; non-blocking.

2. **Residual — ADR-0007（胡牌事件载荷）**  
   `WinnerResult` / `HandWon` still carry concealed `hand`, `patterns`, `fan` only — no **副露** even after `exposed_kong` / `concealed_kong` / `added_kong` (`src/core/types.ts`, `buildWinnerResult` in `hand.ts`). Kong wins are harder to replay/settle from the event alone. Events stay free of `tier` / theme (`kong.test.ts`, `winPresentation.ts`); tier mapping for `gangshangkaihua` stays in play layer — OK.

3. **OK — ADR-0002**  
   Whitelist fan `gangshangkaihua` added in `winning.ts`; stacks with non-平胡 per tests.

4. **OK — ADR-0007 / CONTEXT**  
   Commands → `applyCommand` in `hand.ts`; session locks; glossary 明杠/暗杠/加杠/补牌/杠上开花 reflected in flow (`wall.pop`, `lastDrawKind`, no added-kong response window).

5. **OK — ADR-0008 / ADR-0009**  
   Root TS/Vitest path; no gameplay `Math.random` in diff; `kong.test.ts` covers 杠流程; conservation unchanged.

6. **Watch — ADR-0007（快照 schema）**  
   `HandState` gains required `lastDrawKind` while `schemaVersion` stays `1` — fine while saves are unwired; if IndexedDB snapshots land without a migrator/default, old saves break the rule. Not a current hard breach in-repo.

No new hard documented-standard breach beyond established ADR-0007/0010 residuals. Skip tooling-enforced items.

### Baseline smells (judgement only)

| Smell | Hunk / note |
| --- | --- |
| **Duplicated Code** | `canKongHand` / `kongTileIds` mirror `canPungHand` / `pungTileIds` in `claims.ts`. `wallHasReplacement = state.wall.length > 0` repeated in `claims.ts`, `legalSelfActions`. Concealed-size `13 - melds×3` again in `canWinOnDraw` vs existing helpers. |
| **Repeated Switches** | `resolveClaimsWindow` grows another win→kong→pung→chow cascade (`hand.ts`) — same shape as prior slice. |
| **Middle Man** | `declareWinBtn` → `session.claimWin()` which also serves discard 胡 (`app.ts` / `session.ts`). |
| **Mysterious Name** | `WinSettlement.discarder` holds self-draw winner seat (`types.ts` comment documents it); `id="pass-win"` unchanged from WUF-54. |

## Spec

### (a) Missing / partial

1. **Partial — 明杠 vs 碰 under-exercised**  
   AC / story 29: 「明杠优先于碰和吃」  
   `resolveClaimsWindow` ranks kong before pung, but `kong.test.ts` only locks **kong vs chow**. Behaviour looks present; confidence thin. Non-blocking.

2. **Partial — stacking surface**  
   AC / story 40: 杠上开花可与其他番型叠加  
   Covered for 七对 + 杠上开花; 碰碰胡 / 清一色 still absent from core (ADR-0002 whitelist, later stories) so melded 杠上开花 currently lands as bare `gangshangkaihua` after replacing 平胡 — consistent with current fan surface, not a WUF-55 gap.

3. **Out of slice — kong SFX / browser every-kong e2e**  
   Stories 101 / 221 ask for kong sound and browser coverage of every kong type; not in this Work's AC / `implement.md`. Non-blocking for this ticket.

### (b) Scope creep

1. **`DeclareWin` / `self_draw`** — general 自摸 path (UI + `winKind`) beyond the five AC bullets; required to score 杠上开花 (story 40). Acceptable.

2. **Easy AI auto-kong** — `session.ts` after draw may auto `DeclareConcealedKong` / `DeclareAddedKong` before discard. Not in WUF-55 AC; keeps AI advancing. Non-blocking.

### (c) Looks done but wrong

None found against the five AC items + stories 16–17 / 21–24 / 27 / 29 / 40 / 56 / 73. Tail `wall.pop` replacement; no kong when wall empty; added kong with no response window; concealed/added only with drawn tile in `awaiting_discard`; 杠上开花 → 1 番 / `big`.

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | ADR-0007/0010 residuals + minor smells | ADR-0007 副露 still absent on `HandWon`（非阻断） |
| Spec | 五条 AC 功能路径满足；明杠-vs-碰缺强测 | kong vs pung 测试薄（非阻断） |

**Verdict `pass`**. Leader 本轮禁止自行合入 `mt_integrate_branch`；不合 `main`。
