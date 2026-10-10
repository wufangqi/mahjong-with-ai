# WUF-54 implement — 吃 / 碰 / 过与行牌裁决

## 结论

工作分支 `feature/wuf-54`（基线 `feature/wuf-49-ai-shuanghu-mvp`）已合入中途响应：

1. **合法性** `src/core/claims.ts`：吃仅对出牌者下家；碰对任意非出牌者；多种吃法列出具体手牌 id 对。
2. **规则核心** `src/core/hand.ts`：牌墙未空时的出牌若存在合法响应则打开 `awaiting_claim_response`；先收集再裁决；碰优先于吃；同级按出牌者下家起最近座位；成功后牌河→副露（标明来源），响应者不出摸牌直接出牌；全员过则下家摸打。牌墙耗尽后仍为仅胡/过窗口。
3. **会话** `src/game/session.ts`：AI 选择先写入 `locked`、裁决前不暴露副露变化；无倒计时等待玩家；`autoPlayToDraw` 全员过以保留流局演示。
4. **UI**：响应条提供胡 / 碰 / 吃（多选项）/ 过；桌面渲染副露并高亮被取牌。

## 验收对照

| 验收项 | 状态 |
| --- | --- |
| 吃仅对上家出牌开放，碰对任意出牌者开放 | 通过（`claims.test.ts`） |
| 多种吃法要求明确具体组合 | 通过（`ClaimChow` + UI 选项） |
| 碰优先于吃；同级由离出牌者最近座位成功 | 通过（裁决 + `nearestAfter`） |
| 等待玩家响应不设倒计时；AI 选择不提前暴露 | 通过（收集后裁决；UI 不读对手 `locked`） |
| 成功响应牌入副露并标明来源，响应者随后出牌 | 通过（`MeldFormed` + 不摸牌出牌） |

## 接缝说明

- 明杠 / 暗杠 / 加杠未纳入本切片。
- 中途可胡时进入同一 claim 窗口；终局仍为 win-only。
- 流局结算手牌长度按「暗牌 + 3×副露 = 13」校验。

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

不跳过 review。不自行合回集成线 / `main`。
