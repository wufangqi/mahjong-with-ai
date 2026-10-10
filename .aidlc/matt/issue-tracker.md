# Issue tracker: Multica

Issues and specs for this project live as Multica issues. Use the `multica` CLI for all operations. This is the only tracker for **Matt Team**.

## Conventions

- **Create an issue**: `multica issue create --title "..." --description-file <path> [--project <project-id>] [--parent <parent-id>] [--stage N] [--status todo|backlog]`. `parent-id` is the UUID `id` from `issue get`, not `identifier`.
- **Read an issue**: `multica issue get <key-or-id> --output json`
- **List children**: `multica issue children <parent-id> --output json` — grouped by `--stage`
- **Comment on an issue**: `multica issue comment add <key> --content-file <path>`
- **List comments**: `multica issue comment list <issue-id> [--recent N] --output json`
- **Update an issue**: `multica issue update <id> [--title ...] [--description-file <path>]`
- **Status**: `multica issue status <id> <todo|backlog|in_progress|in_review|done|blocked|cancelled>`
- **Assign**: `multica issue assign <key> --squad "<Squad Name>"` — sets owner (`assignee_type=squad`)
- **Metadata**: `multica issue metadata list <issue-id> --output json`; `metadata set --key <k> --value <v>`; `metadata delete --key <k>`
- **Close**: `multica issue status <id> done`

Infer `project_id` from the current or parent issue (`issue get` JSON). Never invent an issue key — use the key the caller already has.

Triage state is metadata, not labels: `mt_triage_category`, `mt_triage_role` (role strings in `.aidlc/matt/triage-labels.md`). `worker-triage` writes `mt_triage_verdict`; humans confirm before `mt_triage_role` is written.

Long artifacts live on disk; the issue body or a comment holds a pointer, not the document.

`--stage N` (N ≥ 1) groups siblings into waves. No `--stage` is one implicit wave. The parent squad's leader is woken when every child in the lowest unfinished stage is `done` or `cancelled` (or, with no `--stage`, when the last sibling finishes).

- **`backlog`** — owner is the squad; no leader task fires.
- **`todo`** — `backlog → todo` enqueues the squad leader (owner stays the squad).
- **`done` on a child** — system comment on the parent; combines with `--stage` for the barrier wake.
- **`cancelled`** — terminal like `done` for barriers; does not stop tasks already in flight.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this project treats external PRs as feature requests; `/triage` reads this flag.)_

Matt Team tracks work on Multica issues only. When a run produces a PR in a linked GitHub repo, put a routable issue key in the PR **title, body, or branch**. Use `Closes <KEY>` (keyword adjacent to the key) only when merge should set the issue to `done`. Read link state with `multica issue pull-requests <issue-id> --output json` — do not infer from branch names or stale `pr_url` metadata.

## When a skill says "publish to the issue tracker"

Create a Multica issue.

## When a skill says "fetch the relevant ticket"

Run `multica issue get <key-or-id> --output json` and `multica issue comment list <issue-id> --output json`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: the issue you are working in, metadata `mt_wayfinder_map=true`. Body holds Notes / Decisions-so-far / Fog.
- **Child ticket**: `multica issue create --parent <map-id>` with metadata `mt_wayfinder_type` → `research` | `prototype` | `grilling` | `task`.
- **Blocking**: the platform's native issue dependency when available; otherwise `Blocked by: <child-keys>` at the top of the child description. A ticket is unblocked when every blocker is `done` or `cancelled`.
- **Frontier query**: `multica issue children <map-id> --output json`, drop any with an open blocker or an assignee; when `--stage` is used, keep only the lowest unfinished stage. First in map order wins.
- **Claim**: `multica issue assign` to the driving human, or metadata `mt_claimed_by` — the session's first write.
- **Resolve**: comment the answer, `multica issue status <id> done`, then append a one-line pointer to the map's Decisions-so-far.
