---
name: write-contract
description: Canonical contract.yaml schema reference — every required field, every common pitfall, copy-paste-ready template that passes contract.py validate --strict on the first try.
usage: Invoke this skill when @architect needs to write a contract for a new feature or mission. Replaces the inline schema duplicated in architect.md.
---

# write-contract

Canonical schema for `.agent/memory/project/specs/<slug>/contract.yaml`. The architect agent must produce one of these for every substantive task. Schema bugs are documented 5+ times in learned.md — this skill eliminates them.

## Required fields

| Field | Type | Notes |
|-------|------|-------|
| `schema` | string | Always `athanor.contract/v1` |
| `slug` | string | NOT `spec:` — mission slug, no date prefix, no `.md` |
| `goal` | string | One sentence |
| `created_at` | string | `'YYYY-MM-DD'` quoted |
| `autonomy` | string | `high` / `medium` / `low` |
| `features` | list | Each `{id, name, status}` |
| `goldens` | list | Paths under `.agent/memory/project/specs/<slug>/goldens/` |
| `assertions.phase` | int | `4` — integer, NOT `"4"` |
| `assertions.checks` | list | Each `{id, description, command}` |

## Canonical template

```yaml
schema: athanor.contract/v1
slug: my-feature
goal: One sentence describing what success looks like.
created_at: '2026-05-22'
autonomy: high

features:
  - id: F1
    name: short feature description
    status: pending

goldens:
  - .agent/memory/project/specs/my-feature/goldens/example.md

assertions:
  phase: 4
  checks:
    - id: A1
      description: file exists
      command: test -f path/to/file
    - id: A2
      description: file contains pattern
      command: grep -q "pattern" path/to/file
```

## Common bugs this skill prevents

- `spec:` instead of `slug:` — the validator rejects `spec:`
- `verify.cmd:` instead of `command:` — old field name, never accepted
- `phase: "4"` (string) instead of `phase: 4` (int)
- Multi-line `python3 -c` in a `command:` value — quoting breaks YAML and the gate runner
- Duplicate assertion IDs (`A1` twice) — validator fails
- `command:` with `&&` chains — works but split into separate checks for clearer gate output

## Validation

Always run before claiming done:

```bash
python3 execution/contract.py validate .agent/memory/project/specs/<slug>/contract.yaml --strict
```

## Related

- `.agent/agents/architect.md` — the agent that must use this
- `execution/contract.py` — the validator + gate runner
