# SPEC: tempo

## One-liner

Deterministic backoff scheduler that computes exponential backoff delays with optional seeded jitter from a JSON input on stdin.

## Requirements

- Reads a single JSON object from stdin; no positional arguments.
- Input fields: `attempt` (int >= 1), `base_ms` (int >= 1), `max_ms` (int >= base_ms), `seed` (int >= 0), `jitter` (string, one of `"none"` or `"full"`).
- Any missing field, wrong type, out-of-range value, or `max_ms < base_ms` causes exit 1 with empty stdout.
- Raw delay formula: `raw = base_ms * 2^(attempt - 1)`.
- Capped delay: `capped_delay = min(raw, max_ms)`.
- `capped` is `True` if and only if `raw > max_ms` (strict greater-than; `raw == max_ms` yields `capped=False`).
- When `jitter="none"`: `delay_ms = capped_delay`.
- When `jitter="full"`: seed `random.Random(seed)`, call `.random()` exactly `attempt` times, use the last value `r`, then `delay_ms = math.floor(r * capped_delay)`.
- No wall-clock calls (`time.time`, `datetime.now`) are ever made.
- Output is a single JSON object: `{"attempt": <int>, "capped": <bool>, "delay_ms": <int>}`.
- Output is printed with `sort_keys=True`, no spaces around separators, followed by a trailing newline.
- Running the same input twice must produce byte-identical output.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Validation error — missing field, wrong type, constraint violated, or `max_ms < base_ms` |

## Pre-seeded Traps

- **`capped` boundary condition**: `raw == max_ms` must yield `capped=False`. Using `>=` instead of `>` will incorrectly mark exact-match attempts as capped.
- **Jitter call count**: `.random()` must be called exactly `attempt` times, not once. The call sequence advances PRNG state; the *last* call's value is used. Calling once always produces the seed's first value, breaking determinism for attempt > 1.
- **Using `random.seed()` on the global instance**: Must use `random.Random(seed)` (a fresh private instance), not `random.seed()`. The global instance is shared and non-deterministic in a real environment.
- **`delay_ms` type**: Output `delay_ms` must be an integer. `math.floor()` returns an int in Python 3, but multiplying floats and truncating with `int()` risks off-by-one on edge values.
- **`attempt=0` not rejected**: The constraint is `attempt >= 1`. Zero is a common off-by-one assumption; it must exit 1.
- **Wall-clock dependency**: Any call to `time.time()` or `datetime.now()` makes output non-deterministic across runs and must not appear in the implementation.
- **JSON output spacing**: Default `json.dumps()` adds spaces. Must pass `separators=(",",":")`.

## Binary Test Assertion Table

| # | Test name | What it tests | Expected outcome |
|---|-----------|---------------|-----------------|
| 1 | in_a → expected_a | No jitter, no cap: `attempt=3, base=100` → delay=400 | stdout matches fixture, exit 0 |
| 2 | in_b → expected_b | No jitter, capped: raw exceeds max_ms → delay=5000 | stdout matches fixture, exit 0 |
| 3 | in_c → expected_c (shell) | Full jitter, `attempt=1`, PRNG=0.639 → delay=639 | stdout matches fixture, exit 0 |
| 4 | diff in_c → expected_c | Golden file diff of jitter case | diff exit code 0 |
| 5 | in_d → expected_d | Full jitter, `attempt=3`, PRNG r=0.275 → delay=1100 | stdout matches fixture, exit 0 |
| 6 | diff in_d → expected_d | Golden file diff of multi-call jitter | diff exit code 0 |
| 7 | in_e → expected_e | Boundary: `raw == max_ms` → capped=false | stdout matches fixture, exit 0 |
| 8 | boundary raw==max_ms → capped=false | Strict `>` boundary enforcement | `capped=False` and `delay_ms=8000` |
| 9 | capped=true when raw > max_ms | Cap flag when raw exceeds max | `capped=True` and `delay_ms=5000` |
| 10 | determinism: two runs on in_d identical | No wall-clock or global state in output | Both runs produce identical stdout |
| 11 | attempt=0 → exit 1, stdout empty | Constraint validation: attempt >= 1 | Exit code 1, stdout empty |
| 12 | max_ms < base_ms → exit 1 | Constraint validation: max_ms >= base_ms | Exit code 1, stdout empty |
