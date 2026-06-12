# barrier — Deferred Fan-In Barrier

A stdlib-only Python tool that processes a TAB-separated command file and emits
barrier results only after ALL declared workers for a group have been seen.

---

## The Eager Fan-In Trap

A naive single-pass implementation reads commands top-to-bottom and, when it hits a
`BARRIER`, emits whatever outputs it has collected so far. If more workers for that
group appear later in the file, the output is **silently wrong** — a partial list
instead of `INCOMPLETE`.

**Barrier solves this with a mandatory two-pass algorithm:**

1. **Pass 1:** Scan the entire file and count the total number of `WORKER` declarations
   per group.
2. **Pass 2:** Walk commands in order; at each `BARRIER`, compare workers seen so far
   against the total from Pass 1. If any workers for this group appear later in the
   file, emit `INCOMPLETE` — not the partial list.

This is the only correct approach. Any implementation that emits partial lists at a
barrier when more workers follow is wrong.

---

## CLI

```bash
python3 barrier.py workers.txt
```

`workers.txt` must use strict TAB (`\t`) separators on command lines.

---

## Input Format

| Line type | Format | Fields |
|-----------|--------|--------|
| Worker declaration | `WORKER<TAB>ID<TAB>GROUP<TAB>OUTPUT` | 4 |
| Barrier command | `BARRIER<TAB>GROUP` | 2 |
| Comment | `# ...` | any |
| Blank | (empty line) | — |

Comments and blank lines are silently ignored.

---

## Output Format

One line per `BARRIER` command:

```
BARRIER <GROUP>: EMPTY        # no workers declared for this group anywhere
BARRIER <GROUP>: INCOMPLETE   # some workers for this group appear later in the file
BARRIER <GROUP>: out1,out2    # all workers seen — outputs in declaration order
```

---

## Example

```
WORKER	w1	g1	alpha
WORKER	w2	g1	beta
BARRIER	g1
WORKER	w3	g2	gamma
BARRIER	g2
BARRIER	g3
```

Output:
```
BARRIER g1: alpha,beta
BARRIER g2: gamma
BARRIER g3: EMPTY
```

Boundary case (BARRIER fires before all workers):

```
WORKER	w1	g1	first
BARRIER	g1
WORKER	w2	g1	second
WORKER	w3	g1	third
BARRIER	g1
```

Output:
```
BARRIER g1: INCOMPLETE
BARRIER g1: first,second,third
```

The first BARRIER fires when only 1 of 3 workers for `g1` has been declared →
`INCOMPLETE`. The second BARRIER fires after all 3 → complete output.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `2` | Malformed input (wrong field count, unknown command) |

File-not-found produces exit 1 (OS error).

---

## Running Tests

```bash
bash execution/tests/ghost-project/barrier/tests/run_tests.sh
```

Six tests covering: basic output, INCOMPLETE trap, empty file, single worker,
malformed input (exit 2), and all barriers before workers.

---

## Dependencies

Stdlib only. No third-party packages required.
Python 3.8+.
