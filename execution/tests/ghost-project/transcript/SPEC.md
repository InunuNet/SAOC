# Transcript SPEC — Tool-Call/Observation Pairing Validator

## Overview

Transcript reads a JSONL event stream and validates that every `action` event is paired with exactly one `observation`, in the correct order, before the containing group closes.

---

## Input Format

Newline-delimited JSON. Each non-empty line must be a valid JSON object with an `event` field. Three event types:

| Type | Required fields |
|------|----------------|
| `action` | `event`, `id`, `tool`, `group` |
| `observation` | `event`, `tool_call_id`, `status` |
| `message` | `event`, `role`, `text` |

Any other `event` value is silently ignored (forward-compatible).

Missing required fields → exit 2 (malformed input). Malformed JSON → exit 2.

---

## Scanning Algorithm

Process events in file order (1-indexed line numbers).

### State maintained

```
current_group       : str | None        # active group id
current_group_actions : list[str]       # action ids in declaration order (current group)
current_group_obs_position : int        # how many observations have arrived in current group
all_actions         : dict[id → info]   # global registry of all seen actions
observed_ids        : set[str]          # all tool_call_ids that have been observed
violations          : list              # (lineno, type, message)
```

### Per-event processing

**On `action` event:**
1. If `group != current_group`:
   - Call `close_group(current_group, current_group_actions)` (see below)
   - Set `current_group = group`, reset `current_group_actions = []`, `current_group_obs_position = 0`
2. Record action: `position = len(current_group_actions)`, append id to list, store in `all_actions`

**On `observation` event:**
1. If `tool_call_id` not in `all_actions` → emit `ID_MISMATCH` at current lineno. Stop processing this event.
2. If action's group != `current_group` → emit `ORPHAN_OBSERVATION` at current lineno. Stop.
3. If `tool_call_id` in `observed_ids` → emit `DUPLICATE_OBSERVATION` at current lineno. Stop.
4. Compare `current_group_obs_position` (arrival position) vs action's `position` (declaration position):
   - If not equal → emit `ORDER_VIOLATION` at current lineno.
5. Add `tool_call_id` to `observed_ids`.
6. Increment `current_group_obs_position`.

**On `message` event:** no action taken.

**At EOF:**
- Call `close_group(current_group, current_group_actions)` for the final group.

### Group-close semantics

`close_group(group_id, action_ids)`:
- For each action id in `action_ids`:
  - If id not in `observed_ids`: emit `MISSING_OBSERVATION` at the action's original lineno.

Group close fires at two points:
1. When a new `action` arrives with a different `group` than the current one.
2. At EOF after all events are processed.

---

## Violation Type Definitions

### MISSING_OBSERVATION
- **Trigger**: group closes (new group starts or EOF) and an action was never observed.
- **Event index**: lineno of the unobserved `action`.
- **Message**: `action <id> in group <group> has no matching observation`

### ORPHAN_OBSERVATION
- **Trigger**: `tool_call_id` resolves to a real action, but that action's group is no longer `current_group`.
- **Event index**: lineno of the `observation`.
- **Message**: `observation for <id> arrived after group <group> was closed`

### DUPLICATE_OBSERVATION
- **Trigger**: `tool_call_id` already present in `observed_ids`.
- **Event index**: lineno of the second (duplicate) `observation`.
- **Message**: `tool_call_id <id> already observed`

### ORDER_VIOLATION
- **Trigger**: observation arrival position within the group differs from action declaration position.
- **Event index**: lineno of the `observation`.
- **Message**: `observation for <id> arrived at group <group> position <obs_pos> but action <id> has position <action_pos>`
- Note: the action is still counted as observed (added to `observed_ids`) to avoid cascading `MISSING_OBSERVATION` for the same id.

### ID_MISMATCH
- **Trigger**: `tool_call_id` not found in `all_actions` (global scope — any group, any position).
- **Event index**: lineno of the `observation`.
- **Message**: `observation tool_call_id <id> matches no prior action`

---

## Violation Sort Order

All violations are sorted by `event_index` ascending before output. When two violations share the same line (not possible under normal circumstances), their relative order is implementation-defined.

---

## Output Format

```
VIOLATION <event_index> <TYPE>: <message>
...
VALID
```
or
```
VIOLATION <event_index> <TYPE>: <message>
...
INVALID: <N> violations
```

Final line is always either `VALID` or `INVALID: N violations`.

---

## Exit Codes

| Code | Condition |
|------|-----------|
| `0` | Normal completion (VALID or INVALID) |
| `2` | Malformed JSON on any line, or missing required field for a known event type |

---

## Design Decisions

1. **Group-close at first differing group, not at explicit close token** — groups are implicit; they close when a new group starts or EOF is reached. This matches real LLM transcript structure.

2. **ORDER_VIOLATION does not prevent further observation of same id** — once a violation is recorded, the id is still marked observed so it doesn't also produce MISSING_OBSERVATION.

3. **ID_MISMATCH stops further checks for that observation** — an observation with no matching action cannot be ORPHAN or DUPLICATE; those checks require a known action.

4. **MISSING_OBSERVATION lineno is the action's lineno, not the group-close lineno** — the violation belongs to the action that was skipped, not to the trigger.

5. **stdlib only** — no third-party dependencies. Uses only `json` and `sys`.
