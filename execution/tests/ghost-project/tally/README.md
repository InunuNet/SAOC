# Tally

CSV aggregator that sums amounts by ID using banker's rounding (ROUND_HALF_EVEN).

## Usage

```bash
python3 tally.py input.csv
```

Input CSV must have a header row with columns `id` and `amount`. Rows are grouped
by `id`, amounts summed using `decimal.Decimal` (no float arithmetic), then each
group total is rounded to 2 decimal places with banker's rounding.

## Rounding Rule

`decimal.ROUND_HALF_EVEN` — "round half to even" (banker's rounding):

- 2.125 → 2.12 (2 is even)
- 2.135 → 2.14 (4 is even)

`grand_total` is the sum of already-rounded group totals, also rounded with ROUND_HALF_EVEN.

## Output Format

Single-line JSON with `sort_keys=True`, trailing newline:

```json
{"grand_total":"8.56","groups":[{"id":"10","raw_total":"1.5000","rounded_total":"1.50"},{"id":"2","raw_total":"2.5000","rounded_total":"2.50"},...]}
```

- `raw_total`: 4 decimal places (exact Decimal sum)
- `rounded_total`: 2 decimal places (banker's rounded)
- Groups are sorted lexicographically by `id` (`"10"` before `"2"` before `"a"`)

## Error Handling

Malformed input (non-numeric amount, missing columns) → exit 1, empty stdout.

## Tests

```bash
cd tests && bash run_tests.sh
```
