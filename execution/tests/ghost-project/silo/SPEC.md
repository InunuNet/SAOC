# Silo — Specification

## Purpose

Silo is a per-(type, key) actor instantiation registry. It tracks independent counters for
pairs of (AGENT_TYPE, KEY). The critical invariant: registry keys are **tuples** — a
`reviewer` actor handling `req-1` is completely distinct from a `reviewer` actor handling
`req-2`, and from a `summarizer` actor handling `req-1`.

## CLI

```
python3 silo.py <invocations.txt>
```

## Input Format

Tab-separated, one event per line. Each line has exactly three fields:

```
AGENT_TYPE<TAB>KEY<TAB>OPERATION
```

### Operations

| Operation | Semantics |
|-----------|-----------|
| `INIT` | Register `(AGENT_TYPE, KEY)` with counter = 0. Duplicate INIT on same pair → exit 2. |
| `INCREMENT` | Add 1 to `(AGENT_TYPE, KEY)` counter. Uninitialized pair → exit 2. |
| `GET` | Print `AGENT_TYPE KEY VALUE` to stdout. Uninitialized pair → exit 2. |

## Output

GET operations emit one line per call: `AGENT_TYPE KEY VALUE` (space-separated).
Output is printed only after ALL operations succeed — first error halts with no output.

## Exit Codes

| Code | Condition |
|------|-----------|
| 0 | All operations processed successfully |
| 2 | Any error: duplicate INIT, GET/INCREMENT on uninitialized pair, unknown operation, wrong field count, empty line |

## Key Invariant (Anti-Pattern Warning)

A naive implementation might use only `AGENT_TYPE` as the registry key. That would cause
`INCREMENT reviewer req-1` to bleed into the counter for `reviewer req-2`. Silo uses the
**tuple `(AGENT_TYPE, KEY)`** as the registry key at all times.

The fixture `silo_basic.txt` proves isolation: `reviewer req-1` receives 2 increments and
`reviewer req-2` receives 1. Any implementation keying by type alone would show equal counts.

## Error Handling

- First error halts processing immediately.
- No partial GET output is emitted on error paths.
- Error messages go to stderr; stdout is always empty on exit 2.

## Stdlib Only

No third-party dependencies. Python 3.9+ standard library only.
