# Tempo — Deterministic Backoff Scheduler

Tempo computes exponential backoff delays with optional deterministic jitter.

## Usage

```bash
echo '{"attempt":3,"base_ms":100,"max_ms":10000,"seed":42,"jitter":"none"}' | python3 tempo.py
# {"attempt":3,"capped":false,"delay_ms":400}
```

Input (JSON, stdin):

| Field | Type | Constraints |
|-------|------|-------------|
| `attempt` | int | >= 1 |
| `base_ms` | int | >= 1 |
| `max_ms` | int | >= base_ms |
| `seed` | int | >= 0 |
| `jitter` | string | `"none"` or `"full"` |

Output (JSON, stdout):

| Field | Type | Description |
|-------|------|-------------|
| `attempt` | int | Echo of input |
| `capped` | bool | True if raw delay exceeded max_ms |
| `delay_ms` | int | Final delay in milliseconds |

Exit code 1 + empty stdout on any validation error.

## Backoff Formula

```
raw = base_ms * 2^(attempt - 1)
capped_delay = min(raw, max_ms)
capped = raw > max_ms          # strict: raw == max_ms → capped=False
```

## Jitter Algorithm

When `jitter="full"`:

1. Seed `random.Random(seed)`
2. Call `.random()` exactly `attempt` times
3. Use the **last** value (`r_n`)
4. `delay_ms = math.floor(r_n * capped_delay)`

When `jitter="none"`: `delay_ms = capped_delay`

## PRNG Specification

- Python stdlib `random.Random` seeded with the `seed` field
- Call count equals `attempt` — deterministic regardless of OS or platform
- No wall clock calls (`time.time`, `datetime.now`) are ever made

## Running Tests

```bash
cd execution/tests/ghost-project/tempo
bash tests/run_tests.sh
# PASS 12/12
```
