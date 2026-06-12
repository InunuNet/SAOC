# grove — Technical Specification

## Overview

grove processes a stream of `PUSH` and `POP` events against a priority queue. Items pop in ascending priority order (min-heap). When two items share the same priority, they pop in FIFO insertion order.

## Heap Algorithm

grove uses Python's `heapq` module, which implements a binary min-heap. The heap stores 3-tuples:

```python
(priority: int, seq: int, item_id: str)
```

### Why a 3-tuple?

Python's `heapq` sorts tuples lexicographically. With a 2-tuple `(priority, item_id)`, equal-priority items would be ordered by string comparison of `item_id` — alphabetical, not insertion order.

The `seq` field is a global monotonic integer counter, starting at 0 and incremented on **every** `PUSH`. Because it strictly increases, items with the same `priority` will order by `seq` (i.e., insertion order). Python's tuple comparison never reaches `item_id`, eliminating string-comparison tiebreaking entirely.

### Canonical pattern

```python
heap = []
seq = 0

# PUSH:
heapq.heappush(heap, (priority, seq, item_id))
seq += 1

# POP:
priority, _seq, item_id = heapq.heappop(heap)
print(f"POPPED {item_id} {priority}")
```

This is the **only correct pattern**. Alternatives:

| Pattern | Problem |
|---------|---------|
| `(priority, item_id)` | Alphabetical tiebreak — wrong |
| `(priority, -seq, item_id)` | LIFO — wrong |
| `(priority, random(), item_id)` | Non-deterministic — wrong |

## FIFO Contract

**Definition:** For items pushed at times T1 < T2 where `priority(T1) == priority(T2)`, `item(T1)` must pop before `item(T2)`.

This contract holds regardless of:
- Interleaved POPs between the two PUSHes
- Alphabetical ordering of `item_id` values
- The absolute value of the shared priority

## Input Format

Tab-separated (`\t`), one event per line. Empty lines are skipped. Fields:

```
PUSH<TAB>PRIORITY<TAB>ITEM_ID
POP
```

- `PRIORITY`: any integer (including negative)
- `ITEM_ID`: any non-empty string (no tab characters)

## Output Format

```
POPPED <ITEM_ID> <PRIORITY>     # one line per POP, written to stdout
REMAINING <N>                    # written after all events if queue is non-empty
```

## Error Handling

grove exits 2 and writes a diagnostic to stderr for:

| Condition | Example |
|-----------|---------|
| POP on empty queue | `POP` when heap is empty |
| Wrong field count | `PUSH\tapple` (only 2 fields) |
| Non-integer priority | `PUSH\tfive\tapple` |
| Unknown operation | `PEEK\tapple` |

Exit 0 on success, even when items remain in the queue (indicated by `REMAINING`).

## Complexity

| Operation | Time | Space |
|-----------|------|-------|
| PUSH | O(log n) | O(1) amortized |
| POP | O(log n) | O(1) |
| Space | — | O(n) for n items |
