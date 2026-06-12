# csv_differ

A Python 3 CLI that compares two CSV files and emits a human-readable or JSON diff. Uses only Python stdlib — no third-party dependencies.

## Usage

```
python3 csv_differ.py [--json] [--key COL] A.csv B.csv
python3 csv_differ.py --help
```

### Arguments

| Argument | Description |
|----------|-------------|
| `A.csv` | First CSV file (baseline) |
| `B.csv` | Second CSV file (comparison target) |
| `--json` | Emit machine-readable JSON instead of human-readable output |
| `--key COL` | Column to use as the row identifier (default: first column) |

## Output Format

### Human-readable (default)

One line per difference:

```
CHANGED row id=1: score 90 -> 95
ADDED row id=4: name=dave, score=55
REMOVED row id=2: name=bob, score=80
column mismatch: a has [id, name, score]; b has [id, name, grade]
```

- `CHANGED`: one line per changed cell, ordered by column order in file A
- `ADDED`: non-key columns in file-B column order
- `REMOVED`: non-key columns in file-A column order
- Rows emitted in ascending key order (string sort)
- Identical files: zero bytes on stdout (no output, no trailing newline)

### JSON (`--json`)

```json
{
  "changed": [{"key": "1", "column": "score", "old": "90", "new": "95"}],
  "added":   [{"key": "4", "row": {"id": "4", "name": "dave", "score": "55"}}],
  "removed": [],
  "column_mismatch": null
}
```

Always a single JSON object terminated by a newline. Empty arrays for absent categories. `column_mismatch` is `null` when columns match, or `{"a": [...], "b": [...]}` when they differ.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Files are identical (no differences) |
| 1 | Files differ (any change, addition, removal, or column mismatch) |
| 2 | Error — missing file, malformed CSV, duplicate keys, bad arguments |

## Examples

```bash
# Human-readable diff
python3 csv_differ.py before.csv after.csv

# JSON output
python3 csv_differ.py --json before.csv after.csv

# Use 'email' column as the key instead of the first column
python3 csv_differ.py --key email users_a.csv users_b.csv

# Pipe JSON to jq for filtering
python3 csv_differ.py --json a.csv b.csv | jq '.changed[]'
```

## Notes

- Parses CSV via Python's `csv` module — handles quoted commas and quoted quotes correctly.
- UTF-8 with BOM is supported (BOM stripped from header line automatically).
- Duplicate keys in either file cause exit 2 with a descriptive error message.
- Column-set differences produce a single summary line and exit 1 (no row-level diff attempted).
