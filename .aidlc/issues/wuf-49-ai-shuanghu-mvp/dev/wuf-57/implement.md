# WUF-57 implement — 一张出牌让多家原子胡牌

## 结论

工作分支 `feature/wuf-57` 已从集成分支 `feature/wuf-49-ai-shuanghu-mvp` tip 创建并 push，落地一炮多响：

1. **胡压过吃碰杠** 响应窗收齐后，任一胡牌锁定优先于杠/碰/吃；多家胡牌同时成功。
2. **原子 HandWon** 第一家 `ClaimWin` 不提前结算；全部 pending 应答后发出单一 `HandWon`，含全部赢家。
3. **独立计番** 每位赢家各自 `evaluateWin`（番型 / 番数）；表现层各自映射特效档。
4. **场面顺序** `orderWinnersForScenes`：top → big → basic，同档按点炮者下家起座次。
5. **连庄** `nextDealerAfterWin`：下一局由点炮者下家起第一位赢家坐庄。

## 验收对照

| 验收项 | 状态 |
| --- | --- |
| 胡牌响应压过所有吃碰杠，且所有合法胡牌者同时成功 | 通过（`multiWin.test.ts`） |
| 一个原子 HandWon 结果包含全部赢家，不被第一家提前终止 | 通过 |
| 每家独立计算番型、番数和特效档 | 通过（核心 + `winPresentation.test.ts`） |
| 场面按 top、big、basic 排序，同档从点炮者下家起排序 | 通过（`orderWinnersForScenes`） |
| 下一局由从点炮者下家起第一位赢家坐庄 | 通过（`nextDealerAfterWin` / `claims.test.ts`） |

## 主要文件

- `src/core/claims.ts` — `orderWinnerSeats` / `nextDealerAfterWin`
- `src/core/hand.ts` — 丢弃点炮赢家座次排序后原子 `HandWon`
- `src/core/multiWin.test.ts` — 一炮多响接缝测试
- `src/play/winPresentation.ts` — 场面播放顺序
- `src/game/session.ts` — 下一局庄家
- `src/play/app.ts` — 调度场面时传入 discarder

## 本地验证

```bash
npm ci
npm run typecheck
npm test
npm run build
```

全部通过（107 unit tests）。

## 后续

不跳过 review。不自行合回集成线 / `main`。不调用 code-review。
