# WUF-61 implement — 可选外接 AI

## 结论

工作分支 `feature/wuf-61` 已从 `origin/feature/wuf-49-ai-shuanghu-mvp` tip 创建并 push。落地每座位独立 easy/外接来源、共用代理与模型、首次启用告知、20 秒并行截止与 easy 回退、会话令牌隔离，以及仅本地 mock 的契约测试。

1. **DecisionProvider 异步化** `src/ai/types.ts` + `PlaySession`：对手决策可并行；响应窗口共用 `createSharedDeadline(20s)`。
2. **外接适配器** `src/ai/external.ts`：OpenAI-compatible chat completions；超时 / 网络 / 畸形 / 非法动作回退 easy。
3. **座位路由** `src/ai/router.ts`：下家/对家/上家可独立选择 easy 或外接；外接座位共用同一 client。
4. **配置与隐私** `src/ai/config.ts`：代理 URL / 模型 / 座位来源 / 告知确认写入 localStorage；令牌仅 sessionStorage，导出接口不含令牌。
5. **首次告知 UI** 主菜单「对手 / 外接 AI」+ disclosure：展示代理、发送字段与明确不发送字段，确认后才启用。
6. **契约测试** `src/ai/external.test.ts`：本地 mock `fetch`（不调用真实模型）覆盖成功、共享截止超时、网络失败、畸形、非法、并行与令牌不入 body。

## 验收对照

| 验收项 | 状态 |
| --- | --- |
| 首次启用展示代理、发送字段和不发送字段，并等待用户确认 | 通过（disclosure UI + `disclosureAccepted` 门禁） |
| 每个座位可独立选择来源，外接座位共用代理和模型配置 | 通过（`router` + 设置面板） |
| 请求只包含该座位可见局面与完整合法动作，不含其他手牌、牌墙或种子 | 通过（`buildExternalPayload` / payload 测试） |
| 多座位响应并行且共用 20 秒截止；错误、超时或非法动作回退 easy | 通过（session 并行 + external 契约测试） |
| 代理令牌只存在当前会话，日志、存档和导出均不包含令牌 | 通过（sessionStorage + `toExportableExternalAiConfig` / assertNoTokenLeak） |
| 契约测试只使用本地 mock 服务，不调用真实模型 | 通过（`external.test.ts` mock fetch） |

## 主要文件

- `src/ai/` — payload、external、router、config、disclosure
- `src/game/session.ts` / `match.ts` — 异步 advance、并行 claim/win 窗口
- `src/play/app.ts` / `index.html` / `src/styles.css` — 设置与告知 UI
- `e2e/smoke.spec.ts` — 适配异步 harness

## 本地验证

```bash
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

全部通过（148 unit + 12 e2e）。

## 后续

不跳过 review。不自行合回集成线 / `main`。不调用 code-review。未改 WUF-59/62 工作分支。
