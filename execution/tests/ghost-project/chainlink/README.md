# chainlink — Guardrail Chain with Retry Budget

A minimal Python CLI that runs a sequence of named guardrails against a single input string, retrying up to `MAX_ATTEMPTS = 4` times on failure.

## CLI

```
python3 chainlink.py guardrails.txt input.txt
```

- `guardrails.txt` — tab-separated `GUARDRAIL_ID<TAB>TYPE<TAB>PARAM`, one rule per line.
- `input.txt` — exactly one line of text (trailing newline stripped).

## Guardrail Types

| Type | Behaviour |
|------|-----------|
| `transform` | `new_state = PARAM + "\|" + current_state` (prepend with literal pipe) |
| `validate` | pass iff `PARAM` is a substring of `current_state`; fail otherwise |
| `counter_validate` | pass iff `current_attempt_number >= int(PARAM)`; fail otherwise |

## Retry Semantics — The Restart-from-Original Trap

**Every attempt starts from the original input**, not from the prior attempt's terminal state.

This is the critical correctness constraint. A buggy implementation that carries state between attempts would produce `PFX|PFX|PFX|hello` on attempt 3 instead of `PFX|hello`. The golden fixture pins `SUCCESS: PFX|hello`, so any "carry state forward" implementation fails the diff.

### Execution model

```
for attempt in 1..MAX_ATTEMPTS:
    state = original_input          ← reset every attempt
    for guardrail in file_order:
        apply guardrail
        emit "ATTEMPT N PASS at ID" or "ATTEMPT N FAIL at ID"
        on FAIL: break (skip remaining guardrails for this attempt)
    if all passed:
        emit "SUCCESS: <final_state>"
        emit "ATTEMPTS: N"
        exit 0
emit "EXHAUSTED: <last_failed_guardrail_id>"
emit "ATTEMPTS: 4"
exit 0
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success or budget exhaustion — both are defined terminal states |
| `2` | Malformed input: wrong field count, unknown TYPE, duplicate GUARDRAIL_ID, empty files, `counter_validate` PARAM not a positive integer |

## Running Tests

```bash
bash execution/tests/ghost-project/chainlink/tests/run_tests.sh
```

All 6 tests must pass. The first fixture test is the canonical proof of restart-from-original correctness.

## Implementation Notes

**Test status:** PASS 6/6

Key design decisions in `chainlink.py`:

- **Restart-from-original** — `state` is reset to `original_input` at the top of every attempt loop. No state carries between attempts.
- **Transform prepend** — `transform` produces `PARAM + "|" + current_state` using a literal `|` separator; the `\|` in the spec is the escaped representation.
- **`counter_validate` uses `>=`** — passes when `current_attempt_number >= int(PARAM)`, so attempt 3 satisfies a threshold of 3.
- **Exit code 0 for exhaustion** — budget exhaustion is a defined terminal state, not an error; only malformed input returns exit code 2.
- **Tab-separated parsing** — guardrail lines are split on `\t` exactly; lines with wrong field counts trigger exit 2.
