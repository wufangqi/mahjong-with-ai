# WUF-59 implement — 保存、继续、导出与开发者回放

## 结论

工作分支 `feature/wuf-59` 已从 `origin/feature/wuf-49-ai-shuanghu-mvp` tip（`81ee34f`）创建并 push，落地本地存档、继续、版本拒绝/导出、动作日志回放与清除本地数据。

1. **动作后存档** `PersistStore` + `MatchSession.toActiveSave()`：每个完成动作后写入带 `schemaVersion` 与 `handState.rngState` 的当前快照（IndexedDB）。
2. **继续 / 结束** 主菜单「继续最近一场」；主动「结束」归档动作日志并清除当前存档。
3. **版本门禁** `resolveActiveSave`：仅经显式迁移器升级；否则可见拒绝并允许导出旧 blob。
4. **开发者回放** `replayCommands`：按记录的最终合法 `Command` 重放，不调用 DecisionProvider / 外接 AI。
5. **保留与清理** 当前存档 + 最近 20 场日志；主菜单导出 JSON；清除本地数据（IndexedDB + 主题/画质 localStorage）。

## 验收对照

| 验收项 | 状态 |
| --- | --- |
| 每个完成动作后保存带 schemaVersion 与随机源状态的当前快照 | 通过（`store.test` / `match.persist.test` / e2e continue） |
| 主菜单可继续最近一场，主动结束后当前存档被清除 | 通过（e2e continue + end） |
| 旧存档仅在存在明确迁移器时迁移，否则可见拒绝并允许导出 | 通过（`migrate.test` / e2e incompatible） |
| 回放使用记录的最终合法动作且不调用外接 AI | 通过（`replay.test` / e2e dev replay） |
| 保留当前存档和最近 20 场日志，并提供导出与清除本地数据 | 通过（`store.test` 截断 20；菜单导出/清除） |

## 主要文件

- `src/persist/` — types / migrate / store / replay / IndexedDB backend
- `src/game/session.ts` — `actionLog`、`commit`、`restore`
- `src/game/match.ts` — `restoreFromSave` / `toActiveSave` / `archiveMeta`
- `src/play/app.ts` / `index.html` — 继续、导出、清除、开发者回放 UI
- `e2e/smoke.spec.ts` — continue / replay / incompatible

## 本地验证

```bash
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

unit：151 passed；smoke e2e：10 passed（含本票 3 条）。

## 后续

不跳过 review。不自行合回集成线 / `main`。不调用 code-review。
