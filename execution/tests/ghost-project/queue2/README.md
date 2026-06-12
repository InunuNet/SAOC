# queue2 — Two-Phase Commit Pending-Confirmation Queue

queue2 is a deterministic, file-backed queue processor that implements the two-phase commit pattern to guarantee no item is silently lost — even if the process crashes between dequeue and confirmation.

## The Two-Phase Commit Trap

The naive implementation of a queue is:

```
pop from pending → mark done → write state
```

This is wrong. If the process crashes after the pop but before writing "done", the item disappears from pending and is never placed in done. It is gone.

queue2 fixes this with an **in-flight zone**:

```
Phase 1: pop from pending → append to in_flight → write state
Phase 2: remove from in_flight → append to done  → write state
```

A crash between Phase 1 and Phase 2 leaves the item in `in_flight`. The `RECOVER` command moves everything in `in_flight` to `done`, restoring consistency.

## CLI

```
python3 queue2.py statefile.json commands.txt
```

- `statefile.json` — persistent state file. Created empty if it does not exist.
- `commands.txt` — newline-separated commands to execute.

## Commands

| Command | Behavior |
|---------|----------|
| `ENQUEUE <ID> <PAYLOAD>` | Append item to pending. PAYLOAD may contain spaces. No stdout. |
| `EXECUTE` | Two-phase commit: pending → in_flight (write) → done (write). Prints `EXECUTED <id>` or `EXECUTED NONE`. |
| `FAIL` | Simulate crash: pending → in_flight (write). Stop. Prints `FAILED <id>` or `FAILED NONE`. |
| `RECOVER` | Move all in_flight → done. Prints `RECOVERED <id>` per item, or `NOTHING_TO_RECOVER`. |
| `STATUS` | Prints `PENDING: N, IN_FLIGHT: N, DONE: N`. |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All commands processed successfully |
| 2 | Malformed input (bad command, bad statefile, wrong argument count) |
| 3 | I/O error during atomic state write |

## State File Schema

```json
{
  "pending":   [{"id": "...", "payload": "..."}],
  "in_flight": [{"id": "...", "payload": "..."}],
  "done":      [{"id": "...", "payload": "..."}]
}
```

If the statefile does not exist, all three lists are initialized empty on first use.

## Crash Recovery Model

1. Run `FAIL` (or simulate a crash by killing the process after Phase 1).
2. Inspect the statefile — the item is in `in_flight`.
3. Run `RECOVER` — the item moves to `done`. No item is lost.

This is the core guarantee of the two-phase commit journal.

## Running Tests

```bash
bash execution/tests/ghost-project/queue2/tests/run_tests.sh
```
