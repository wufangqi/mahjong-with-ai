# Domain Docs

How engineering skills should consume this project's domain documentation when exploring the codebase.

## Resolve the aidlc-repo first

Read **`## AIDLC anchors`** in project description for the authoritative **aidlc-repo** (`name` · `url`). Match `url` in `multica workdir show` to get the repo `path`. **Do not guess** which linked repo holds AIDLC material.

| Path kind | Root |
| --- | --- |
| Agent config (`.aidlc/matt/*`) | `<path>/.aidlc/matt/` |
| Issue artifacts (`mt_aidlc_path`, `.aidlc/issues/*`) | `<path>/.aidlc/issues/` |
| Domain glossary / ADRs | `<path>/.aidlc/domain/` |

Further rules: skill **`aidlc-contract`**.

## Using `/domain-modeling`

Upstream **`domain-modeling`** (mp-skills fork) describes generic repo-root layout and discipline. **In Multica projects, paths in this file take precedence:** read and write under `<path>/.aidlc/domain/` (map upstream `CONTEXT.md` → `.aidlc/domain/CONTEXT.md`, `docs/adr/` → `.aidlc/domain/docs/adr/`, multi-context `src/<context>/` → `.aidlc/domain/contexts/<context>/`). Formats follow the skill's `CONTEXT-FORMAT.md` and `ADR-FORMAT.md`.

## Before exploring, read these

At `<path>/.aidlc/domain/` (in order):

1. **`CONTEXT-MAP.md`** if present — read each mapped `CONTEXT.md`
2. else **`CONTEXT.md`**
3. **`docs/adr/`** — system-wide ADRs
4. multi-context: **`contexts/<name>/docs/adr/`** per context

**Legacy fallback** (migrate on `/domain-modeling`):

- `<path>/CONTEXT.md` or `<path>/docs/adr/`

**Supplements** (only when task-relevant; do not iterate all linked repos):

- squad **`CONTEXT.md`** when working under that squad
- business repo **`CONTEXT.md`** when implementing in that repo and the file exists

Missing files → proceed silently; `/domain-modeling` creates them when terms resolve.

## File structure

Single-context (default):

```
<path>/.aidlc/domain/
├── CONTEXT.md
└── docs/adr/
```

Multi-context (`CONTEXT-MAP.md` present):

```
<path>/.aidlc/domain/
├── CONTEXT-MAP.md
├── docs/adr/
└── contexts/
    └── <context>/
        ├── CONTEXT.md
        └── docs/adr/
```

## Use the glossary's vocabulary

Name domain concepts as in `CONTEXT.md`. Gaps → note for `/domain-modeling`.

## Flag ADR conflicts

Contradicting an ADR → surface explicitly:

> _Contradicts ADR-0007 — but worth reopening because…_
