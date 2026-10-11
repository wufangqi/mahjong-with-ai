# WUF-58 implement — 连续进行一场完整游戏

## 结论

工作分支 `feature/wuf-58` 已从 `origin/feature/wuf-49-ai-shuanghu-mvp` tip 创建并 push，落地主菜单开场、三名 easy 对手与连续多局一场流程。

1. **主菜单开场** `MatchSession` + `#main-menu`：开始一场；第一局庄家由种子随机且可复现；不再启动时自动开局。
2. **easy DecisionProvider** `src/ai/`：对手只见己方手牌与公开信息（牌河/副露/张数/庄/轮/墙余量）及合法动作列表；始终从合法动作中选择；能胡必胡。
3. **连续多局** 结算后「下一局 / 结束」；流局连庄、胡牌按 `nextDealerAfterWin` 换庄；无整场总分/筹码/胜负。
4. **座位** 玩家仍为 `PLAYER_SEAT = 0`，桌面下方；庄家标记移动不旋转视角。

## 验收对照

| 验收项 | 状态 |
| --- | --- |
| 主菜单可开始一场，第一局随机庄且相同种子可复现 | 通过（`match.test.ts` + e2e start-match） |
| 三名 easy 对手只读取自己的手牌与公开信息并始终选择合法动作 | 通过（`seatView.test.ts` / `easy.test.ts`） |
| AI 只要能胡就胡，玩家仍可选择过胡 | 通过（easy + 既有 session 过胡） |
| 每局结算后可下一局或结束，庄家按胡牌或流局规则延续 | 通过（match + e2e 流局连庄 / 结束回菜单） |
| 一场没有总分、筹码或整场胜负，玩家座位始终位于下方 | 通过（MatchSnapshot 无分数字段；PLAYER_SEAT 布局不变） |

## 主要文件

- `src/ai/` — `DecisionProvider`、`buildSeatView`、`createEasyDecisionProvider`
- `src/game/match.ts` — 一场生命周期（menu / in_hand / hand_settled）
- `src/game/session.ts` — 对手决策经 easy 接缝
- `src/play/app.ts` / `index.html` — 主菜单、局数 HUD、结算「结束」
- `e2e/smoke.spec.ts` — 开场 / 下一局 / 结束

## 本地验证

```bash
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

全部通过（137 unit + 12 e2e）。

## 后续

不跳过 review。不自行合回集成线 / `main`。不调用 code-review。
