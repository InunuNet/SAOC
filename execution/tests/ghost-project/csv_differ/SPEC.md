# csv_differ — SPEC

## Goal

A self-contained Python 3 CLI (`csv_differ.py`) that compares two CSV files and emits a human-readable diff (or JSON). Used as a ghost project to validate the Athanor agent chain — the implementation is incidental; the binary-verifiable behaviour is the contract.

The tool must use only Python 3.10+ stdlib (no third-party deps). All output is deterministic for a given pair of inputs.

## CLI Interface

```
python3 csv_differ.py [--json] [--key COL] A.csv B.csv
python3 csv_differ.py --help
```

- Positional args: `A.csv` and `B.csv` — both required (unless `--help`).
- `--json` — emit machine-readable JSON instead of the human-readable form.
- `--key COL` — column to use as the row identifier (default: first column).
- `--help` — print usage and exit 0.

### Human-readable output (default)

For each difference, exactly one line:

- `CHANGED row <key>=<value>: <col> <old> -> <new>` (one line per changed cell; if multiple cells changed in the same row, one line per cell, ordered by column order in file A)
- `ADDED row <key>=<value>: <col1>=<val1>, <col2>=<val2>, ...` (non-key columns in file-A column order; for ADDED rows, use file-B column order)
- `REMOVED row <key>=<value>: <col1>=<val1>, ...`
- Rows are emitted in ascending key order (string sort).
- If the two files have different column sets, emit exactly one line: `column mismatch: a has [c1, c2, ...]; b has [c1, c2, ...]` and exit 1. Do not attempt a row-level diff.
- Identical files: emit nothing (no trailing newline either) and exit 0.

### JSON output (`--json`)

```json
{
  "changed": [{"key": "1", "column": "score", "old": "90", "new": "95"}, ...],
  "added":   [{"key": "4", "row": {"id":"4","name":"dave","score":"55"}}, ...],
  "removed": [...],
  "column_mismatch": null  // or {"a": [...], "b": [...]}
}
```

Always a single JSON object on stdout, terminated by a newline. Empty arrays for absent categories. Must parse cleanly via `python3 -m json.tool`.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Files identical (no differences detected) |
| 1 | Files differ (any change, addition, removal, or column mismatch) |
| 2 | Error — missing file, malformed CSV that cannot be read, bad arguments |

Exit code is part of the contract. Do not exit 0 on differences.

## Golden Pairs

All paths relative to `execution/tests/ghost-project/csv_differ/`.

1. `goldens/a1.csv` vs `goldens/b1.csv` → `goldens/expected1.txt`
   - 2 rows changed (id=1 score, id=3 score), 1 row added (id=4).
   - Exit 1.
2. `goldens/a2.csv` vs `goldens/b2.csv` → `goldens/expected2.txt`
   - Identical files. Empty output. Exit 0.
3. `goldens/a3.csv` vs `goldens/b3.csv` → `goldens/expected3.txt`
   - Different column sets (`score` vs `grade`). Output contains the word "column". Exit 1.

## Adversarial Cases

- **Quoted commas**: `goldens/quoted.csv` contains rows with quoted commas and quoted quotes. The CLI must parse via `csv.reader` (or equivalent) — no naive `split(',')`. It must not crash. Comparing `quoted.csv` against `b1.csv` must exit 0 or 1, never 2.
- **Missing file**: a nonexistent path must produce a clear stderr message and exit 2 (never traceback to stdout).
- **Empty file**: a CSV with only a header is valid; comparing against a file with rows produces only ADDED/REMOVED lines.
- **Non-UTF-8 bytes**: out of scope for v1 — but the parser must not blow up on UTF-8 with BOM (strip BOM if present on the header line).
- **Duplicate keys**: if a key appears twice in either file, exit 2 with a message naming the duplicated key.

## Trap List (@dev MUST NOT)

1. **Do not split on commas.** Use the stdlib `csv` module. A regex or `line.split(',')` will fail the quoted-commas adversarial assertion.
2. **Do not exit 0 when differences are present.** Identical files = 0, any difference = 1, error = 2. Returning 0 from a successful diff run silently passes a broken implementation.
3. **Do not write the diff to stderr.** Human and JSON output go to stdout. Errors and warnings go to stderr. The golden comparison reads stdout.
4. **Do not produce a trailing newline on identical files.** Exit 0 with zero bytes on stdout. The contract checks `output is empty`.
5. **Do not import non-stdlib packages.** No `pandas`, no `csvdiff`, no `rich`. Stdlib only — the test environment has no pip install step.
6. **Do not skip the README.** D1 asserts `README.md` exists at the project root.
