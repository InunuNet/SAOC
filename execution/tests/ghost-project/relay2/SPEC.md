# relay2 — Specification

## Overview

relay2 is a tab-delimited dispatch simulator that models asymmetric error propagation between two call types: `DIRECT` and `BROADCAST`. The core insight it encodes is that a uniform error policy (always propagate, or always swallow) is wrong — call semantics must determine error visibility.

---

## Input Format

### handlers.txt
One handler per line. Tab-separated.

```
HANDLER_NAME<TAB>BEHAVIOR
```

- `HANDLER_NAME`: non-empty string, unique across the file
- `BEHAVIOR`: exactly `ok` or `fail`
- Blank lines are ignored

### commands.txt
One command per line. Tab-separated.

```
CALL_TYPE<TAB>HANDLER_NAME
```

- `CALL_TYPE`: exactly `DIRECT` or `BROADCAST`
- `HANDLER_NAME`: must reference a handler defined in handlers.txt
- Blank lines are ignored

---

## Validation-Then-Execute Contract

ALL input is validated before ANY output is produced.

Validation failures:
- Wrong field count (not exactly 2 tab-separated fields)
- Empty handler name
- `BEHAVIOR` not in `{ok, fail}`
- `CALL_TYPE` not in `{DIRECT, BROADCAST}`
- `HANDLER_NAME` in commands.txt references a handler not in handlers.txt
- Duplicate handler name in handlers.txt

On any validation failure:
- Print **nothing** to stdout
- Write a diagnostic message to stderr
- Exit with code **2**

---

## Dispatch Rules

Commands are processed in input order. Each command invokes one handler.

| CALL_TYPE | BEHAVIOR | Output line                          | Semantics                                        |
|-----------|----------|--------------------------------------|--------------------------------------------------|
| DIRECT    | ok       | `DIRECT <name> OK`                   | Handler succeeded, result returned to caller     |
| DIRECT    | fail     | `DIRECT <name> ERROR: handler failed`| Exception propagates to caller                   |
| BROADCAST | ok       | `BROADCAST <name> OK`                | Handler succeeded                                |
| BROADCAST | fail     | `BROADCAST <name> LOGGED`            | Exception caught and logged by dispatcher        |

---

## Error Semantics by Call Type

### DIRECT
The caller is synchronously waiting for the result. If the handler fails, the error **must** propagate — the caller needs to know. Output: `ERROR: handler failed`.

### BROADCAST
The dispatcher fires the handler and moves on. The caller has no rendezvous point to receive an exception. If the handler fails, the dispatcher catches the exception, logs it internally, and continues. The caller observes nothing unusual. Output: `LOGGED`.

**The trap:** Treating both call types the same is wrong in both directions:
- Always propagating would violate the broadcast contract (caller can't observe it anyway, and would crash).
- Always swallowing would hide DIRECT failures that callers depend on for correctness.

---

## Exit Codes

| Code | Meaning                                              |
|------|------------------------------------------------------|
| 0    | All commands processed; handler errors are in output |
| 2    | Malformed input; no stdout produced                  |

Note: handler `fail` behaviors do **not** cause exit 2. They are recorded in the output lines per the dispatch rules above. Exit 2 is reserved for structural input problems only.

---

## Processing Order

1. Parse and fully validate `handlers.txt`
2. Parse and fully validate `commands.txt` (including handler name resolution)
3. Only if both pass: execute dispatch and emit output lines in command order
