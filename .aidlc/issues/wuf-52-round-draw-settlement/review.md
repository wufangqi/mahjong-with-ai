# WUF-52 review — 无响应整局与流局结算

- **Fixed point**: `5e3fe3a`（WUF-51 tip / implement 前）
- **HEAD**: `a249c8c` on `feature/wuf-52-round-draw-settlement`
- **Diff**: `git diff 5e3fe3a...HEAD`
- **对照**: issue AC + `.aidlc/issues/wuf-52-round-draw-settlement/implement.md`
- **本地复验**: `npm run typecheck` / `npm test`（32）/ `npm run test:e2e`（3）均通过
- **Verdict**: `pass`

## Standards

### Documented standards

1. **Residual — ADR-0007（胡牌事件载荷）**（本切片可接受，非阻断）  
   `HandWon` 现为 `{ winners, discarder, tile }`，尚未携带番型/番数与手牌副露。流局路径用 `ExhaustiveDraw` + `fanBySeat` 全 0，符合本票「不计番」；完整胡牌结算属后续切片。无 UI chrome 写入核心事件（符合 ADR）。

2. **Judgement / residual — ADR-0010（用户文案集中管理）**  
   新增 zh-CN：chrome 在 `index.html`（`流局` / `胡` / `过`），运行时状态与流局面板在 `src/play/app.ts`，牌面在 `tileLabels.ts`。同 WUF-50/51 残留，表面扩大但非本票阻断。

3. **OK — ADR-0008**  
   Vitest + Playwright；根 Vite/TS；prototype 未入生产路径。

4. **OK — ADR-0009**  
   无 gameplay `Math.random`；种子路径保留；实体牌守恒 136 有测。

5. **OK — 分层与接缝**  
   `core` → `game` → `play`；会话不再在 discard 后本地改写 `phase`/`turn`（WUF-51 残留已清）。

### Baseline smells (judgement only)

| Smell | Note |
| --- | --- |
| **Duplicated Code** | `pickFirstLegal`（`round.test.ts`）≅ `pickAutoDiscard`（`session.ts`）；测试 `playToTerminal` 与 `PlaySession.advance` 形态相近 |
| **Mysterious Name / dead branch** | `autoPlayPlayerFirstLegal` 注释写「能胡则胡」，两臂均 `passWin()` — 故意偏流局演示，建议改注释或补 claim 分支 |

## Spec

### (a) Missing / partial

- **五条 AC：流局主路径无缺口。** 证据：`round.test.ts`（座位循环至墙空、终局仅胡响应窗）；`hand.ts` / `session.ts`（`ExhaustiveDraw`、`fanBySeat` 全 0、`startNextHand` 固定庄家）；`session.test.ts` / `e2e`（种子 42 至流局面板）；守恒 136 + advance 死锁守卫。
- **Partial —「听牌者可胡牌」展示：** UI 渲染手牌 / 听牌|未听 / 可胡；种子 42 与 first-legal 抽样多为全员未听，非空 `waitingTiles` 主要靠 `winning.test.ts` 单元覆盖，e2e 未点到「有人听」局。
- **Partial — `HandWon` 证明：** `round.test.ts` 标题称记录 `HandWon`，实际只断言非法 `ClaimWin` 抛错 + `Pass`；AI `ClaimWin` 已接线但缺合成/固定可达的胡终局用例。不构成流局 AC 失败。

### (b) Scope creep

- 终局 AI 自动 `ClaimWin`、`HandWon` 接线 — implement 允许，超出「无人胡则流局」演示主线但属合理接线。
- `winning.ts` 平胡 / 七对 / 十三幺 — 听牌判定所需，非中途吃碰杠。

### (c) Looks done but wrong

- 无流局功能向 AC 反证。终局只开放胡/过；中途无响应窗与 handoff 一致。

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | ADR-0007 胡事件载荷残缺 + ADR-0010 文案残留 + autoPlay 死分支 | HandWon 载荷（切片外，非阻断） |
| Spec | 五条 AC 流局路径满足；听牌非空展示与 HandWon 缺强 e2e/合成证明 | HandWon 测试名实不符（非流局阻断） |

**单票 integration**：代码已在 `mt_integrate_branch`；本轮 `pass` 无需再 merge。不合 `main`。
