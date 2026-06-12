# fanin — Specification

## Overview

fanin assembles a context string from the outputs of concurrently-executing tasks. Concurrency is simulated via `DELAY_RANK`: lower rank = completes sooner. The key invariant is that **context assembly order is always declaration order**, independent of completion order.

## Input Format

A plain-text file with one task per non-empty line. Fields are separated by a single TAB character (`\t`):

```
TASK_ID<TAB>DELAY_RANK<TAB>OUTPUT_VALUE
```

| Field | Type | Constraints |
|-------|------|-------------|
| `TASK_ID` | string | Non-empty; must be unique within the file |
| `DELAY_RANK` | integer | Any integer, including negative |
| `OUTPUT_VALUE` | string | Any string (may contain spaces, but not tabs) |

Empty lines are ignored.

## Stable Sort Semantics

Completion order is determined by a **stable ascending sort on `DELAY_RANK`**:

1. Tasks with lower `DELAY_RANK` complete first.
2. Tasks with equal `DELAY_RANK` preserve their **original file order** (stable sort guarantee). This is the only correct tie-breaking rule.

Python's built-in `sorted()` and `list.sort()` are guaranteed stable, making them the correct primitive.

## Assembly Order

The `CONTEXT` line is built from `OUTPUT_VALUE` fields in **declaration order** — the order lines appear in the input file — joined by ` | `.

```
CONTEXT: <val_line1> | <val_line2> | ... | <val_lineN>
```

This is always file/declaration order. It is never sorted and never reordered by completion rank.

## Output Specification

Exactly two lines are printed to stdout, in this order:

```
CONTEXT: <out1> | <out2> | ... | <outN>
COMPLETED_ORDER: <id1>,<id2>,...,<idN>
```

Line 1 — `CONTEXT:` followed by a space, then `OUTPUT_VALUE`s from line 1 through line N of the input, joined by ` | `.

Line 2 — `COMPLETED_ORDER:` followed by a space, then `TASK_ID`s in completion order (stable sort by `DELAY_RANK` ascending), separated by commas.

No trailing whitespace. No additional lines.

## Exit Codes

| Code | Trigger condition |
|------|------------------|
| 0 | Success: all tasks parsed and output produced |
| 2 | Any of: wrong number of tab-separated fields on any line, non-integer `DELAY_RANK`, duplicate `TASK_ID`, file contains zero tasks |

Exit 2 conditions are detected before any output is produced. No partial output is ever emitted on exit 2.

## Error Messages

All error messages are written to stderr. Stdout is empty on error exits.

Format: `ERROR: <description>` — one line per error. Processing halts at the first error.

## Invariants

1. `CONTEXT` is always in declaration order — never sorted.
2. `COMPLETED_ORDER` is always the stable-sorted order by `DELAY_RANK` — never declaration order (unless they happen to coincide).
3. These two orderings are independent and must not be conflated.
4. The stable sort tie-breaking rule is exclusively original file order. No other tie-breaking (e.g. lexicographic on `TASK_ID`) is permitted.

## Non-Goals

- fanin does not actually execute concurrent workers.
- fanin does not perform I/O on behalf of tasks.
- fanin does not retry failed tasks.
- fanin does not support multi-column output values.
