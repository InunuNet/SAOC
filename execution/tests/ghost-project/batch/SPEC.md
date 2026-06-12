# batch — Specification

## Storage Model

### logfile.txt (committed log)

- Plain text, one event per line, append-only.
- Represents the durable, committed state.
- `READ` prints this file verbatim.
- Missing file is treated as empty (no events yet).

### `<logfile>.stage.json` (staging sidecar)

- JSON dict keyed by `batch_id`.
- Each entry: `{"events": [...], "state": "open" | "corrupted"}`.
- Tracks uncommitted batches. Invisible to `READ`.
- Missing or empty file treated as `{}` (no open batches).
- Written atomically via temp file + `os.replace` on every mutating command.

## All-or-Nothing Guarantee

Events added via `ADD` are staged only in the sidecar. They do not appear in
`logfile.txt` until `COMMIT` is issued for that batch. A batch that is
`ABORT`-ed or `CRASH`-ed (and then `RECOVER`-ed) is discarded entirely — no
partial writes to `logfile.txt` ever occur.

This is the key invariant: **`READ` never sees uncommitted data.**

## State Transitions

```
(not in stage)
      │
    BEGIN
      │
      ▼
    open ──── ADD ──▶ open
      │
    COMMIT ──▶ (removed from stage; events written to logfile)
      │
    ABORT  ──▶ (removed from stage; events discarded)
      │
    CRASH  ──▶ corrupted
                  │
               RECOVER ──▶ (removed from stage; events discarded → ROLLED_BACK)
```

## CRASH Marker

`CRASH` appends the literal string `__CRASHED__` to the batch's event list in
the sidecar and sets `state=corrupted`. This marker is informational — it is
part of the staged list that is discarded at `RECOVER` and never written to
`logfile.txt`.

## Recovery Model

`RECOVER` scans the stage for all batches with `state=corrupted` (in insertion
order) and removes them, emitting `ROLLED_BACK <BATCH_ID>` per removed batch.
Open batches are untouched. If no corrupted batches exist, emits
`NOTHING_TO_RECOVER`.

## Command Preconditions and Exit Codes

| Command | Precondition | Violation → |
|---|---|---|
| `BEGIN <ID>` | `<ID>` must not exist in stage | exit 2 |
| `ADD <ID> <EVENT>` | `<ID>` in stage AND `state == "open"` | exit 2 |
| `COMMIT <ID>` | `<ID>` in stage AND `state == "open"` | exit 2 |
| `ABORT <ID>` | `<ID>` in stage | exit 2 |
| `CRASH <ID>` | `<ID>` in stage | exit 2 |
| `RECOVER` | always valid | — |
| `READ` | always valid | — |

Exit 0 on success. Exit 2 on precondition violation or malformed input.
