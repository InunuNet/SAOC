# batch — All-or-Nothing Batch Write Atomicity

A ghost-project implementation that demonstrates correct staging-based batch
commit semantics using stdlib Python only.

## The Atomicity Trap

Wrong implementations `ADD` events directly to `logfile.txt`. This makes
partial (uncommitted) batch content visible via `READ` before `COMMIT`
completes. The correct implementation keeps all staged data in a JSON sidecar
file (`<logfile>.stage.json`) and only touches `logfile.txt` at `COMMIT` time.

## Staging Pattern

```
logfile.txt          ← committed log (append-only, one event per line)
logfile.txt.stage.json  ← sidecar staging file (JSON dict of open/crashed batches)
```

`READ` reads only `logfile.txt`. Staged (open or corrupted) batches are
completely invisible to `READ`.

`COMMIT` atomically appends all staged events to `logfile.txt` via a
read-modify-write with `os.replace`, then removes the batch from the stage.

## CRASH Semantics

`CRASH <BATCH_ID>` appends the sentinel marker `__CRASHED__` to the batch's
event list in the sidecar and sets `state=corrupted`. The batch cannot be
`ADD`-ed to or `COMMIT`-ted. Only `RECOVER` can clear it — by discarding it
without writing to `logfile.txt`.

## CLI

```
python3 batch.py logfile.txt commands.txt
```

### Commands (in `commands.txt`, one per line)

| Command | Effect |
|---|---|
| `BEGIN <BATCH_ID>` | Open a new batch. Exit 2 if already exists. |
| `ADD <BATCH_ID> <EVENT>` | Append EVENT to staging. Exit 2 if not open. |
| `COMMIT <BATCH_ID>` | Flush staged events to logfile, remove from stage. |
| `ABORT <BATCH_ID>` | Discard staged events, remove from stage. |
| `CRASH <BATCH_ID>` | Mark batch corrupted, append `__CRASHED__` marker. |
| `RECOVER` | Discard all corrupted batches, emit `ROLLED_BACK <ID>` per batch. |
| `READ` | Print committed logfile lines to stdout. |

## Exit Codes

| Code | Meaning |
|---|---|
| 0 | All commands processed successfully |
| 2 | Command precondition violated (duplicate BEGIN, missing batch, corrupted state, malformed input) |
