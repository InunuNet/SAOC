# SPEC: ghost-bloom — Bloom Filter CLI

## Purpose
A deterministic Bloom filter command-line tool. Reads a stream of JSONL operations
(`add` / `query`) from stdin, maintains an in-memory bit array, and emits one JSONL
result line per input operation. A Bloom filter is a probabilistic set: it may report
false positives but **never** false negatives.

## CLI
```
python3 bloom.py --m <int> --k <int> < ops.jsonl
```
| Flag | Meaning | Constraint |
|------|---------|------------|
| `--m` | Bit array size | integer ≥ 1 |
| `--k` | Number of hash functions | integer ≥ 1 |

- Input: JSONL on stdin, one op per line.
  - `{"op": "add", "value": "<str>"}`
  - `{"op": "query", "value": "<str>"}`
- Output: JSONL on stdout, one line per input op (same order).
  - add → `{"op": "add", "value": "<str>", "result": "added"}`
  - query → `{"op": "query", "value": "<str>", "result": "present"}` or `{..., "result": "absent"}`
- Exit code: **always 0** on valid input. The Bloom filter never errors on a valid op stream.

## Algorithm
1. Allocate a bit array of length `m`, all bits 0.
2. For an op on `value`, compute `k` bit positions using the hash contract below.
3. **add**: set every computed bit position to 1; output `"added"` (always, even on repeats).
4. **query**: if **all** `k` computed bit positions are 1 → `"present"`, else → `"absent"`.

### Hash contract (deterministic — no ambient randomness)
For hash function `i` (0-indexed, `0 ≤ i < k`):
```
position_i = mmh3.hash(value, seed=i) % m        # if the `mmh3` package is importable
```
If `mmh3` is **not** importable, fall back to (MUST be exactly this):
```
position_i = int(hashlib.sha256(f"{i}:{value}".encode()).hexdigest(), 16) % m
```
The fallback is mandatory and fully prescribed so output is reproducible across runs and
machines. Golden fixtures in this spec are computed with the **sha256 fallback** at
`--m 16 --k 2`.

## Requirements
1. **R1 — No false negatives.** If a value was previously `add`-ed, a later `query` of that
   value MUST return `"present"`. Returning `"absent"` for an added value is a hard failure.
2. **R2 — False positives allowed.** A `query` for a value never added MAY return `"present"`
   if its `k` bit positions all collide with previously set bits. This is correct behavior.
3. **R3 — Deterministic hash seeding.** Identical `m`, `k`, and op sequence MUST produce
   byte-identical output on every run. Use the prescribed seed formula; no `random`, no time,
   no set/dict iteration order in the hash path.
4. **R4 — Idempotent add.** Adding the same value twice sets no new bits on the second add;
   the second add still outputs `"added"`.
5. **R5 — Query before add.** Querying a value not yet added may return `"present"` (collision)
   but MUST never return `"absent"` for a value that has been added.

## Golden output table (`--m 16 --k 2`, sha256 fallback)
Bit positions (`[i=0, i=1]`):

| value | positions |
|-------|-----------|
| hello | [15, 7]   |
| world | [8, 14]   |
| foo   | [2, 4]    |
| alpha | [13, 10]  |
| beta  | [9, 0]    |
| gamma | [10, 1]   |

### basic.jsonl
| step | op | value | set bits before | result | why |
|------|----|-------|-----------------|--------|-----|
| 1 | add   | hello | {}              | added   | set {15,7} |
| 2 | query | hello | {15,7}          | present | both set |
| 3 | query | world | {15,7}          | absent  | 8 not set |
| 4 | add   | world | {15,7}          | added   | set {8,14} |
| 5 | query | world | {15,7,8,14}     | present | both set |

### idempotent.jsonl
| step | op | value | result | why |
|------|----|-------|--------|-----|
| 1 | add   | foo | added   | set {2,4} |
| 2 | add   | foo | added   | bits already set (R4) |
| 3 | query | foo | present | both set |

### no_false_neg.jsonl
add alpha {13,10}, beta {9,0}, gamma {10,1} → all three queries `present` (R1).

## Exit code table
| Condition | Exit |
|-----------|------|
| Valid op stream (any mix of add/query) | 0 |
| Empty input | 0 |

## Deliverables (for @dev)
- `bloom.py` — the CLI.
- `README.md` — usage + algorithm summary.
- `tests/run_tests.sh` — runs all three fixtures via diff against `*_expected.jsonl`.
