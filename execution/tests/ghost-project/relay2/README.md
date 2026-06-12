# relay2 — Asymmetric Error Propagation Dispatcher

relay2 simulates a message dispatcher that enforces asymmetric error policies based on call type. It is a stdlib-only Python program that validates tab-delimited input files and emits per-command results to stdout.

---

## The Asymmetric Propagation Trap

The central lesson: **uniform error policy is wrong**.

Two call types exist — `DIRECT` and `BROADCAST` — and they have fundamentally different contracts with respect to errors:

- **DIRECT**: The caller is synchronously waiting for a result. If the handler fails, the error **must** propagate back. Swallowing it would leave the caller with a false success.
- **BROADCAST**: The dispatcher fires and forgets. The caller has no mechanism to receive an exception. If the handler fails, the dispatcher catches it, logs it, and continues. The caller sees nothing.

Applying either policy uniformly breaks one of the two call types:

| Uniform policy | Breaks |
|----------------|--------|
| Always ERROR   | BROADCAST callers — they can't observe the exception |
| Always LOGGED  | DIRECT callers — they need to know the handler failed |

The correct model: **call semantics determine error visibility**.

---

## CLI

```bash
python3 relay2.py handlers.txt commands.txt
```

### handlers.txt format
Tab-separated, one handler per line:

```
HANDLER_NAME<TAB>BEHAVIOR
```

`BEHAVIOR` must be `ok` or `fail`.

### commands.txt format
Tab-separated, one command per line:

```
CALL_TYPE<TAB>HANDLER_NAME
```

`CALL_TYPE` must be `DIRECT` or `BROADCAST`. `HANDLER_NAME` must exist in handlers.txt.

---

## Output

One line per command, in input order:

| Condition              | Output line                           |
|------------------------|---------------------------------------|
| DIRECT + ok handler    | `DIRECT <name> OK`                    |
| DIRECT + fail handler  | `DIRECT <name> ERROR: handler failed` |
| BROADCAST + ok handler | `BROADCAST <name> OK`                 |
| BROADCAST + fail handler | `BROADCAST <name> LOGGED`           |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0    | All commands processed successfully (handler errors are in output lines, not exit code) |
| 2    | Malformed input — nothing written to stdout, diagnostic on stderr |

---

## Validation

ALL input is validated before ANY output is produced. Exit 2 (with empty stdout) on:

- Wrong number of fields (not exactly 2 tab-separated)
- Unknown `BEHAVIOR` value
- Unknown `CALL_TYPE` value
- Handler name referenced in commands.txt not defined in handlers.txt
- Duplicate handler name in handlers.txt
- Empty handler name

---

## Example

**handlers.txt**
```
healthy	ok
broken	fail
```

**commands.txt**
```
DIRECT	healthy
DIRECT	broken
BROADCAST	healthy
BROADCAST	broken
```

**Output**
```
DIRECT healthy OK
DIRECT broken ERROR: handler failed
BROADCAST healthy OK
BROADCAST broken LOGGED
```

Note that `BROADCAST broken` outputs `LOGGED`, not `ERROR` — the dispatcher caught the exception. The dispatcher exits 0 because handler failures are recorded in output, not as exit codes.

---

## Running Tests

```bash
bash execution/tests/ghost-project/relay2/tests/run_tests.sh
```

All 6 tests must pass.
