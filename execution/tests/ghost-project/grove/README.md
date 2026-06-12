# grove — Priority Queue with FIFO Tiebreaking

grove is a command-line priority queue processor. It reads a sequence of `PUSH` and `POP` events from a file, maintains a min-heap, and emits results with strict FIFO ordering for items of equal priority.

## CLI

```
python3 grove.py events.txt
```

`events.txt` is a tab-separated file with one event per line:

| Event | Format | Description |
|-------|--------|-------------|
| PUSH  | `PUSH<TAB>PRIORITY<TAB>ITEM_ID` | Insert item with integer priority |
| POP   | `POP` | Remove and print the highest-priority (lowest integer) item |

On each `POP`, grove emits:
```
POPPED <ITEM_ID> <PRIORITY>
```

After all events are processed, if any items remain in the queue:
```
REMAINING <N>
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 2 | Error: POP from empty queue, wrong field count, or non-integer priority. Diagnostic written to stderr. |

## The Tiebreak Trap

When two items share the same priority, the **only correct tiebreak** is insertion order (FIFO). Common wrong implementations use:

- **Alphabetical order**: comparing `item_id` strings directly (e.g., `xray` < `yankee` < `zulu` alphabetically, but `zulu` was pushed first so it must pop first).
- **LIFO order**: using a stack rather than a queue for equal items.

grove uses a monotonic sequence counter (`seq`) as the second element of the heap tuple:

```python
heapq.heappush(heap, (priority, seq, item_id))
```

Because `seq` increases on every PUSH, items with equal priority sort by insertion order automatically — Python's tuple comparison never reaches `item_id`.

## Examples

### Basic run

```
$ python3 grove.py events.txt
POPPED date 1
POPPED banana 3
POPPED apple 5
REMAINING 1
```

### Negative priorities

Negative integers are valid. Priority `-100` pops before `5`:

```
PUSH	-100	fast
PUSH	5	slow
POP
POP
```
```
POPPED fast -100
POPPED slow 5
```

### Error: POP on empty queue

```
$ echo -e "POP" | python3 grove.py /dev/stdin
ERROR: line 1: POP on empty queue
$ echo $?
2
```

## Tests

```bash
bash tests/run_tests.sh
```

Six tests: basic fixture, FIFO boundary (proves not alphabetical), REMAINING count, POP-empty exit 2, bad-priority exit 2, and negative priorities.
