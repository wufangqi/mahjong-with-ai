# WUF-59 review — 保存、继续、导出与开发者回放

- **Fixed point**: `65af38b`（`origin/feature/wuf-49-ai-shuanghu-mvp` tip，含 WUF-61/62）
- **HEAD**: `684482d` on `feature/wuf-59`（返修 + merge 集成 tip）
- **Diff**: `git diff origin/feature/wuf-49-ai-shuanghu-mvp...HEAD`
- **对照**: issue AC + 更新后 `implement.md` + 先前 `review.md` 阻断 + CONTEXT（存档）+ ADR-0007 / 0010
- **本地复验**: vitest — `match.persist` / `store` / `migrate` / `replay`（15）通过
- **Verdict**: `pass`
- **合入**: 子票 pass → 合入 `feature/wuf-49-ai-shuanghu-mvp`（不合 `main`）

## 复审：先前阻断

| 阻断 | 状态 | 证据 |
| --- | --- | --- |
| Dev replay → `restoreFromSave` → `queuePersist` 覆盖 `activeSave`（AC2） | **CLOSED** | `persistPausedForDevReplay` 在 `runDevReplay` 内、restore 前设 true；`queuePersist`/`flushPersist` early-return；回放结束 `endCurrentMatch` 不 `clearActive`；e2e `developer replay does not overwrite the continue save`；unit `match.persist.test` |
| glossary Avoid `对局`（Standards hard） | **CLOSED** | `index.html` → `开始一场本地游戏。…可继续最近一场。` |

## Standards

### Documented standards

1. **OK — glossary Avoid `对局`**（CONTEXT → **一场**）  
   Menu blurb fixed; no `对局`. Soft residual: `随机庄`（**庄家** Avoid: `庄`）— same as earlier menus, non-blocking.

2. **Judgement / residual — ADR-0010「用户文案集中管理」**  
   Persist UI still split: `index.html` static zh-CN + `src/play/app.ts` runtime strings. No shared copy module.

3. **OK — ADR-0007 / ADR-0010 persistence / README layering**  
   Snapshot + `schemaVersion`, migrator-or-refuse, IndexedDB + export/clear, last-20 logs; `src/persist/` store layer.

### Baseline smells (judgement only)

| Smell | Note |
| --- | --- |
| **Speculative Generality** | `LoggedCommand = Command` thin alias |
| **Data Clumps** | `archiveMeta` bag ↔ `archiveGameLog` params |
| **Repeated Switches** | `runDevReplay` phase → `SessionStatus` |
| **Divergent Change** | `bootPlayApp` owns persist + replay + table/HUD |
| **Duplicated Code** | `clearDataBtn` vs `__play.clearLocalData` |

无硬性 documented-standard 阻断。

## Spec

### AC2 replay-clobber — CLOSED

**Spec (AC2):** 「主菜单可继续最近一场，主动结束后当前存档被清除」

Evidence: pause before restore; persist writers gated; end-from-replay leaves IndexedDB continue intact; e2e resumes mid `rngState` / river after replay+结束.

### (a) Missing / partial（soft）

1. **导入** — What-to-build 「导出导入」; AC5 / ADR-0010 only 导出与清除. Export-only; non-blocking vs AC5.
2. **Persist wider than「完成动作」** — AC1 / CONTEXT wording; `subscribe` also persists selection. Payload shape correct; soft.

### (b) Scope creep

Clear also resets theme/quality localStorage (ADR-0010 / `implement.md`). Dev-replay JSON helpers.

### (c) Looks done but wrong

None remaining after the pause + end-without-clearActive fix.

### AC → evidence

| AC | Evidence |
| --- | --- |
| 1 schemaVersion + rng 快照 | `toActiveSave` / `store.test` / e2e continue |
| 2 继续 / 结束清档；回放不破坏 | end→`clearActive`；pause + e2e not-clobber |
| 3 迁移器或拒绝 + 导出 | `migrate` / e2e incompatible |
| 4 最终合法动作回放、无外接 AI | `replayCommands` / `replay.test` |
| 5 当前存档 + 最近 20 场 + 导出/清除 | `MAX_GAME_LOGS` / menu export+clear |

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | copy residual + prior smells；`对局` CLOSED | ADR-0010 copy（非阻断） |
| Spec | AC2 阻断 CLOSED；导入/selection soft | 无阻断项 |

**Verdict `pass`**. 合入 `mt_integrate_branch`；不合 `main`。
