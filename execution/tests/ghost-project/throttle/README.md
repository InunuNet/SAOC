# ghost-throttle — Sliding-Window Rate Limiter CLI

## Purpose

`throttle.py` applies a **sliding-window** rate limit to a stream of
timestamped JSONL events read from stdin. For each event it emits a one-line
JSON verdict — allowed or denied — together with the number of tokens remaining
in the current window.

## Usage

```
python3 throttle.py --window <seconds> --limit <max_requests> < events.jsonl
```

| Flag | Type | Constraint | Meaning |
|------|------|------------|---------|
| `--window` | int | >= 1 | Sliding window size in seconds |
| `--limit`  | int | >= 1 | Max allowed requests inside any window |

**Input** (stdin): JSONL, one object per line.

```
{"ts": <int_unix_seconds>, "id": "<string>"}
```

`ts` values must be non-decreasing (monotonic timestamps).

**Output** (stdout): One JSONL verdict per input line, same order.

```
{"id": "<string>", "allowed": <bool>, "remaining": <int>}
```

## Algorithm

The implementation maintains a `collections.deque` of timestamps that are
currently inside the sliding window. For each incoming event at time `ts`:

1. **Evict** entries from the left while the deque is non-empty and
   `ts - deque[0] >= window`. The condition is `>=` (inclusive), so an event
   exactly `window` seconds after the oldest entry causes that entry to be
   evicted before the current event is judged.
2. **Allow** the event if `len(deque) < limit`. Append `ts` to the deque.
3. **Deny** the event if `len(deque) >= limit`. The deque is left unchanged.
4. **remaining** = `limit - len(deque)` evaluated *after* the (possible) append.

### Worked Example — DENY With No Deduction

Setup: `--window 10 --limit 3`, four events all at `ts=0`.

| # | id | deque before | allowed | deque after | remaining |
|---|----|-------------|---------|-------------|-----------|
| 1 | r1 | []          | true    | [0]         | 2         |
| 2 | r2 | [0]         | true    | [0, 0]      | 1         |
| 3 | r3 | [0, 0]      | true    | [0, 0, 0]   | 0         |
| 4 | r4 | [0, 0, 0]   | **false** | [0, 0, 0] (unchanged) | 0 |

Event r4 is denied: `len(deque) = 3`, which is not `< limit (3)`.
The deque is **not modified** and `remaining` stays `0`.
A deny never drives `remaining` negative.

## Exit Codes

| Code | Condition |
|------|-----------|
| 0    | Success — all lines processed (including empty input) |
| 1    | Malformed input line OR invalid/missing CLI arguments |

### Worked Example — Boundary Eviction

Setup: `--window 60 --limit 1`. Two events exactly 60 seconds apart.

| # | ts | id | evict step | deque after evict | allowed | deque after | remaining |
|---|----|----|-----------|--------------------|---------|-------------|-----------|
| 1 | 0  | x  | empty | [] | true | [0] | 0 |
| 2 | 60 | y  | 60 - 0 = 60 >= 60 → evict 0 | [] | true | [60] | 0 |

`ts=60` is exactly `window` seconds after `ts=0`, so `ts=0` is evicted before
the second event is judged. Both events are allowed.

## Running Tests

```bash
bash tests/run_tests.sh
```

Runs four golden-fixture tests (basic, deny, boundary, empty). Expected output:

```
PASS: basic (--window 60 --limit 2)
PASS: deny (--window 10 --limit 3)
PASS: boundary (--window 60 --limit 1)
PASS: empty input (no output)

Results: 4 passed, 0 failed
```

## Notes

- Blank and whitespace-only lines in the input are skipped (not treated as
  errors).
- All window arithmetic is integer-only; no floating-point division is used.
- Output booleans are JSON `true`/`false` (Python `True`/`False` serialised by
  `json.dumps`).
- Output key order is fixed: `id`, `allowed`, `remaining`. Golden fixtures match
  byte-for-byte, so key order is load-bearing.
- This is a sliding-window limiter, not a token-bucket limiter. No token
  replenishment rate; the window is purely time-based.
