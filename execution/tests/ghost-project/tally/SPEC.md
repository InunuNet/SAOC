# SPEC: tally

## One-liner

CSV aggregator that sums amounts by ID using banker's rounding and outputs a structured JSON report with group totals and a grand total.

## Requirements

- Accepts exactly one positional argument: path to a CSV file.
- The CSV must have a header row containing at least the columns `id` and `amount`.
- All arithmetic uses `decimal.Decimal`; float arithmetic is forbidden.
- Amounts are summed exactly per group (no rounding during accumulation).
- Each group's `raw_total` is the exact Decimal sum, formatted to exactly 4 decimal places.
- Each group's `rounded_total` is the `raw_total` rounded to 2 decimal places using `decimal.ROUND_HALF_EVEN` (banker's rounding).
- `grand_total` is the sum of already-rounded group totals, also rounded to 2 decimal places with `ROUND_HALF_EVEN`.
- Groups are sorted lexicographically by `id` string (e.g., `"10"` < `"2"` < `"a"`).
- Output is a single JSON line with `sort_keys=True` and no spaces around separators, followed by a trailing newline.
- On malformed input (non-numeric amount, missing required columns): exit 1, stdout is empty.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Malformed input — non-numeric amount or missing required columns |

## Pre-seeded Traps

- **Float arithmetic**: Using `float` instead of `decimal.Decimal` introduces drift. The test for group `c` (`0.1 + 0.2 == 0.3000` exactly) will fail with float.
- **Standard rounding instead of banker's**: Python's built-in `round()` uses banker's rounding for half cases but `decimal.Decimal.quantize()` with `ROUND_HALF_EVEN` is the required approach. Using `ROUND_HALF_UP` causes `2.125 → 2.13` instead of `2.12`.
- **Rounding during accumulation**: Rounding each row's amount before summing distorts group totals. Accumulate exact Decimal values; round once at the group level.
- **Grand total from raw, not rounded**: `grand_total` must sum the rounded group totals, not the raw Decimal sums. Summing raw totals and rounding once produces different results when rounding is non-trivial.
- **Numeric sort for id**: Groups must be sorted as strings, not numerically. `"10"` must precede `"2"` because `"1" < "2"` lexicographically.
- **Fixed decimal formatting**: `raw_total` must always display 4 decimal places (e.g., `"1.5000"`, not `"1.5"`). `rounded_total` must always display 2 decimal places. Use `str(value)` only after quantizing to the correct precision.
- **Stdout on error**: On exit 1, stdout must be completely empty — no partial output, no error message.

## Binary Test Assertion Table

| # | Test name | What it tests | Expected outcome |
|---|-----------|---------------|-----------------|
| 1 | test_exact_stdout_match | Full stdout matches fixture exactly | Byte-identical to expected.json |
| 2 | test_exit_0_on_success | Exit code on valid input | Exit code 0 |
| 3 | test_group_10_is_first | Lexicographic sort of id strings | First group `id == "10"` |
| 4 | test_banker_rounding_down | ROUND_HALF_EVEN rounds half-down to even | Group `a`: 2.125 → `"2.12"` |
| 5 | test_banker_rounding_up | ROUND_HALF_EVEN rounds half-up to even | Group `b`: 2.135 → `"2.14"` |
| 6 | test_no_float_drift | Decimal arithmetic: 0.1+0.2 is exact | Group `c` raw_total == `"0.3000"` |
| 7 | test_grand_total | Grand total is sum of rounded group totals | `grand_total == "8.56"` |
| 8 | test_bad_input_exit_1 | Exit code on malformed CSV | Exit code 1 |
| 9 | test_bad_input_empty_stdout | No output on malformed CSV | stdout is empty string |
| 10 | test_raw_total_four_decimal_places | raw_total always has exactly 4dp | All groups: `.split(".")[1]` has length 4 |
| 11 | test_rounded_total_two_decimal_places | rounded_total always has exactly 2dp | All groups: `.split(".")[1]` has length 2 |
| 12 | test_group_count | All groups present | Output contains exactly 5 groups |
