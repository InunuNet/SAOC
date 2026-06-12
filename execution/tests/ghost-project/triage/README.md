# Triage

Reads stdin (one JSON object per line), validates each record, and emits tab-separated results.

## Usage

```bash
python3 triage.py < input.jsonl
```

## Validation Rules

Each input line must be a JSON object with:

| Field | Type | Constraint |
|-------|------|------------|
| `id` | string | Matches `^[a-z0-9_]+$`, length 1–32 |
| `value` | int | In range `[0, 1000]` inclusive |

## Output Format

One tab-separated line per input line:

```
<id>    OK      <value*2>       # on success
<id>    FAIL    <reason>        # on failure
```

Failure reasons: `parse_error`, `bad_id`, `bad_value`, `missing_id`, `missing_value`

On unparseable JSON or missing `id`, the id field is printed as `?`.

## Exit Code Semantics

- `0` — no failures
- `1–98` — exactly that many failures
- `99` — 99 or more failures (capped)

## Stderr

One summary line at end:

```
processed=<N> ok=<M> failed=<F>
```

## Running Tests

```bash
bash tests/run_tests.sh
```
