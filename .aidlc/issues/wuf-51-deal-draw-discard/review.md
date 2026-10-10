# WUF-51 review — 发牌、摸牌与玩家出牌

- **Fixed point**: `16eb80c`（implement 前 tip）
- **HEAD**: `c591092` on `feature/wuf-51-deal-draw-discard`
- **Diff**: `git diff 16eb80c...HEAD`
- **对照**: issue AC + `.aidlc/issues/wuf-51-deal-draw-discard/implement.md`
- **本地复验**: `npm run typecheck` / `npm test` / `npm run test:e2e` 均通过
- **Verdict**: `pass`

## Standards

### Documented standards

1. **Residual — ADR-0007（权威状态在规则核心）**（本切片可接受，非阻断）  
   `src/game/session.ts` `advanceToPlayer` 在对手 `Discard` 后本地改写 `phase` / `turn`：
   ```ts
   this.state = { ...result.state, phase: 'awaiting_discard', turn: nextSeat(seat) };
   ```
   核心 `discard` 已将 `phase` 置为 `discard_complete`（`src/core/hand.ts`）。与 `implement.md` 接缝说明一致（到达玩家回合前本地重开 `awaiting_discard`，完整循环属 WUF-52）。玩家确认出牌仍走 `applyCommand`，不篡改结果。

2. **Judgement / residual — ADR-0010（用户文案集中管理）**  
   zh-CN chrome 在 `index.html` / `preview.html`；运行时状态文案在 `src/play/app.ts`。同 WUF-50 残留，非本票阻断。

3. **OK — ADR-0008**  
   根 Vite + TS + npm `three`；牌局 `index.html` / 效果 `preview.html`；prototype 未入生产路径。

4. **OK — ADR-0009**  
   牌局随机经 `src/core/rng.ts`；`src/core|game|play` 无 gameplay `Math.random`。

5. **OK — WUF-50 基线**  
   strict TS、分层 `core` / `game` / `play`、`base: './'`。

### Baseline smells (judgement only)

| Smell | Note |
| --- | --- |
| **Duplicated Code** | `visibleHand` ≈ `displayHand`；`nextSeat` 在 `hand.ts` / `session.ts` 各一份 |
| **Speculative Generality** | `tableView.ts` 未用的 `updateTileCode`；`discard` 内空分支 |
| **Mysterious Name** | `TableView.sync` 中 `void totalTileCount(state)` 无可见效果 |

## Spec

### (a) Missing / partial

- **五条 AC：无缺口。** 证据：`src/core/hand.test.ts`（同种子 / 庄家 14·闲家 13 / `displayHand` 摸牌最右 / 出牌·守恒 136）；`src/game/session.test.ts`（二次点击与拖入确认）；`e2e/smoke.spec.ts`（种子 42 发牌 → 确认出牌 →「不可撤销」+ `实体牌 136/136`）。
- **Partial — 拖入牌河 e2e：** 拖放路径在 `app.ts` + `tableView.isOverRiver`，单元有 `discardByDrag`；Playwright 仅走 `__play.clickTile`，未驱动 canvas drag。
- **Partial — ADR-0007 纯度：** 见 Standards；与 implement 接缝一致，不构成 AC 失败。

### (b) Scope creep

- `bootPlayApp` 自动 `session.start(DEFAULT_SEED)` — 便于演示，非 AC 硬性要求。
- `preview.html` 第二入口 + `window.__play` 测试钩子 — 交付卫生 / 测试面，可接受。

### (c) Looks done but wrong

- 无功能向 AC 反证。庄家先出、排序手牌+摸牌最右、玩家出牌不可撤销、守恒 136 与文案一致；非庄家摸牌由单元 / session 种子覆盖。

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | ADR-0007 会话接缝 + ADR-0010 文案残留 + 若干 smell | 会话改写 phase/turn（切片内文档化，非阻断） |
| Spec | 五条 AC 满足；拖放仅单元覆盖；自动开局属轻度扩展 | e2e 未覆盖拖入牌河 |

**单票 integration**：代码已在 `mt_integrate_branch`；本轮 `pass` 无需再 merge。不合 `main`。
