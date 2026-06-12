# fanin — Async Fan-In Context Assembly

fanin simulates concurrent task execution and assembles results into a single context string. It models the fan-in pattern: multiple concurrent workers complete in an unpredictable order, but the final context is assembled deterministically in the order the tasks were declared — not the order they finished.

## CLI

```
python3 fanin.py tasks.txt
```

`tasks.txt` is a tab-separated file, one row per line:

```
TASK_ID<TAB>DELAY_RANK<TAB>OUTPUT_VALUE
```

- `TASK_ID` — unique string identifier
- `DELAY_RANK` — integer (lower = completes first). Negative values allowed.
- `OUTPUT_VALUE` — the value produced by this task upon completion

## Output

Exactly 2 lines are printed to stdout:

```
CONTEXT: <out1> | <out2> | ... | <outN>
COMPLETED_ORDER: <id1>,<id2>,...,<idN>
```

- `CONTEXT` assembles `OUTPUT_VALUE` in **declaration order** (file line order), separated by ` | `
- `COMPLETED_ORDER` lists `TASK_ID`s in **completion order**: sorted by `DELAY_RANK` ascending, ties broken by original file order (stable sort)

## Exit Codes

| Code | Meaning |
|------|---------|
| 0    | Success |
| 2    | Input error: wrong field count, non-integer DELAY_RANK, duplicate TASK_ID, or empty file |

## The Completion-vs-Declaration Trap

The canonical mistake naive implementations make: they sort tasks by `DELAY_RANK` to determine completion order, then assemble the `CONTEXT` line using that same sorted order. This is wrong.

The context must be assembled in **declaration order** — the order lines appear in the input file — regardless of which tasks finished first. The test fixtures are deliberately designed so declaration order and completion order differ, catching this bug immediately.

**Correct mental model:**
- Workers fan out and complete in rank order (completion order = sorted by DELAY_RANK)
- The fan-in step collects results and assembles them in the original declaration order
- These are two separate orderings and must not be conflated

## Examples

### Basic

Input (`tasks.txt`):
```
A	3	alpha
B	2	bravo
C	1	charlie
```

C has the lowest DELAY_RANK (1), so it completes first — but it was declared last. The context is assembled A→B→C (declaration), not C→B→A (completion).

```
CONTEXT: alpha | bravo | charlie
COMPLETED_ORDER: C,B,A
```

### Boundary (ties and negative ranks)

Input:
```
T1	0	x
T2	-5	yy
T3	2	zzz
T4	2	ww
T5	-5	vv
```

Ties at -5: T2 before T5 (file order). Ties at 2: T3 before T4 (file order).

```
CONTEXT: x | yy | zzz | ww | vv
COMPLETED_ORDER: T2,T5,T1,T3,T4
```

## Running Tests

```bash
bash execution/tests/ghost-project/fanin/tests/run_tests.sh
```
