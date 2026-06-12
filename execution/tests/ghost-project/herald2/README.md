# herald2 — Match-Predicate Handler Dispatch

herald2 is a deterministic message dispatcher. Given a registry of named handlers (each with a keyword predicate and an action value) and a stream of messages, it finds the best matching handler for each message and emits its action value.

---

## Usage

```bash
python3 herald2.py handlers.txt messages.txt
```

---

## CLI Reference

| Argument | Description |
|----------|-------------|
| `handlers.txt` | Handler registry — tab-separated `HANDLER_NAME<TAB>KEYWORD<TAB>ACTION_VALUE`, one per line |
| `messages.txt` | Input messages — one message per line |

---

## Output Format

One line per message, tab-separated:

```
MSG_NUM<TAB>HANDLER_NAME<TAB>ACTION_VALUE
MSG_NUM<TAB>UNHANDLED
```

`MSG_NUM` is 1-indexed.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | File not found or I/O error |
| `2` | Malformed input (wrong field count, empty handler name, empty keyword) |

---

## Dispatch Algorithm

1. For each message, collect all handlers where `KEYWORD` is a **case-insensitive** substring of the message.
2. Sort the matching handlers **alphabetically by HANDLER_NAME** (Python default string sort — case-sensitive lexicographic, uppercase before lowercase).
3. Execute the **FIRST** handler from the sorted list.
4. If no handler matches, emit `UNHANDLED`.

### The Alphabetical Dispatch Trap

The sort is by `HANDLER_NAME`, not by declaration order in `handlers.txt`. This is a common source of bugs.

Example: given handlers declared as `zeta_logger`, `alpha_alerter`, `mike_metrics`, `beta_backup`:

```
Message: "Backup error during restore"
  Matches: beta_backup (keyword=backup), alpha_alerter (keyword=error), zeta_logger (keyword=error)
  Sorted:  alpha_alerter, beta_backup, zeta_logger
  First:   alpha_alerter → PAGE_ONCALL    ← NOT beta_backup (declaration order)
```

Any implementation that iterates `handlers.txt` in file order and fires the first match will produce wrong results for multi-match messages.

---

## Examples

```bash
# Basic dispatch
python3 herald2.py tests/fixtures/handlers.txt tests/fixtures/messages.txt

# Empty handler registry (all messages → UNHANDLED)
python3 herald2.py tests/fixtures/boundary_handlers.txt tests/fixtures/boundary_messages.txt
```

### Sample Output

Given `handlers.txt`:
```
zeta_logger	error	LOG_TO_FILE
alpha_alerter	error	PAGE_ONCALL
mike_metrics	latency	EMIT_METRIC
beta_backup	backup	SNAPSHOT
```

And `messages.txt`:
```
Database error detected on shard 3
Latency spike on api-gateway
Nightly backup completed
All systems nominal
Backup error during restore
ERROR: latency exceeded SLA
```

Output:
```
1	alpha_alerter	PAGE_ONCALL
2	mike_metrics	EMIT_METRIC
3	beta_backup	SNAPSHOT
4	UNHANDLED
5	alpha_alerter	PAGE_ONCALL
6	alpha_alerter	PAGE_ONCALL
```

---

## Running Tests

```bash
bash execution/tests/ghost-project/herald2/tests/run_tests.sh
```
