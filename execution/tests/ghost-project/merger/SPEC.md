# Merger — Specification

## Overview

Merger is a per-key reducer registry with parallel-write conflict detection. Keys
are registered with a reducer policy, and multiple writes arriving in the same step
are merged (or flagged as conflicts) according to that policy.

## Commands

### REGISTER KEY REDUCER
Register `KEY` with the given `REDUCER`. Valid reducers: `append`, `overwrite`, `none`.
Re-registering a key overwrites its prior reducer. Exactly 3 tokens required.

### STEP
Clear the accumulator. All pending writes from the current step are discarded.
Exactly 1 token required.

### UPDATE KEY VALUE
Append a pending write of `VALUE` to `accumulator[KEY]`. `VALUE` is everything
after the `KEY` token joined with spaces; it may contain spaces. At least 3 tokens.

Updates accumulate in the accumulator in first-touch order (first UPDATE for a key
in the current step determines its position in APPLY output).

### APPLY
Apply all pending writes per key in first-touch order. After processing all keys
the accumulator is cleared.

For each key in the accumulator:

| Condition | Outcome |
|-----------|---------|
| Key not in registry | Print `UNREGISTERED <KEY>`, skip, no stored change |
| `none` reducer + 1 pending write | `stored[KEY] = value` |
| `none` reducer + 2+ pending writes | Print `CONFLICT <KEY>`, do NOT change stored value |
| `append` reducer | `stored[KEY] = prior_value + "|" + pending_values`, or just `"|".join(pending)` if no prior |
| `overwrite` reducer | `stored[KEY] = last pending value` |

### GET KEY
Print `KEY: <value>` if the key has a stored value, or `KEY: <unset>` if not.
Exactly 2 tokens required.

## Accumulator Lifecycle

- Created fresh at program start (empty).
- `STEP` clears it entirely.
- `APPLY` clears it after processing.
- `UPDATE` appends to it.
- Two consecutive `APPLY` commands with no `UPDATE` in between: the second `APPLY`
  is a silent no-op (empty accumulator, nothing to process).

## First-Touch Ordering

APPLY processes keys in the order of their first `UPDATE` in the current step.
This is deterministic regardless of registration order.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Normal termination, all commands processed |
| 2 | Malformed input: wrong token count, unknown reducer, unknown command |

`CONFLICT` and `UNREGISTERED` are output states, not errors. The program exits 0
even when these conditions are triggered.

## The Trap: Parallel-Write Conflict Detection

The `none` reducer enforces exclusive single-writer semantics within a step.
Two or more `UPDATE` calls for the same key before the next `APPLY` constitute a
parallel write conflict. Naive last-writer-wins implementations silently discard
the first write; Merger detects this and prints `CONFLICT` instead.

Note that the `none` reducer is safe across steps — a single `UPDATE` followed
by `APPLY`, then another single `UPDATE` followed by `APPLY`, is perfectly valid
and does not trigger `CONFLICT`.
