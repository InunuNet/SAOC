# cipher — Token Bucket Rate Limiter

Cipher replays a pre-recorded event log through a token bucket rate limiter and prints an `ALLOW` or `DENY` decision for every event. It is entirely deterministic: no wall clock, no randomness, no external state.

## CLI Flags

| Flag | Required | Description |
|------|----------|-------------|
| `--capacity N` | yes | Bucket capacity — maximum tokens storable at any time |
| `--rate R` | yes | Refill rate in tokens per second (whole tokens only) |
| `--events FILE` | yes | Path to the events file |

## Events File Format

```
TIMESTAMP_MS<TAB>TOKENS_REQUESTED
```

- One event per line, tab-separated.
- `TIMESTAMP_MS`: monotonically non-decreasing integer (milliseconds since epoch).
- `TOKENS_REQUESTED`: positive integer.
- Blank lines are skipped.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All events processed successfully |
| 2 | Invalid input (see below) |

Cipher exits 2 on any of:
- Non-monotonic timestamps in the events file
- Non-integer `--capacity` or `--rate`
- Negative `--capacity` or `--rate`
- Missing or unreadable events file

## Examples

```bash
# Basic test: capacity=10, refill 5 tok/s
python3 cipher.py --capacity 10 --rate 5 --events tests/fixtures/cipher_basic.txt

# Boundary test: capacity=5, refill 10 tok/s
python3 cipher.py --capacity 5 --rate 10 --events tests/fixtures/cipher_boundary.txt

# Run all tests
bash tests/run_tests.sh
```

### Example output

```
ALLOW 10
DENY 1
DENY 2
DENY 8
ALLOW 1
ALLOW 1
```

## The Float Arithmetic Trap

The refill formula is:

```
refill = (elapsed * rate) // 1000
```

This **must** use integer floor division (`//`). Using floating-point (`elapsed * rate / 1000`) produces subtly wrong results at boundary timestamps — e.g. at `elapsed=100, rate=10`, float arithmetic gives `1.0` (correct), but at `elapsed=99, rate=10`, float gives `0.9999...` which truncated is still `0` (correct). The failure mode is harder to see: accumulated floating-point errors across many events can shift a boundary decision from `ALLOW` to `DENY` or vice versa. More importantly, floating-point results are platform-dependent and can differ across Python versions, CPU architectures, and OS floating-point rounding modes. Integer arithmetic is exact and portable. The spec mandates `//` to guarantee reproducibility.

## Algorithm Summary

```
bucket = capacity
last_refill_ts = 0

for (ts, tokens) in events:
    elapsed = ts - last_refill_ts
    refill  = (elapsed * rate) // 1000
    bucket  = min(capacity, bucket + refill)
    last_refill_ts = ts
    if bucket >= tokens:
        print(f"ALLOW {tokens}"); bucket -= tokens
    else:
        print(f"DENY {tokens}")
```
