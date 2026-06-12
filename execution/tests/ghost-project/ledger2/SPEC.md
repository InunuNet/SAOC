# ledger2 Specification — Dual-Attribute Event Ledger

## Overview

ledger2 models a conversation log where each event carries **two independent classification axes**: its **origin** (who authored it) and its **display** role (how it appears in the protocol). These axes are independent — a system-injected event can appear in the prompt slot, a user paste can go in the tool_result slot, etc.

## The Two Axes

| Axis | Field | Valid Values | Meaning |
|------|-------|-------------|---------|
| **Origin** | `ORIGIN` | `user`, `system`, `agent` | Who created the event |
| **Display** | `DISPLAY` | `prompt`, `response`, `tool_result` | How the event appears in the protocol |

These axes are **completely independent**. Do not conflate them. A `system` event can have `display=prompt`; a `user` event can have `display=tool_result`.

## Input File Format

```
ORIGIN<TAB>DISPLAY<TAB>TEXT
... (more events)

QUERY
... (more queries)
```

- Events and queries are separated by **exactly one blank line**.
- Each event line is tab-separated: `ORIGIN<TAB>DISPLAY<TAB>TEXT`.
- TEXT is everything after the second tab (use `line.split('\t', 2)`). TEXT may itself contain tabs.
- The queries section contains one query per line.

### Valid Values

| Field | Valid Values |
|-------|-------------|
| ORIGIN | `user`, `system`, `agent` |
| DISPLAY | `prompt`, `response`, `tool_result` |

Any other value → exit 2.

## Queries and Correct Fields

| Query | Field Used | Condition |
|-------|-----------|-----------|
| `COUNT_REAL_USER` | **ORIGIN only** | `origin == "user"` |
| `COUNT_MODEL_INPUT` | **DISPLAY only** | `display == "prompt"` |
| `COUNT_BILLABLE` | **BOTH fields** | `origin == "user" AND display == "prompt"` |
| `AUDIT_AUTHOR <N>` | **ORIGIN** | Print `ORIGIN:<origin>` of Nth event (1-indexed) |
| `REBUILD_CONVERSATION` | **DISPLAY** | Print `[<display>] <text>` for events where `display ∈ {prompt, response}` |

> **The Trap**: `COUNT_MODEL_INPUT` counts `display=prompt` regardless of `origin`. A `system`-origin event with `display=prompt` IS counted in `COUNT_MODEL_INPUT` but NOT in `COUNT_REAL_USER`. Using the wrong field produces silently wrong counts.

## Exit Codes

| Code | Condition |
|------|-----------|
| 0 | Success |
| 2 | Any of: invalid ORIGIN, invalid DISPLAY, unknown query, AUDIT_AUTHOR out of range (including 0), missing blank-line separator, wrong field count |

## CLI

```
python3 ledger2.py events.txt
```

Output is printed to stdout, one result per query.

For `REBUILD_CONVERSATION`, one line is printed per matching event.

## Edge Cases

- TEXT may contain tabs — always split with `line.split('\t', 2)`.
- `AUDIT_AUTHOR 0` is out of range → exit 2 (1-indexed).
- `AUDIT_AUTHOR N` where N > number of events → exit 2.
- Repeated queries are valid — each emits its result in order.
- Unknown query → exit 2.
