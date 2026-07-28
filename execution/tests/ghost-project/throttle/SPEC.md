# ghost-throttle — Sliding-Window Rate Limiter CLI

## Purpose

A standalone CLI tool that applies a **sliding-window** rate limit to a stream
of timestamped events read from stdin and emits a per-event allow/deny verdict
to stdout. It is deterministic, dependency-free (Python 3 stdlib only), and uses
**integer-only arithmetic**.

## CLI Interface

```
python3 throttle.py --window <seconds> --limit <max_requests> < events.jsonl
```

| Flag | Type | Constraint | Meaning |
|------|------|------------|---------|
| `--window` | int | ≥ 1 | Sliding window size in seconds |
| `--limit`  | int | ≥ 1 | Max allowed requests inside any window |

- **Input** (stdin): JSONL, one object per line — `{"ts": <int_unix_seconds>, "id": "<string>"}`.
  - `ts` values are **non-decreasing** across the stream (monotonic, may repeat).
- **Output** (stdout): JSONL, one object per **input** line, in input order —
  `{"id": "<string>", "allowed": <bool>, "remaining": <int>}`.
- **Output format is exact**: produced via `json.dumps({"id": ..., "allowed": ..., "remaining": ...})`
  using Python's **default separators** (`", "` and `": "`), keys in the order
  `id`, `allowed`, `remaining`, one object per line, each line terminated by `\n`.
  Booleans are JSON lowercase `true` / `false`. This exactness is required so
  golden fixtures match byte-for-byte under `diff`.

## Requirements

1. **R1 — Sliding window algorithm.** Maintain a `collections.deque` of the
   timestamps currently inside the window. For each incoming event at `ts`:
   1. **Evict** from the left while the deque is non-empty and
      `ts - deque[0] >= window`. (Eviction condition is `>=`, NOT `>`.)
   2. The event is **allowed** iff `len(deque) < limit`.
   3. If allowed, append `ts` to the deque.
2. **R2 — Integer-only arithmetic (TRAP 1).** All window math uses integer
   operators. Use subtraction and `>=` comparison directly; if any division is
   ever introduced it MUST be floor division `//`. No `float()`, no `/`, no
   float intermediate values anywhere in the window/remaining computation.
3. **R3 — `remaining` semantics.** `remaining` is the number of tokens left
   **after** the current event is processed: `remaining = limit - len(deque)`
   evaluated *after* the (possible) append.
   - On **ALLOW**: deque was appended, so `remaining = limit - len(deque)`.
   - On **DENY**: deque is unchanged and already full, so
     `remaining = limit - limit = 0`.
4. **R4 — No deduction on DENY (TRAP 2).** A denied event MUST NOT be appended
   to the deque and MUST NOT decrement any counter. The internal count stays at
   the current (full) value; `remaining` is reported as `0`. A deny never drives
   `remaining` negative.
5. **R5 — Window boundary precision (TRAP 3).** The sliding window is
   `[ts - window, ts]` **inclusive on both ends**. The eviction test
   `ts - oldest >= window` means an event exactly `window` seconds after the
   oldest in-window timestamp causes that oldest timestamp to fall **out**.
   Example: oldest `ts=0`, `window=60`, current `ts=60` → `60 - 0 = 60 >= 60` →
   the `ts=0` entry is evicted before the current event is judged.
6. **R6 — Empty input (TRAP 4).** Empty stdin (zero bytes / zero lines) →
   produce **no output** and exit `0`.
7. **R7 — Single event (TRAP 5).** The first event in any window is always
   allowed (since `limit >= 1` and the deque is empty after eviction, so
   `0 < limit`).
8. **R8 — Argument validation.** `--window` and `--limit` are required integers
   `>= 1`. Missing/invalid args → exit `1` (argparse default behaviour or an
   explicit check).
9. **R9 — Malformed input.** Any input line that is not valid JSON, or is a JSON
   object missing `ts`/`id`, or whose `ts` is not an integer → write nothing
   further to stdout for that line and exit `1`.
10. **R10 — Blank lines.** Trailing/empty whitespace-only lines (common at EOF)
    are skipped, not treated as malformed. (A truly empty file is R6.)

## Algorithm (reference)

```
deque = deque()
for each event (ts, id) in input order:
    while deque and (ts - deque[0]) >= window:
        deque.popleft()              # evict timestamps that fell out of window
    if len(deque) < limit:
        deque.append(ts)             # ALLOW
        allowed = True
    else:
        allowed = False              # DENY — do NOT append (TRAP 2)
    remaining = limit - len(deque)   # after-append count (TRAP 3 + R3)
    emit {"id": id, "allowed": allowed, "remaining": remaining}
```

## Golden Output Table

### basic.jsonl  (`--window 60 --limit 2`)

| # | ts | id | evict step | deque after evict | len<2? | allowed | deque after | remaining |
|---|----|----|-----------|-------------------|--------|---------|-------------|-----------|
| 1 | 0  | a  | empty               | []      | 0<2 ✓ | true  | [0]      | 1 |
| 2 | 1  | b  | 1-0=1 ≥60? no       | [0]     | 1<2 ✓ | true  | [0,1]    | 0 |
| 3 | 2  | c  | 2-0=2 ≥60? no       | [0,1]   | 2<2 ✗ | false | [0,1]    | 0 |
| 4 | 60 | d  | 60-0=60 ≥60? yes→evict 0; 60-1=59 ≥60? no | [1] | 1<2 ✓ | true | [1,60] | 0 |
| 5 | 61 | e  | 61-1=60 ≥60? yes→evict 1; 61-60=1 ≥60? no | [60] | 1<2 ✓ | true | [60,61] | 0 |

### deny.jsonl  (`--window 10 --limit 3`)

| # | ts | id | deque after evict | len<3? | allowed | deque after | remaining |
|---|----|----|-------------------|--------|---------|-------------|-----------|
| 1 | 0 | r1 | []        | 0<3 ✓ | true  | [0]       | 2 |
| 2 | 0 | r2 | [0]       | 1<3 ✓ | true  | [0,0]     | 1 |
| 3 | 0 | r3 | [0,0]     | 2<3 ✓ | true  | [0,0,0]   | 0 |
| 4 | 0 | r4 | [0,0,0] (0-0=0≥10? no) | 3<3 ✗ | false | [0,0,0] | 0 |

### boundary.jsonl  (`--window 60 --limit 1`)

| # | ts | id | evict step | deque after evict | len<1? | allowed | deque after | remaining |
|---|----|----|-----------|-------------------|--------|---------|-------------|-----------|
| 1 | 0  | x | empty                       | []  | 0<1 ✓ | true | [0]  | 0 |
| 2 | 60 | y | 60-0=60 ≥60? yes→evict 0    | []  | 0<1 ✓ | true | [60] | 0 |

### empty.jsonl

No lines in → no lines out. Exit 0.

## Exit Codes

| Code | Condition |
|------|-----------|
| 0 | Success — all input lines processed (including empty input) |
| 1 | Malformed input line (R9) OR invalid/missing CLI args (R8) |

## Deliverables expected from @dev

- `throttle.py` — the implementation (this directory).
- `README.md` — usage + algorithm summary (this directory).
- `tests/run_tests.sh` — runs all fixtures through `throttle.py` and diffs
  against `*_expected.jsonl`, asserts empty-input exit 0 / no output.
