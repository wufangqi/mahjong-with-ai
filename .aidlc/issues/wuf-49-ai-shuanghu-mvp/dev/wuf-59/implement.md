# WUF-59 implement — 保存、继续、导出与开发者回放

## 结论

工作分支 `feature/wuf-59` 已相对 `origin/feature/wuf-49-ai-shuanghu-mvp` 合并最新集成 tip，并修复 review 阻断项后 push。

1. **动作后存档** `PersistStore` + `MatchSession.toActiveSave()`：每个完成动作后写入带 `schemaVersion` 与 `handState.rngState` 的当前快照（IndexedDB）。
2. **继续 / 结束** 主菜单「继续最近一场」；主动「结束」归档动作日志并清除当前存档。
3. **版本门禁** `resolveActiveSave`：仅经显式迁移器升级；否则可见拒绝并允许导出旧 blob。
4. **开发者回放** `replayCommands`：按记录的最终合法 `Command` 重放，不调用 DecisionProvider / 外接 AI。
5. **回放不污染存档（返修）** `persistPausedForDevReplay`：`runDevReplay` 在 `restoreFromSave` 之前暂停 `queuePersist`；回放结束回菜单时不 `clearActive` / 不覆盖 `activeSave`，继续目标保持不变。
6. **保留与清理** 当前存档 + 最近 20 场日志；主菜单导出 JSON；清除本地数据（IndexedDB + 主题/画质 localStorage）。

## 验收对照

| 验收项 | 状态 |
| --- | --- |
| 每个完成动作后保存带 schemaVersion 与随机源状态的当前快照 | 通过 |
| 主菜单可继续最近一场，主动结束后当前存档被清除 | 通过；回放不再破坏 continue |
| 旧存档仅在存在明确迁移器时迁移，否则可见拒绝并允许导出 | 通过 |
| 回放使用记录的最终合法动作且不调用外接 AI | 通过 |
| 保留当前存档和最近 20 场日志，并提供导出与清除本地数据 | 通过 |

## Review 返修

- **阻断**：开发者回放经 `restoreFromSave` → `queuePersist` 覆盖 `activeSave`（见 `review.md`）。
- **修复**：`persistPausedForDevReplay` 门闩 + 回放结束不写档；单测 `match.persist.test` + e2e `developer replay does not overwrite the continue save`。
- **顺带**：主菜单文案去掉 glossary Avoid「对局」；已 merge 集成线上的 WUF-61/62（外接 AI / 音效与场面）。

## 主要文件

- `src/persist/` — types / migrate / store / replay / IndexedDB backend
- `src/game/session.ts` — `actionLog`、`commit`、`restore`
- `src/game/match.ts` — `restoreFromSave` / `toActiveSave` / `archiveMeta`
- `src/play/app.ts` / `index.html` — 继续、导出、清除、开发者回放（含 persist pause）
- `e2e/smoke.spec.ts` — continue / replay / incompatible / replay-not-clobber

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

不跳过 review。不自行合回集成线 / `main`。不调用 code-review。
