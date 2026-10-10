# WUF-52 implement — 无响应整局与流局结算

## 结论

单票 integration 路径已在 `feature/wuf-52-round-draw-settlement` 落地完整摸打至流局：

1. **判胡 / 听牌** `src/core/winning.ts`：平胡、七对（四张算两对）、十三幺；`waitingTileCodes` 列出可胡牌。
2. **规则核心** `src/core/hand.ts`：出牌后若牌墙仍有牌则下家摸打；牌墙耗尽后的出牌打开仅胡/过响应窗；全员过后 `ExhaustiveDraw`（`fanBySeat` 全 0）；`StartHand.dealer` 可固定庄家。
3. **会话** `src/game/session.ts`：第一合法动作驱动三家对手；玩家出牌后继续循环；终局响应 AI 能胡则胡，玩家不能胡则自动过；`startNextHand` 流局后庄家不变。
4. **UI**：流局面板展示四家手牌、听牌状态与可胡牌；「下一局」；终局胡/过按钮。

本切片**不**开放中途吃碰杠响应（无响应整局）；终局仅胡牌响应。

## 验收对照

| 验收项 | 状态 |
| --- | --- |
| 四家按座位顺序重复摸牌和出牌直到牌墙耗尽 | 通过（`round.test.ts` / `session.test.ts`） |
| 最后一次正常摸牌后的出牌只开放胡牌响应，无人胡则流局 | 通过 |
| 流局面板展示四家手牌、听牌状态及听牌者可胡牌 | 通过（单元 + Playwright） |
| 流局不计番、不产生分数，下一局庄家不变 | 通过（`fanBySeat` 全 0 + `startNextHand`） |
| 固定种子可复现整局；牌不重复、不丢失且状态机不死锁 | 通过（守恒 136 + 双跑同结算） |

## 接缝说明

- 中途无响应窗；完整吃碰杠与番型结算属后续切片。
- `HandWon` 路径已接线（AI 终局必胡），本票演示与 e2e 以流局为主（种子 42）。

## 本地验证

```bash
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## 后续

不跳过 review。不自行合回 `main`。
