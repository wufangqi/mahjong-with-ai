# WUF-59 review — 保存、继续、导出与开发者回放

- **Fixed point**: `81ee34f`（`origin/feature/wuf-49-ai-shuanghu-mvp` tip）
- **HEAD**: `c4b287f` on `feature/wuf-59`
- **Diff**: `git diff origin/feature/wuf-49-ai-shuanghu-mvp...HEAD`
- **对照**: issue AC + `.aidlc/issues/wuf-49-ai-shuanghu-mvp/dev/wuf-59/implement.md` + CONTEXT（存档）+ ADR-0007 / 0010
- **Verdict**: `fail`
- **合入**: 不合入集成线（子票 fail）

## Standards

### Documented standards

1. **Hard — glossary Avoid `对局`**（CONTEXT → **一场** Avoid: `对局`）  
   `index.html` menu blurb: `开始一场本地对局。…` — keep **一场**, drop **对局**.

2. **Judgement / residual — ADR-0010「用户文案集中管理」**  
   New zh-CN in `index.html`（继续/导出/清除/开发者回放）and runtime strings in `src/play/app.ts`. Same split as prior slices; no shared copy module yet.

No other hard breaches vs ADR-0007 / ADR-0010 persistence shape（snapshot + `schemaVersion`, migrator-or-refuse, IndexedDB + export/clear, last-20 logs）. README layering（`core` / `game` / `play`）holds; new `src/persist/` is a reasonable store layer. Tooling-enforced items skipped.

### Baseline smells (all judgement)

1. **Speculative Generality** — `src/persist/types.ts`: `export type LoggedCommand = Command;` unused distinction.
2. **Data Clumps** — `MatchSession.archiveMeta()` return vs `PersistStore.archiveGameLog({ matchSeed, handCount, actionLog, finalHandState })` same field bag.
3. **Repeated Switches** — `src/play/app.ts` `runDevReplay`: long `phase` → `SessionStatus` cascade.
4. **Divergent Change** — `bootPlayApp` gains persist queue, download, clear, and replay UI alongside table/HUD.
5. **Duplicated Code** — clear path: `clearDataBtn` handler vs `__play.clearLocalData` both wipe theme/quality keys + persist.

## Spec

### (a) Missing / partial

1. **导入** — Spec What-to-build: 「支持…导出导入…」。Diff has export/download only; no restore-from-file into IndexedDB. AC5 only requires 「导出与清除」; ADR-0010 「导出或清空」— gap against the description line, not AC5. Non-blocking alone.

2. **Persist trigger wider than「完成动作」** — AC1 / CONTEXT 存档: 「每个完成动作后保存…」/「每个已完成动作后的局面」。`match.subscribe` → `queuePersist` on every hand emit, including `selectTile` / first `clickTile`（selection only）. Soft vs AC1 wording; payload shape（`schemaVersion` + `rngState`）is correct.

### (b) Scope creep

1. **Clear resets theme/quality** — AC5 「清除本地数据」also removes `THEME_*` / `QUALITY_*` localStorage. Aligns with `implement.md` / ADR-0010 settings note; mild extra vs AC5’s focus on 存档 + 20 logs.
2. **Dev-replay JSON helpers** — `extractActionLog` accepts bare arrays, `activeSave.actionLog`, or first `gameLogs[]` entry. Convenience, not harmful.

### (c) Looks done but wrong — **blocking**

1. **Dev replay clobbers continue 存档** — AC2: 「主菜单可继续最近一场」; AC4: developer replay without AI.  
   `runDevReplay` → `match.restoreFromSave` → `match.subscribe` → `queuePersist` writes the replayed terminal state over `activeSave`. A pending continue can be destroyed from the menu without 「结束」.  
   Evidence: `src/play/app.ts` `runDevReplay` + subscribe persist gate (`status !== 'menu'`).

### Covered (no finding)

- AC2 end → `clearActive` + archive log
- AC3 migrator refuse + visible notice + export of incompatible raw
- AC4 `replayCommands`（no `DecisionProvider`）
- AC5 keep 20 logs + export + clear IndexedDB

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | glossary `对局`; copy residual; minor smells | `对局` copy（硬词汇，非功能阻断） |
| Spec | 导入偏描述缺口；subscribe 过宽；**回放覆盖 continue** | **回放覆盖 activeSave（阻断）** |

**Verdict `fail`**. 回修后再审；不合入 `mt_integrate_branch` / `main`。
