# ghost-bloom — Bloom Filter CLI

A deterministic Bloom filter command-line tool. Reads a stream of JSONL operations
from stdin, maintains an in-memory bit array, and emits one JSONL result line per
input operation.

## CLI Usage

```
python3 bloom.py --m <int> --k <int> < ops.jsonl
```

| Flag  | Meaning              | Constraint   |
|-------|----------------------|--------------|
| `--m` | Bit array size       | integer >= 1 |
| `--k` | Number of hash functions | integer >= 1 |

### Input format (JSONL, one op per line)

```json
{"op": "add", "value": "hello"}
{"op": "query", "value": "hello"}
```

### Output format (JSONL, one result per input op)

```json
{"op": "add", "value": "hello", "result": "added"}
{"op": "query", "value": "hello", "result": "present"}
{"op": "query", "value": "world", "result": "absent"}
```

Key order is significant: `op`, `value`, `result` — always in that order. Golden fixtures are diffed byte-for-byte.

Exit code is always 0 on valid input.

## Algorithm

### Bit array

A `bytearray` of size `ceil(m / 8)` is allocated, all bits initialised to 0.
Individual bits are read and set via byte index `pos >> 3` and bit mask `1 << (pos & 7)`.

### Hash functions

For each of the `k` hash functions (indexed `i = 0` through `k-1`), the bit position
for a `value` is computed using SHA-256 with a deterministic seed:

```
position_i = int(sha256(f"{i}:{value}".encode()).hexdigest(), 16) % m
```

This formula is fully prescribed — no ambient randomness, no `random`, no time-based
seeding — so identical `m`, `k`, and op sequences produce byte-identical output on
every run and every machine.

### Operations

- **add**: set all `k` bit positions to 1; output `"added"` (even if the value was
  already added — the bits are already set so this is a no-op on the array).
- **query**: if all `k` bit positions are 1 → output `"present"`, otherwise → `"absent"`.

## No-False-Negatives Guarantee

A value that has been `add`-ed will always return `"present"` on a subsequent `query`.
Proof: `add` sets all `k` positions for the value to 1, and `query` checks those same
`k` positions (same hash function, same seeds, same `m`). Once set, bits are never
cleared, so the check always succeeds.

## False Positive Rate

A Bloom filter may report `"present"` for a value that was never added when its `k`
computed bit positions all happen to be set by other values. The approximate false
positive probability for `n` inserted items is:

```
p ≈ (1 - e^(-k*n/m))^k
```

Choosing `m` and `k` to minimise `p` for an expected `n`:
- Optimal `k` = `(m/n) * ln(2)`
- At optimal `k`: `p ≈ (0.6185)^(m/n)`

## Worked Example

```
python3 bloom.py --m 16 --k 2 << 'EOF'
{"op": "add", "value": "hello"}
{"op": "query", "value": "hello"}
{"op": "query", "value": "world"}
{"op": "add", "value": "world"}
{"op": "query", "value": "world"}
EOF
```

With `--m 16 --k 2` and the sha256 fallback:
- `hello` hashes to bit positions [15, 7]
- `world` hashes to bit positions [8, 14]

Step-by-step:
1. `add hello` → sets bits 15 and 7 → `"added"`
2. `query hello` → bits 15 and 7 both set → `"present"`
3. `query world` → bit 8 not set → `"absent"`
4. `add world` → sets bits 8 and 14 → `"added"`
5. `query world` → bits 8 and 14 both set → `"present"`

## Running Tests

```bash
bash tests/run_tests.sh
```

Runs three fixture suites (`basic`, `idempotent`, `no_false_neg`) against their golden `*_expected.jsonl` files using `diff`. Exits 0 if all pass, 1 if any fail.
