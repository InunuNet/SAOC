# SPEC: triage

## One-liner

JSONL validator that reads one JSON object per line from stdin, validates each record, and emits tab-separated results with a capped exit code reflecting the number of failures.

## Requirements

- Reads stdin line by line; each line is processed independently.
- Each line must be a JSON object with exactly the following validated fields:
  - `id`: string matching `^[a-z0-9_]+$`, length 1–32 inclusive.
  - `value`: integer in the range `[0, 1000]` inclusive.
- For valid records: output `<id>\tOK\t<value*2>` to stdout.
- For invalid records: output `<id>\tFAIL\t<reason>` to stdout; `id` is printed as `?` when unparseable or when `id` is absent.
- Failure reasons (exactly, in priority order): `parse_error`, `bad_id`, `bad_value`, `missing_id`, `missing_value`.
- After processing all lines, prints a single summary line to stderr: `processed=<N> ok=<M> failed=<F>`.
- Exit code equals the number of failed records, capped at 99: exit 0 if no failures, exit 1–98 for that exact count, exit 99 for 99 or more failures.
- Processing continues through all lines regardless of errors — no early exit on failure.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All records valid |
| 1–98 | Exactly that many records failed validation |
| 99 | 99 or more records failed (capped) |

## Pre-seeded Traps

- **Exit code cap**: The exit code must not exceed 99. A naive `sys.exit(failures)` will produce exit code 100 or 150 for large inputs. Must be `sys.exit(min(failures, 99))`.
- **`value*2` for OK output**: The third column for a valid record is not `value` but `value * 2`. Emitting the raw value fails the test.
- **Missing `id` in unparseable lines**: When the entire line cannot be parsed as JSON, the `id` must be printed as `?`, not omitted and not as an empty string.
- **`id` type coercion**: `id` must be a string type. A JSON integer `1` is not a valid id even if it looks like a valid pattern character. Type-check before regex.
- **`value` type**: `value` must be an integer, not a float. `1000.0` should be treated as `bad_value` (or detected as non-integer).
- **Inclusive boundaries**: `value=0` is valid (low boundary); `value=1000` is valid (high boundary). Using `< 1000` or `> 0` instead of `<= 1000` and `>= 0` will incorrectly reject boundary values.
- **Tab separator, not space**: All three fields are separated by a tab character (`\t`). Using spaces fails the exact-match test.
- **stderr summary goes to stderr, not stdout**: The `processed=N ok=M failed=F` line must go to `sys.stderr`, not `sys.stdout`.
- **Failure reason priority**: When both `id` and `value` are missing, `missing_id` takes precedence over `missing_value`. Check fields in priority order.

## Binary Test Assertion Table

| # | Test name | What it tests | Expected outcome |
|---|-----------|---------------|-----------------|
| 1 | exit code is 5 | Exit code equals failure count | Exit code 5 |
| 2 | stdout matches expected.txt | Full stdout exact match | Byte-identical to fixture |
| 3 | stderr matches expected.stderr | Summary line format | Matches `processed=N ok=M failed=F` |
| 4 | cap_input.jsonl exit 99 | Exit code capped at 99 | Exit code 99, not 100 or 150 |
| 5 | alpha line → OK | Valid record output format | `alpha\tOK\t10` |
| 6 | unparseable line → ? FAIL parse_error | JSON parse error handling | `?\tFAIL\tparse_error` |
| 7 | ok2 value=1000 → 2000 | Inclusive upper boundary + value*2 | `ok2\tOK\t2000` |
| 8 | ok5 value=0 → 0 | Inclusive lower boundary + value*2 | `ok5\tOK\t0` |
| 9 | BadCaps → FAIL bad_id | Uppercase chars rejected by regex | `BadCaps\tFAIL\tbad_id` |
| 10 | ok3 value=1001 → FAIL bad_value | Out-of-range value | `ok3\tFAIL\tbad_value` |
| 11 | missing id → ? FAIL missing_id | Record with no id field | `?\tFAIL\tmissing_id` |
| 12 | missing value → ok4 FAIL missing_value | Record with no value field | `ok4\tFAIL\tmissing_value` |
