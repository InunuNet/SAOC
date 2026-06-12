# queue2 — Specification

## Overview

queue2 implements a two-phase commit pending-confirmation queue backed by a single JSON state file. The in-flight zone acts as a durable journal: items moved there are persisted before any confirmation, making the system recoverable from a mid-operation crash.

## State Schema

```json
{
  "pending":   [{"id": "<string>", "payload": "<string>"}],
  "in_flight": [{"id": "<string>", "payload": "<string>"}],
  "done":      [{"id": "<string>", "payload": "<string>"}]
}
```

- All three keys must be present as arrays.
- Items are ordered: head is index 0 (FIFO).
- If the state file does not exist, it is treated as `{"pending": [], "in_flight": [], "done": []}`.

## Command Semantics

### `ENQUEUE <ID> <PAYLOAD>`

- Tokenize using `split(None, 2)` — PAYLOAD is everything after the ID token and may contain spaces.
- Append `{"id": ID, "payload": PAYLOAD}` to `pending`.
- Atomically write state.
- No stdout.

### `EXECUTE`

Two-phase commit execution:

1. If `pending` is empty → print `EXECUTED NONE`, return.
2. Pop head of `pending`.
3. **Phase 1**: Append item to `in_flight`. Write state (durable record of dequeue).
4. **Phase 2**: Remove item from `in_flight`. Append item to `done`. Write state (confirmation).
5. Print `EXECUTED <id>`.

### `FAIL`

Simulates a crash after Phase 1 only:

1. If `pending` is empty → print `FAILED NONE`, return.
2. Pop head of `pending`.
3. **Phase 1**: Append item to `in_flight`. Write state.
4. **Stop** — do not proceed to Phase 2.
5. Print `FAILED <id>`.

The item now exists only in `in_flight`. It is neither lost nor double-counted.

### `RECOVER`

Repairs in-flight items left by a crash:

1. If `in_flight` is empty → print `NOTHING_TO_RECOVER`, return.
2. Move **all** items from `in_flight` to `done` (preserve order).
3. Write state.
4. For each item (in order), print `RECOVERED <id>`.

### `STATUS`

Print queue lengths without modifying state:

```
PENDING: N, IN_FLIGHT: N, DONE: N
```

## Crash Recovery Model

The two-phase commit journal guarantees at-least-once delivery:

| Crash point | State | Recovery action |
|-------------|-------|-----------------|
| Before Phase 1 write | Item still in `pending` | Normal next `EXECUTE` picks it up |
| After Phase 1, before Phase 2 write | Item in `in_flight` | `RECOVER` moves it to `done` |
| After Phase 2 write | Item in `done` | No action needed |

A process that checks for `in_flight` items on startup can self-heal by running `RECOVER` before processing new commands.

## Atomic Writes

All state writes use a `.tmp` intermediate: write to `statefile.json.tmp` then `os.replace()` to the target. This is atomic on POSIX systems — a crash during the write leaves the original file intact.

## Exit Codes

| Code | Condition |
|------|-----------|
| 0 | All commands executed successfully |
| 2 | Malformed input: wrong argument count, unknown command, unreadable state file, or ENQUEUE missing required fields |
| 3 | I/O error during atomic state write |

## Argument Contract

```
python3 queue2.py <statefile.json> <commands.txt>
```

Exactly two positional arguments required. Any other count → exit 2.
