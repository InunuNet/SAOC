# ledger2 — Dual-Attribute Event Ledger with Independent Query Axes

A stdlib-only Python tool that processes a structured event log where each event has two **independent** classification axes: **origin** (who authored it) and **display** (how it appears in the protocol).

## The Dual-Axis Trap

The critical design point: **origin and display are independent**. A `system`-authored event can occupy the `prompt` slot (e.g. an injected system reminder). A `user` event can occupy the `tool_result` slot (e.g. a user paste).

This means:

- `COUNT_REAL_USER` uses only the **origin** field — it counts events where `origin=user`.
- `COUNT_MODEL_INPUT` uses only the **display** field — it counts events where `display=prompt`, regardless of who authored them.
- `COUNT_BILLABLE` uses **both** — it counts events where `origin=user AND display=prompt`.

On a typical session log, `COUNT_REAL_USER ≠ COUNT_MODEL_INPUT` because system injections appear in the prompt slot.

Using the wrong field (e.g. checking `origin=prompt`) would silently produce wrong counts with no error — hence the trap.

## Query Reference

| Query | Field | Condition |
|-------|-------|-----------|
| `COUNT_REAL_USER` | origin | `== "user"` |
| `COUNT_MODEL_INPUT` | display | `== "prompt"` |
| `COUNT_BILLABLE` | origin + display | `== "user" AND == "prompt"` |
| `AUDIT_AUTHOR <N>` | origin | print `ORIGIN:<origin>` of Nth event (1-indexed) |
| `REBUILD_CONVERSATION` | display | print `[<display>] <text>` where `display ∈ {prompt, response}` |

## CLI

```bash
python3 ledger2.py events.txt
```

## Input Format

```
ORIGIN<TAB>DISPLAY<TAB>TEXT
... (more events)

QUERY
... (more queries)
```

Events and queries are separated by **exactly one blank line**. TEXT is split on the first two tabs only, so TEXT itself may contain tabs.

### Valid Values

- ORIGIN: `user`, `system`, `agent`
- DISPLAY: `prompt`, `response`, `tool_result`

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 2 | Malformed input: invalid ORIGIN, invalid DISPLAY, unknown query, AUDIT_AUTHOR out of range, missing separator, wrong field count |

## Running Tests

```bash
bash execution/tests/ghost-project/ledger2/tests/run_tests.sh
```

## stdlib Only

No third-party dependencies. Requires Python 3.6+.
