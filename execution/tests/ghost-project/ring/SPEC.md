# SPEC: ghost-ring — Circular Buffer CLI

## Purpose
A command-line circular (ring) buffer that processes a stream of JSONL operations
(`push` / `pop` / `peek`) against a fixed-capacity buffer and emits one JSONL result
line per operation. Overflow behavior is selectable: evict the oldest element
(`OVERWRITE`) or refuse the write (`REJECT`).

## CLI Interface
```
python3 ring.py --capacity <int> --overflow <OVERWRITE|REJECT> < ops.jsonl
```
- `--capacity` (required): integer ≥ 1. Maximum number of live elements.
- `--overflow` (required): `OVERWRITE` or `REJECT`. Behavior when a `push` arrives at full capacity.
- **stdin**: JSONL ops, one JSON object per line.
- **stdout**: JSONL results, one JSON object per line, in input order.

### Input op shapes
| op    | shape                                  |
|-------|----------------------------------------|
| push  | `{"op": "push", "value": "<str>"}`     |
| pop   | `{"op": "pop"}`                         |
| peek  | `{"op": "peek"}`                        |

### Output line shape
Each output line is `json.dumps({"op": <op>, "result": <str>, "size": <int>})`
using Python's **default separators** (`", "` and `": "`), keys in the order
`op`, `result`, `size`. Example: `{"op": "push", "result": "ok", "size": 1}`.

## Requirements

1. **R1 — Push (not full).** A `push` while `size < capacity` appends the value at the
   tail; `result = "ok"`, `size` increments by 1.

2. **R2 — Push OVERWRITE (full).** A `push` while `size == capacity` and overflow is
   `OVERWRITE` silently evicts the **oldest** element (head advances), appends the new
   value at the tail; `result = "ok"`, `size` stays at `capacity`.
   *(Trap class 1: the head advances, the newest is NOT dropped.)*

3. **R3 — Push REJECT (full).** A `push` while `size == capacity` and overflow is
   `REJECT` makes **no change** to the buffer; `result = "full"`, `size` unchanged.
   *(Trap class 4: failed push leaves buffer contents and indices untouched.)*

4. **R4 — Pop (non-empty).** A `pop` while `size > 0` removes and returns the **head**
   (oldest) element; `result = <removed value>`, `size` decrements by 1.

5. **R5 — Pop (empty).** A `pop` while `size == 0` returns `result = "empty"`, leaves
   `size = 0`, and records that a pop-empty occurred. Processing **continues** for all
   remaining ops; the process exits `1` only after the entire stream is consumed.
   *(Trap class 2: empty-pop is a DEFERRED error, not an immediate abort.)*

6. **R6 — Peek (non-empty).** A `peek` while `size > 0` returns the **head** value
   without modifying the buffer; `result = <head value>`, `size` unchanged.
   *(Trap class 5: peek is non-destructive — peek then pop yields the same value.)*

7. **R7 — Peek (empty).** A `peek` while `size == 0` returns `result = "empty"`,
   `size = 0`, no state change. (Peek-empty is NOT an error; exit code unaffected.)

8. **R8 — Size invariant.** At all times `0 <= size <= capacity`, and `size` always
   equals the number of live elements actually retrievable by `pop`.
   *(Trap class 3.)*

## Algorithm (circular array with head/tail indices)
- Allocate a list `buf` of length `capacity`.
- Maintain `head` (index of oldest element), `size` (live count).
- Tail position for next push = `(head + size) % capacity`.
- **push (not full):** `buf[(head + size) % capacity] = value`; `size += 1`.
- **push OVERWRITE (full):** `buf[(head + size) % capacity] = value` (== `buf[head]`);
  then `head = (head + 1) % capacity` (drop oldest). `size` stays `capacity`.
- **push REJECT (full):** no-op; emit `full`.
- **pop (non-empty):** `value = buf[head]`; `head = (head + 1) % capacity`; `size -= 1`.
- **peek (non-empty):** `value = buf[head]` (no index change).
- Track `pop_empty_seen` boolean; after the loop, `sys.exit(1 if pop_empty_seen else 0)`.

## Golden output table

### overwrite (capacity=3, OVERWRITE) — buffer state shown after op
| # | op   | value | buffer (head→tail) | result | size |
|---|------|-------|--------------------|--------|------|
| 1 | push | a     | [a]                | ok     | 1    |
| 2 | push | b     | [a,b]              | ok     | 2    |
| 3 | push | c     | [a,b,c]            | ok     | 3    |
| 4 | push | d     | [b,c,d]            | ok     | 3    |
| 5 | pop  | —     | [c,d]              | b      | 2    |
| 6 | peek | —     | [c,d]              | c      | 2    |

### reject (capacity=2, REJECT)
| # | op   | value | buffer  | result | size |
|---|------|-------|---------|--------|------|
| 1 | push | x     | [x]     | ok     | 1    |
| 2 | push | y     | [x,y]   | ok     | 2    |
| 3 | push | z     | [x,y]   | full   | 2    |
| 4 | pop  | —     | [y]     | x      | 1    |
| 5 | pop  | —     | []      | y      | 0    |
| 6 | pop  | —     | []      | empty  | 0    |

### peek (capacity=4, REJECT)
| # | op   | value | buffer | result | size |
|---|------|-------|--------|--------|------|
| 1 | push | p     | [p]    | ok     | 1    |
| 2 | peek | —     | [p]    | p      | 1    |
| 3 | peek | —     | [p]    | p      | 1    |
| 4 | pop  | —     | []     | p      | 0    |
| 5 | peek | —     | []     | empty  | 0    |

## Exit code table
| Condition                                    | Exit |
|----------------------------------------------|------|
| All ops processed, no pop-empty occurred     | 0    |
| At least one pop on an empty buffer occurred | 1    |
| (peek-empty does NOT affect exit code)       | —    |

Exit code is decided **after** the full stream is consumed (deferred), never mid-stream.
