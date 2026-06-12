# dispatch — Specification

## Overview

`dispatch` is a tab-separated routing table processor. It maintains a per-source list of
routing declarations in strict declaration order and outputs tasks on demand via RESOLVE.

## Commands

Input file is one command per line, fields separated by a single TAB (`\t`).

### ROUTE SOURCE TARGET

Declares that SOURCE routes to TARGET.

**Deduplication rule:** If `(SOURCE, TARGET)` has already been declared via a previous
`ROUTE` command, this line is a silent no-op. The first declaration wins; subsequent
identical ROUTE declarations are discarded without error.

Key invariant: no matter how many times `ROUTE a b` appears, it produces exactly one
`TASK b` in RESOLVE output for source `a`.

### SEND SOURCE TARGET PAYLOAD

Declares a parameterized send from SOURCE to TARGET carrying PAYLOAD.

**No deduplication.** Every `SEND` line appends an independent task, even if TARGET and
PAYLOAD are identical to a previous SEND. Three identical `SEND a b p` lines produce
three `TASK b p` lines in RESOLVE output for source `a`.

### RESOLVE SOURCE

Outputs all tasks declared for SOURCE, in declaration order (the order the ROUTE/SEND
lines appeared in the input file).

Output format:
- String route:   `TASK <TARGET>`
- Parameterized:  `TASK <TARGET> <PAYLOAD>`

If SOURCE has no declarations, RESOLVE produces no output (not an error).

## Declaration Order Invariant

The output of RESOLVE preserves strict declaration order across both ROUTE and SEND
commands. Mixed sequences like:

```
ROUTE  x  a
SEND   x  a  hello
ROUTE  x  b
```

produce:

```
TASK a
TASK a hello
TASK b
```

## Deduplication Rules Summary

| Command | Deduplication |
|---------|--------------|
| ROUTE   | Yes — per (SOURCE, TARGET). First declaration wins; duplicates are no-ops. |
| SEND    | No — every occurrence appends a new task regardless of TARGET or PAYLOAD. |

## THE TRAP

Developers familiar with fan-out routers often assume that repeated declarations stack.
They do for SEND but NOT for ROUTE. `ROUTE a b` × 100 = 1 task. `SEND a b p` × 100 = 100 tasks.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0    | All commands processed successfully |
| 2    | Malformed line (wrong field count for the command) or unknown command |

## Field Count Requirements

| Command | Required fields (including command name) |
|---------|------------------------------------------|
| ROUTE   | 3 (ROUTE, SOURCE, TARGET) |
| SEND    | 4 (SEND, SOURCE, TARGET, PAYLOAD) |
| RESOLVE | 2 (RESOLVE, SOURCE) |

Lines with the wrong field count cause an immediate exit 2 with an error message to stderr.
