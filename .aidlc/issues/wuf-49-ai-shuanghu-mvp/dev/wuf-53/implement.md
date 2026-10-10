# WUF-53 implement — 平胡响应、basic 场面与结算

## 结论

工作分支 `feature/wuf-53` 已从集成分支 tip 创建并 push，落地平胡纵切：

1. **番型** `evaluateWin`：普通四面子一将记为 `pinghu`（1 番）；命中七对 / 十三幺时不叠加平胡。
2. **响应** 出牌后若有人可胡（或牌墙已空）则打开胡/过窗；过只结束本次机会，牌墙未空则下家续打。
3. **领域事件** `HandWon` 携带赢家座位、手牌、番型与番数；不含 `tier` / 主题 / 横幅样式。
4. **表现层** `WinSceneScheduler`：平胡映射 `basic`，在 100 ms 内进入场面调度；结算面板可重播。
5. **结算 UI**：展示赢家、平胡、1 番；下一局由赢家坐庄。

## 验收对照

| 验收项 | 状态 |
| --- | --- |
| 规则识别平胡，且平胡只在未命中其他番型时成立 | 通过（`winning.test.ts`） |
| 玩家可选择胡或过；过只放弃当前机会 | 通过（`winResponse.test.ts` / `session.test.ts`） |
| 胡牌事件不包含主题、横幅样式或特效档等表现字段 | 通过（`winResponse.test.ts`） |
| 表现层将平胡映射为 basic 并在 100 ms 内进入场面调度 | 通过（`winPresentation.test.ts` + e2e） |
| 结算显示赢家、平胡、1 番，并可重播该场面 | 通过（e2e `平胡 claim…`） |

## 主要文件

- `src/core/winning.ts` — `evaluateWin` / 平胡排他
- `src/core/hand.ts` / `types.ts` — 中途胡响应、`HandWon`、`winSettlement`
- `src/play/winPresentation.ts` — 番型 → tier 与场面调度
- `src/game/session.ts` — 会话、平胡 demo、`startNextHand` 赢家连庄
- `src/play/app.ts` / `index.html` — 胡牌结算与横幅

## 本地验证

```bash
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

全部通过。

## 后续

不跳过 review。不自行合回集成线 / `main`。不调用 code-review。
