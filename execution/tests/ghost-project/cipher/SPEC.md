# Cipher — Token Bucket Rate Limiter Specification

## Purpose

Cipher simulates a token bucket rate limiter against a pre-recorded event log. It is deterministic: given the same capacity, rate, and events file, it always produces identical output. No wall clock is used.

## CLI Contract

```
python3 cipher.py --capacity N --rate R --events FILE
```

| Flag | Type | Description |
|------|------|-------------|
| `--capacity` | positive integer | Maximum number of tokens the bucket can hold |
| `--rate` | non-negative integer | Tokens added per second (in whole tokens only) |
| `--events` | file path | Path to the events file (see format below) |

## Events File Format

Tab-separated, one event per line:

```
TIMESTAMP_MS<TAB>TOKENS_REQUESTED
```

- `TIMESTAMP_MS`: non-decreasing integer (milliseconds)
- `TOKENS_REQUESTED`: positive integer

Blank lines are ignored. Any other formatting is an error.

## Algorithm

**Initial state:**
```
bucket = capacity
last_refill_timestamp = 0
```

**For each event `(ts, tokens_requested)` in file order:**

```
elapsed            = ts - last_refill_timestamp
refill             = (elapsed * rate) // 1000        ← integer floor division
bucket             = min(capacity, bucket + refill)
last_refill_timestamp = ts

if bucket >= tokens_requested:
    print("ALLOW <tokens_requested>")
    bucket -= tokens_requested
else:
    print("DENY <tokens_requested>")
    # bucket unchanged
```

**Critical constraint:** `(elapsed * rate) // 1000` uses Python integer floor division (`//`). Floating-point must not be used anywhere in the refill calculation.

## Constraints

- No wall clock — all time is derived from the events file timestamps.
- Integer arithmetic only for refill computation.
- Bucket never exceeds capacity.
- Bucket never goes negative.
- A request for more tokens than `capacity` is always `DENY` (bucket can never hold enough).

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success — all events processed |
| 2 | Invalid input: non-monotonic timestamps, non-integer arguments, negative capacity/rate, missing events file |
