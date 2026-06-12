# SPEC: prism

## One-liner

Histogram bucketing tool that reads floats from stdin, assigns each to a half-open bucket defined in a config file, and outputs a JSON histogram.

## Requirements

- Accepts exactly one positional argument: path to `config.json`.
- `config.json` must contain a `"buckets"` key with a JSON array of at least two numeric boundary values in ascending order.
- Reads floats from stdin, one per line; blank lines are ignored.
- Bucket assignment uses half-open intervals: a value `v` goes to the leftmost bucket whose lower boundary `<= v`. A value below the first boundary goes to `"underflow"`.
- The final bucket has no upper boundary — values >= the last boundary land there.
- A value exactly equal to a boundary goes into the bucket that **starts** at that boundary (left-inclusive, right-exclusive: `[lo, hi)`).
- Any non-numeric or NaN value on stdin causes an immediate exit 2 with no stdout output.
- Empty stdin is valid: exits 0 with all counts set to 0 and `"underflow": 0`.
- Output is a single JSON line with `sort_keys=True` and no spaces around separators, followed by a trailing newline.
- The `"buckets"` array in output contains one object per interval; the final bucket object has `"hi": null` (the key must be present, not absent).
- Each bucket object has exactly three keys: `"count"`, `"hi"`, `"lo"`.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 2 | Non-numeric or NaN value encountered on stdin — stdout is empty |

## Pre-seeded Traps

- **Right-inclusive boundary**: A value equal to a boundary belongs to the bucket that *starts* there, not the one that ends there. Using `val <= hi` instead of `val < hi` puts boundary values in the wrong bucket.
- **Missing `"hi"` key on final bucket**: The key must be present with value `null`. Omitting the key entirely fails the test that checks `"hi" in buckets[-1]`.
- **Spaces in output**: Default `json.dumps()` adds spaces. Must use `separators=(",",":")`.
- **Emitting output before detecting NaN**: If the program processes lines and emits partial output before encountering a NaN, stdout will not be empty on exit 2.
- **Underflow as a bucket object**: `"underflow"` is a top-level integer key, not an element of the `"buckets"` array.
- **Using `float('nan')` comparisons**: `float('nan') != float('nan')` — catching NaN requires `math.isnan()` after parsing, not a string check.
- **Bucket count mismatch**: For N boundaries, there are exactly N buckets (not N-1): buckets `[b0,b1)`, `[b1,b2)`, ..., `[bN-2,bN-1)`, `[bN-1, null)`.

## Binary Test Assertion Table

| # | Test name | What it tests | Expected outcome |
|---|-----------|---------------|-----------------|
| 1 | full_run_exit0 | Exit code on valid full input | Exit code 0 |
| 2 | stdout_matches_expected | Full stdout matches fixture | Byte-identical to expected.json |
| 3 | valid_json | stdout is parseable JSON | No JSONDecodeError |
| 4 | underflow_count | Values below first boundary counted | `underflow == 2` |
| 5 | bucket_count | One bucket per boundary | `len(buckets) == 4` for 4 boundaries |
| 6 | boundary_10_not_in_bucket0 | Value equal to boundary is not in preceding bucket | `buckets[0].count == 0` when input is `10` |
| 7 | boundary_10_in_bucket1 | Value equal to boundary goes to bucket starting there | `buckets[1].count == 1` when input is `10` |
| 8 | empty_stdin_exit0 | Empty stdin exits cleanly | Exit code 0, all counts 0 |
| 8b | empty_stdin_all_zeros | Empty stdin produces zero histogram | All bucket counts 0, underflow 0 |
| 9 | nan_exit2 | NaN/non-numeric input triggers error | Exit code 2 |
| 10 | nan_stdout_empty | No output on NaN input | stdout is empty string |
| 11 | final_bucket_hi_key_present | Final bucket has `"hi"` key | Key present in last bucket object |
| 12 | final_bucket_hi_null | Final bucket `"hi"` value is null | `buckets[-1]["hi"] is None` |
