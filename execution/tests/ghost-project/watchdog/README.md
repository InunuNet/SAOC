# Watchdog — Quiescence Detection

Watchdog is a deterministic FIFO task-queue processor. It reads a task-definition file,
seeds a queue with the first task, processes tasks breadth-first, and terminates when
the queue is fully drained — i.e., **quiescence**.

It is an Athanor ghost project: a real-world mini-tool built by the agent team to
validate the full factory pipeline end-to-end.

---

## Usage

```bash
python3 watchdog.py tasks.txt
```

### tasks.txt Format

Each line is whitespace-separated:

```
TASK_ID [FOLLOWUP_ID ...]
```

- Line 1's TASK_ID is the only initial item pre-loaded into the queue.
- Subsequent lines define followup mappings: when TASK_ID is processed, its FOLLOWUPs
  are appended to the queue tail.
- A TASK_ID with no definition line is a **leaf** — it enqueues nothing when processed.

### Example

```
root A B C
A a1 a2
B b1
C c1 c2 c3
c2 c2a c2b
```

Output:

```
PROCESSED root
PROCESSED A
PROCESSED B
PROCESSED C
PROCESSED a1
PROCESSED a2
PROCESSED b1
PROCESSED c1
PROCESSED c2
PROCESSED c3
PROCESSED c2a
PROCESSED c2b
TOTAL 12
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0`  | Success — quiescence reached, all tasks processed |
| `2`  | Input error: duplicate line-leader, empty file, or whitespace-only line |

---

## The Quiescence Trap

The critical correctness property: **an empty queue is not the same as quiescence
reached, if you stop before discovering all followups.**

A naive implementation might process the root's direct followups (A, B, C) and then
stop when that batch is exhausted — never discovering that `c2` enqueues `c2a` and
`c2b`. This produces `TOTAL 10` instead of the correct `TOTAL 12`.

The correct algorithm is a **while-queue-non-empty** loop:

```python
queue = deque([initial_task])
while queue:
    task = queue.popleft()
    print(f"PROCESSED {task}")
    for child in followups.get(task, []):
        queue.append(child)
```

Quiescence is reached only when the queue is empty **and** no task that was just
processed could enqueue anything new — which is precisely when the while loop exits.

---

## Dependencies

- Python 3.10+ (stdlib only: `collections`, `sys`, `os`)
- No third-party packages

---

## Testing

```bash
cd execution/tests/ghost-project/watchdog
bash tests/run_tests.sh
```

All 5 tests must pass:

1. Main fixture (catches TOTAL 10 naive impl)
2. Boundary — single leaf task
3. Three-level chain — all 3 processed
4. Exit 2 on duplicate line-leader
5. Exit 2 on empty file
