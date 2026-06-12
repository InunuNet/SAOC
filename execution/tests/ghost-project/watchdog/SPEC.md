# Watchdog — Specification

## Overview

Watchdog is a deterministic FIFO task-queue processor that models quiescence detection.
It reads a task-definition file, seeds a queue with the first task, processes tasks in
strict FIFO order (each task may enqueue more tasks), and terminates only when the queue
is fully drained — i.e., quiescence.

---

## Input Format

`tasks.txt` is a plain-text file where each line is whitespace-separated tokens:

```
TASK_ID [FOLLOWUP_ID ...]
```

- **Line 1** defines the initial task and its followups. Its TASK_ID is the only item
  pre-loaded into the queue.
- **Lines 2+** define followup mappings. Any TASK_ID that appears in the file as a
  line-leader may be enqueued at runtime; when it is popped, its followups are enqueued.
- A TASK_ID that is **never a line-leader** is a **leaf**: when popped, it enqueues nothing.

---

## Processing Algorithm

```
queue ← deque([line_1_TASK_ID])
total ← 0

while queue is not empty:
    task_id ← queue.popleft()          # pop from head (FIFO)
    print "PROCESSED <task_id>"
    total ← total + 1
    for child in followups.get(task_id, []):
        queue.append(child)            # append to tail

print "TOTAL <total>"
```

### FIFO Contract

Items are always appended to the **tail** and consumed from the **head**. This is strict
first-in, first-out ordering. `collections.deque` with `append` / `popleft` is the
canonical implementation.

### Definition Lookup

When a task is popped, its followups are looked up in the definition map built from
`tasks.txt`. If the TASK_ID has no definition entry (leaf), `followups.get(task_id, [])`
returns an empty list and nothing is enqueued.

### Quiescence Condition

The loop terminates when and only when `queue` is empty. Because tasks enqueued mid-loop
are processed before the loop exits, the system reaches **quiescence** — a state where
no further work is possible — before terminating.

---

## The Quiescence Trap

A naive implementation stops too early:

```
# WRONG — stops when the initial batch is exhausted, not at true quiescence
initial = followups[line_1_id]
for task in initial:
    process(task)
```

This misses tasks enqueued by tasks enqueued by the root. The correct loop is a
**while-queue-non-empty** loop, not a fixed-depth traversal. In the reference fixture,
the naive implementation prints `TOTAL 10`; the correct implementation prints `TOTAL 12`.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0`  | All tasks processed successfully; quiescence reached |
| `2`  | Input error — one of the following: |
|      | • Duplicate TASK_ID as line-leader |
|      | • Empty file (zero bytes or zero lines) |
|      | • Whitespace-only line anywhere in the file |

Exit code `2` is produced before any processing begins. No partial output is written.

---

## Constraints

- **stdlib only** — `collections`, `sys`, `os` (no third-party packages)
- **Python 3.10+**
- Single-pass parse: the definition map is built in one read, then the queue loop runs
- Leaf tasks (no definition) are valid and produce no followups
- The same TASK_ID may appear multiple times in followup lists (self-loops are
  theoretically supported; the loop will run until the queue drains, which may be
  infinite — caller's responsibility to use acyclic graphs)
