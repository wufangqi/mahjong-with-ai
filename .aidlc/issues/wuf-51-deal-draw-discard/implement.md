# WUF-51 implement — 发牌、摸牌与玩家出牌

## 结论

单票 integration 路径已在 `feature/wuf-51-deal-draw-discard` 落地可演示的发牌 / 摸牌 / 出牌纵切：

1. **规则核心** `src/core/`：136 实体牌、可序列化种子 RNG、发牌、摸牌、出牌；命令返回新状态 + 领域事件（ADR-0007 / ADR-0009）。
2. **会话** `src/game/session.ts`：开局后自动推进非玩家座位至玩家出牌回合；玩家二次点击或拖入牌河确认出牌，确认后不可撤销。
3. **牌局入口**：根目录 `index.html` 启动 3D 桌面；效果预览迁至 `preview.html`（WUF-50 基线保留）。
4. **守恒**：任意发牌 / 摸牌 / 出牌后实体牌总数保持 136。

## 验收对照

| 验收项 | 状态 |
| --- | --- |
| 相同种子生成相同实体牌、庄家、牌墙和发牌结果 | 通过（`src/core/hand.test.ts`） |
| 庄家起手 14 张并先出牌，其他家起手 13 张 | 通过 |
| 玩家手牌自动排序且刚摸牌位于最右侧 | 通过（`displayHand` + 会话 ensureDrawn） |
| 玩家可二次点击或拖入牌河确认合法出牌，确认后不可撤销 | 通过（单元 + Playwright） |
| 出牌事件更新规则状态、手牌和牌河，实体牌总数保持 136 | 通过 |

## 接缝说明

本切片在**玩家第一次确认出牌**后将 `phase` 置为 `discard_complete`，完整摸打循环与流局属 WUF-52。会话在到达玩家回合前，对非玩家座位本地重开 `awaiting_discard` 以推进，不扩展响应/吃碰杠。

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

不跳过 review。完整四家摸打至流局、响应窗口与番型属后续切片。
