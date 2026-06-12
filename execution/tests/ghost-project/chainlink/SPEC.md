# chainlink SPEC

## Overview

chainlink runs an ordered sequence of named guardrails against a single input string. If any guardrail fails, the entire chain is retried from the beginning, up to `MAX_ATTEMPTS` times. On exhaustion, the program reports the last-failing guardrail ID.

## Constants

```
MAX_ATTEMPTS = 4      # attempts numbered 1..4 inclusive
```

## Input Files

### guardrails.txt
One guardrail per line. Fields separated by a single literal tab character:

```
GUARDRAIL_ID<TAB>TYPE<TAB>PARAM
```

- `GUARDRAIL_ID` — arbitrary non-empty string; must be unique within the file.
- `TYPE` — one of `transform`, `validate`, `counter_validate`.
- `PARAM` — type-specific string parameter.

### input.txt
Exactly one line of text. Trailing newline is stripped. The stripped value is `original_input`.

## Guardrail Type Semantics

### `transform`
Always passes. Mutates state:

```
new_state = PARAM + "|" + current_state
```

The `|` character is a literal pipe. PARAM is prepended, not appended.

### `validate`
Read-only. Passes iff `PARAM` is a substring (Python `in` operator) of `current_state`. Does not mutate state on pass or fail.

### `counter_validate`
Read-only. PARAM must be a positive integer (≥ 1). Passes iff:

```
current_attempt_number >= int(PARAM)
```

Does not mutate state on pass or fail.

## Execution Algorithm

```
for attempt N in 1..MAX_ATTEMPTS:
    state ← original_input           # RESTART FROM ORIGINAL — never carry forward
    for each guardrail (id, type, param) in file order:
        (new_state, passed) ← apply(id, type, param, state, N)
        if passed:
            state ← new_state
            emit: "ATTEMPT N PASS at <id>"
        else:
            emit: "ATTEMPT N FAIL at <id>"
            record last_failed_id ← id
            break                    # skip remaining guardrails for this attempt

    if all guardrails passed:
        emit: "SUCCESS: <state>"
        emit: "ATTEMPTS: N"
        exit 0

# Budget exhausted
emit: "EXHAUSTED: <last_failed_id>"
emit: "ATTEMPTS: 4"
exit 0
```

### Why restart-from-original matters

`state` is reset to `original_input` at the top of every attempt loop. This means:

- Attempt 1: `state = "hello"` → transform → `state = "PFX|hello"`
- Attempt 2: `state = "hello"` → transform → `state = "PFX|hello"` (NOT `"PFX|PFX|hello"`)

A buggy implementation that persists state between attempts would produce an exponentially growing prefix sequence, failing the fixture diff.

## Output Format

All output goes to stdout. One line per event.

| Event | Format |
|-------|--------|
| Guardrail pass | `ATTEMPT N PASS at <id>` |
| Guardrail fail | `ATTEMPT N FAIL at <id>` |
| All guardrails passed | `SUCCESS: <final_state>` |
| Budget exhausted | `EXHAUSTED: <last_failed_id>` |
| Attempt count | `ATTEMPTS: N` |

`SUCCESS:` / `EXHAUSTED:` is always immediately followed by `ATTEMPTS:`.

## Exit Codes

| Code | Condition |
|------|-----------|
| `0` | Normal termination — success OR budget exhaustion |
| `2` | Malformed input — any of: wrong field count per line, unknown TYPE, duplicate GUARDRAIL_ID, empty guardrails file, empty input file, `counter_validate` PARAM not a positive integer |

Error messages on exit 2 go to stderr. No stdout output is emitted before exiting 2.
