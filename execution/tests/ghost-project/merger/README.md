# Merger

Per-key reducer registry with parallel-write conflict detection.

## Usage

```bash
python3 merger.py commands.txt
```

## Commands

| Command | Tokens | Description |
|---------|--------|-------------|
| `REGISTER KEY REDUCER` | 3 | Register key with reducer: `append`, `overwrite`, or `none` |
| `STEP` | 1 | Clear the accumulator |
| `UPDATE KEY VALUE` | 3+ | Add a pending write; VALUE may contain spaces |
| `APPLY` | 1 | Flush accumulator to stored values per reducer policy |
| `GET KEY` | 2 | Print stored value or `<unset>` |

## Reducer Semantics

### `append`
Joins all pending values with `|`, appending to any existing stored value.

```
# No prior stored value:
UPDATE log hello
UPDATE log world
APPLY  →  stored["log"] = "hello|world"

# With prior stored value:
UPDATE log third
APPLY  →  stored["log"] = "hello|world|third"
```

### `overwrite`
Last pending write wins. Prior stored value is discarded.

```
UPDATE counter 1
UPDATE counter 2
APPLY  →  stored["counter"] = "2"
```

### `none`
Enforces exclusive single-writer semantics within a step.

- 1 pending write → stored value is updated normally.
- 2+ pending writes → prints `CONFLICT <KEY>` and stored value is **not changed**.

```
UPDATE x first
UPDATE x second
APPLY  →  prints "CONFLICT x", stored["x"] unchanged
```

This is the key distinction from naive implementations: rather than silently
picking the last writer, Merger detects the parallel write and flags it.

## CONFLICT Output

When a `none`-registered key receives 2+ writes in a single step:

```
CONFLICT <KEY>
```

The stored value is left unchanged. Subsequent steps with a single write succeed normally.

## UNREGISTERED Output

When an `UPDATE` targets a key that was never `REGISTER`ed:

```
UNREGISTERED <KEY>
```

The accumulator entry is discarded. `GET` for that key will print `<KEY>: <unset>`.

## The Trap

The dangerous pattern with `none` reducers:

```
UPDATE shared alpha   # writer A
UPDATE shared beta    # writer B (parallel, same step)
APPLY
# Naive: stored["shared"] = "beta"  (lost alpha silently)
# Merger: prints CONFLICT shared, stored["shared"] unchanged
```

Merger prevents silent data loss by refusing to pick a winner when the
reducer policy says only one writer is expected.

## Exit Codes

- `0` — success (CONFLICT and UNREGISTERED are output states, not errors)
- `2` — malformed input (wrong token count, unknown reducer, unknown command)

## Running Tests

```bash
bash tests/run_tests.sh
```
