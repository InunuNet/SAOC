# Barrier — Specification

**Version:** 1.0
**Project:** Athanor Ghost Project
**Build path:** `execution/tests/ghost-project/barrier/`

---

## Purpose

Barrier is a deferred fan-in barrier processor. It reads a TAB-separated command file
describing workers and barriers, then emits barrier results only after ALL workers
declared for a group in the entire file have been seen. If a barrier fires before all
workers for its group are declared, it emits INCOMPLETE — not a partial list.

This is the "eager fan-in trap": a naive single-pass implementation would emit the
current partial list instead of INCOMPLETE, producing silently wrong output.

---

## Input Format

TAB-separated lines (strict TAB character `\t`, never spaces).

| Line type | Format | Fields |
|-----------|--------|--------|
| Declare worker | `WORKER<TAB>ID<TAB>GROUP<TAB>OUTPUT` | 4 |
| Emit barrier | `BARRIER<TAB>GROUP` | 2 |
| Comment | `#...` | any |
| Blank | (empty) | — |

Comments and blank lines are silently ignored.
Any other command keyword or wrong field count → exit 2.

**TAB separator contract:** Command lines are split on `\t`. A line with the correct
keyword but wrong field count (e.g., WORKER with 3 fields) is malformed → exit 2.
Lines that use spaces instead of tabs where tabs are required → exit 2 (parsed as
a single-field line with unexpected count).

---

## Two-Pass Algorithm

**THE TRAP:** A single-pass implementation sees a BARRIER and emits whatever workers
have been seen so far. If more workers for that group appear later in the file, the
output is silently wrong (a partial list instead of INCOMPLETE).

**THE FIX:** Two-pass evaluation.

### Pass 1 — Count Total Workers per Group

Scan the entire file. For each WORKER line, increment `total[group]`.
This gives the true total per group across the entire file.

### Pass 2 — Process Commands in Order

Walk commands sequentially. Maintain `seen_count[group]` (workers encountered so far)
and `seen_outputs[group]` (outputs in declaration order).

At each BARRIER command for a group:

| Condition | Output |
|-----------|--------|
| `total[group] == 0` | `BARRIER <GROUP>: EMPTY` |
| `seen_count[group] < total[group]` | `BARRIER <GROUP>: INCOMPLETE` |
| `seen_count[group] == total[group]` | `BARRIER <GROUP>: <out1>,<out2>,...` |

**INCOMPLETE definition:** A barrier is INCOMPLETE when, at the point it is evaluated
in Pass 2, fewer workers for its group have been seen than the total declared in the
entire file. INCOMPLETE is emitted regardless of how many outputs are already in
`seen_outputs`.

**Output ordering:** Outputs are listed in declaration (file) order, comma-separated,
no spaces around commas.

**Multiple BARRIERs for the same group:** Each BARRIER is evaluated independently
against the seen count at that point in Pass 2. The second BARRIER for a group may
be COMPLETE if all workers appear between the two BARRIERs.

---

## Output Format

One line per BARRIER command, in file order:

```
BARRIER <GROUP>: EMPTY
BARRIER <GROUP>: INCOMPLETE
BARRIER <GROUP>: <out1>,<out2>,...
```

No output is produced for WORKER or COMMENT lines.

---

## CLI

```
python3 barrier.py workers.txt
```

`workers.txt` — path to the TAB-separated input file (required, positional).

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success — file processed, all output emitted |
| `2` | Malformed input — wrong field count, unknown command keyword |

Note: File-not-found exits via `sys.exit(1)` (OS error before any parsing).

---

## Edge Cases

- **Empty file** → exit 0, no output.
- **BARRIER for group with no workers anywhere** → EMPTY.
- **All BARRIERs before all workers** → all INCOMPLETE (unless group has 0 workers → EMPTY).
- **Single worker for a group** → BARRIER emits that one output (not INCOMPLETE, not EMPTY).
- **Duplicate worker IDs** — not validated; both outputs are included in declaration order.

---

## What Must Be Explicit in This Spec (Contract Checklist)

- [x] "two-pass algorithm" — two-pass evaluation defined
- [x] "INCOMPLETE definition" — exact INCOMPLETE condition defined
- [x] "TAB separator contract" — strict TAB requirement defined
- [x] "declaration order" — output ordering defined
- [x] "exit 2" — malformed input exit code defined
- [x] "EMPTY" — zero-worker group result defined
- [x] "single-pass" / "eager fan-in trap" — trap documented
