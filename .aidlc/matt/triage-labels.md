# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to **Multica issue metadata** for this project.

## Multica metadata

Write the state role to issue metadata key **`mt_triage_role`** (and category to **`mt_triage_category`** when applicable):

| Role in mattpocock/skills | `mt_triage_role` value | Meaning                                  |
| ------------------------- | ---------------------- | ---------------------------------------- |
| `needs-triage`            | `needs-triage`         | Maintainer needs to evaluate this issue  |
| `needs-info`              | `needs-info`           | Waiting on reporter for more information |
| `ready-for-agent`         | `ready-for-agent`      | Fully specified, ready for an AFK agent  |
| `ready-for-human`         | `ready-for-human`      | Requires human implementation            |
| `wontfix`                 | `wontfix`              | Will not be actioned                     |

Category: `mt_triage_category` → `bug` | `enhancement`.

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), set `mt_triage_role` to the corresponding value **after human approval** (Workers recommend via `mt_triage_verdict`; humans confirm).

**Matt Team Leader routing note:** for the squad state machine, treat `needs-info` as a subclass of **`ready-for-human`** (缺口 → issue `blocked` → human + `matt-copilot`). Prefer writing formal `mt_triage_role=ready-for-human` when the blocker is missing reporter info; you may still record `needs-info` inside `mt_triage_verdict` for humans.
