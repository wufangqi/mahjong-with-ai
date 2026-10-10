# WUF-55 implement — 明杠 / 暗杠 / 加杠与杠上开花

## 结论

工作分支 `feature/wuf-55`（基线 `feature/wuf-49-ai-shuanghu-mvp`）已落地三类杠与杠上开花：

1. **明杠** 响应窗中 `ClaimKong`；优先级高于碰/吃；成立后从牌墙**尾部**补牌，再由杠家出牌。
2. **暗杠 / 加杠** 仅在摸牌后、出牌前开放（`DeclareConcealedKong` / `DeclareAddedKong`）；牌墙无可补牌时不提供杠。
3. **加杠** 升级已有碰，不打开响应窗（不可抢杠胡）。
4. **连续杠** 补牌后若仍合法可继续暗杠/加杠，或出牌 / 自摸。
5. **杠上开花** `lastDrawKind === kong_replacement` 时自摸计 `gangshangkaihua`（1 番，可叠加非平胡番型）；表现层映射 **big**。

## 验收对照

| 验收项 | 状态 |
| --- | --- |
| 明杠优先于碰和吃，暗杠与加杠只在摸牌后出牌前开放 | 通过（`kong.test.ts` / `legalSelfActions`） |
| 加杠不可被抢杠胡 | 通过（无 `ClaimResponseOpened` / `WinResponseOpened`） |
| 杠成立后从牌墙尾部补牌；无补牌可用时不提供杠 | 通过（`wall.pop` / `canKong=false` when empty） |
| 补牌后仍可继续合法杠或出牌 | 通过（连续暗杠用例） |
| 杠上开花计 1 番、可与其他番型叠加并映射 big | 通过（`winning.test.ts` / `winPresentation.test.ts`） |

## 主要文件

- `src/core/claims.ts` — `canKong` / 响应合法性
- `src/core/hand.ts` — 三类杠命令、尾部补牌、`DeclareWin`、`lastDrawKind`
- `src/core/winning.ts` — `gangshangkaihua` 番型
- `src/core/kong.test.ts` — 杠流程接缝测试
- `src/game/session.ts` / `src/play/app.ts` — 会话与杠/自摸 UI
- `src/play/winPresentation.ts` — 杠上开花 → big

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
