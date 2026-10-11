# WUF-61 review — 为每名对手接入可选外接 AI

- **Fixed point**: `81ee34f`（`origin/feature/wuf-49-ai-shuanghu-mvp` tip / Work 起点）
- **HEAD**: `13db322` on `feature/wuf-61`
- **Diff**: `git diff 81ee34f...HEAD`（`origin/feature/wuf-49-ai-shuanghu-mvp...feature/wuf-61` at review pin）
- **对照**: issue AC + `implement.md` + ADR-0005 / ADR-0010 + WUF-49 stories 60–68 / 71
- **本地复验**: `vitest` `src/ai/{external,config,router}.test.ts`（11）通过
- **Verdict**: `pass`
- **合回**: 子票 `pass` → merge `feature/wuf-61` → `feature/wuf-49-ai-shuanghu-mvp`（不合入 `main`）

## Standards

### Documented standards

1. **Judgement / residual — ADR-0010（生产仅 HTTPS；应用只请求配置的代理）**  
   `isAllowedProxyUrl` 在 `commitAiSettings` 保存路径强制执行；`rebuildDecisionProvider` / `createExternalDecisionProvider` 在从 storage 重建时不再复检。正常 UI 路径无法写入非法 URL；篡改 localStorage 仍可能触发非策略请求。非阻断。

2. **Judgement — ADR-0010（用户文案集中管理）**  
   Disclosure 正文在 `disclosure.ts`；设置面板标签在 `index.html`，错误文案在 `app.ts`。与既有 play 层模式一致，非阻断。

3. **OK — ADR-0005**  
   可选外接、分座来源、共用代理/模型、可见信息边界、首次告知、20s 并行截止与 easy 回退、令牌仅会话。

4. **OK — ADR-0007 / ADR-0008 / ADR-0009**  
   AI 在决策边界外；Vite/TS/原生 DOM；本 diff 无 gameplay `Math.random`。

### Baseline smells (judgement only)

| Smell | Note |
| --- | --- |
| **Duplicated Code** | `DEFAULT_EXTERNAL_AI_CONFIG` vs `defaultExternalAiConfig()`；`resolveOpponentWinResponses` / `lockOpponentClaimResponses` 同形并行窗口 |
| **Speculative Generality** | `ExternalAiSessionSecrets` 未使用；令牌以 `string` 传递 |
| **Duplicated Code** | disclosure 返回 `title`/`confirmLabel` 等，UI 仍保留部分静态文案 |

No hard documented-standard breach that blocks merge.

## Spec

### (a) Missing / partial

1. **Out of scope — story 122 / action-log 回放不调 AI**  
   Spec: “Replay consumes recorded final actions and never invokes external AI again.” 本子票六条 AC 未覆盖；`feature/wuf-59` 已承载本地存档/导出/developer replay。记为 Demand 级 residual，非本票阻断。

2. **Residual — 首次告知与代理地址**  
   AC: “首次启用展示代理、发送字段和不发送字段，并等待用户确认。” 确认可在代理为「尚未填写」时发生；真正启用仍被 `isAllowedProxyUrl` / model 校验挡住。非阻断。

### (b) Scope creep

1. **Payload 相对 ADR 枚举略宽** — `phase` / `responseTile` / `discarder` / `drawn` 超出 ADR-0005 短列表，但符合 AC「该座位可见局面」与 claim 窗口需要。无无关功能面。

### (c) Looks done but wrong

None material against the six WUF-61 ACs.

| AC | 证据 |
| --- | --- |
| 首次告知 + 确认 | `disclosure.ts` + `showAiDisclosure` / `disclosureAccepted` 门禁 |
| 分座来源、共用代理模型 | `router.ts` + 设置面板 + 单一 `createExternalDecisionProvider` |
| 可见信息边界 | `buildExternalPayload`；测试断言无 `seed`/`wall`/他手 |
| 并行 20s + easy 回退 | `createSharedDeadline` + `Promise.all`；`external.test.ts` |
| 令牌仅会话、不入导出 | `sessionStorage` + `toExportableExternalAiConfig` / `assertNoTokenLeak` |
| 契约测试仅本地 mock | `external.test.ts` mock `fetch`，无真实模型 |

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | ADR-0010 URL 复检 residual + 次要 smells | ADR-0010 load 路径（非阻断） |
| Spec | 六条 AC 满足；story 122 / 空代理确认为 residual | 无阻断项 |

**Verdict `pass`**：可收束；合回 Demand 集成线。
