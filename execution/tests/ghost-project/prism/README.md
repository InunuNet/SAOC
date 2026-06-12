# Prism — Histogram Bucketing

Reads floats from stdin, assigns each to a half-open bucket `[lo, hi)`, and outputs a JSON histogram.

## Usage

```bash
echo -e "5\n15\n25" | python3 prism.py config.json
```

## Bucket Semantics

Given `config.json` with `{"buckets": [b0, b1, ..., bN-1]}` (sorted ascending, ≥2 entries):

| Range | Label |
|-------|-------|
| `val < b0` | underflow |
| `b0 <= val < b1` | bucket 0 |
| `b1 <= val < b2` | bucket 1 |
| ... | ... |
| `val >= bN-1` | bucket N-1 (hi = null) |

Boundaries are **left-inclusive, right-exclusive**: a value exactly equal to a boundary goes into the bucket that **starts** at that boundary.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 2 | NaN or non-numeric input on stdin |

## Output Format

```json
{"buckets":[{"count":3,"hi":10,"lo":0},{"count":2,"hi":null,"lo":10}],"underflow":1}
```

- Keys sorted alphabetically (`sort_keys=True`)
- No spaces around separators
- Final bucket has `"hi": null` (open-ended)
- Trailing newline
