# Transcript — Tool-Call/Observation Pairing Validator

Transcript validates that every `action` event in a JSONL transcript has exactly one matching `observation`, in the correct order, within the correct group boundary. It is an Athanor ghost project for validating the factory pipeline.

---

## The Delayed-Failure Trap

The core challenge Transcript detects is the **delayed-failure trap**: a tool call (`action`) may appear to succeed because a later observation arrives — but that observation might belong to a different call, arrive out of order, or never arrive at all. Transcript enforces strict pairing semantics:

- Every action must be observed exactly once.
- Observations must arrive in the same order actions were declared.
- Observations must arrive before the group closes (a new group starting = old group closed).
- A group closes at the next action from a different group, or at EOF.

---

## The Five Violation Types

| Type | When it fires |
|------|--------------|
| `MISSING_OBSERVATION` | A group closes (next group starts or EOF) and an action in it was never observed |
| `ORPHAN_OBSERVATION` | An observation's `tool_call_id` matches a real action, but that action's group is already closed |
| `DUPLICATE_OBSERVATION` | Two observations have the same `tool_call_id` |
| `ORDER_VIOLATION` | Within a group, observations arrive in a different order than the actions were declared |
| `ID_MISMATCH` | An observation's `tool_call_id` matches no action anywhere in the file |

---

## CLI

```bash
python3 transcript.py events.jsonl
```

Input: a newline-delimited JSON file (`.jsonl`). Each line is one event.

Output: violations sorted by line number, then a final summary line.

```
VIOLATION 3 MISSING_OBSERVATION: action tc2 in group resp1 has no matching observation
VIOLATION 6 ID_MISMATCH: observation tool_call_id tcX matches no prior action
INVALID: 2 violations
```

If no violations: `VALID`

---

## Event Schema

Three event types are recognized. All require the `event` field.

**action** (required: `id`, `tool`, `group`)
```json
{"event": "action", "id": "tc1", "tool": "bash", "group": "resp1"}
```

**observation** (required: `tool_call_id`, `status`)
```json
{"event": "observation", "tool_call_id": "tc1", "status": "ok"}
```

**message** (required: `role`, `text`) — pass-through, not validated for pairing
```json
{"event": "message", "role": "user", "text": "run two commands"}
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Normal completion (with or without violations) |
| `2` | Malformed JSONL or missing required field — no output produced |

Violations do **not** affect the exit code. Only structural errors (bad JSON, missing fields) cause exit 2.

---

## Testing

```bash
bash execution/tests/ghost-project/transcript/tests/run_tests.sh
```

Six assertions covering: MISSING_OBSERVATION, ID_MISMATCH, ORDER_VIOLATION, DUPLICATE_OBSERVATION, all-message (VALID), malformed JSON (exit 2), missing field (exit 2), single-action no observation.

---

## Dependencies

- Python 3.10+ (stdlib only: `json`, `sys`)
- No third-party packages required.
