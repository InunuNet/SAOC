#!/usr/bin/env python3
"""csv_differ.py — compare two CSV files and emit a human-readable or JSON diff."""

import argparse
import csv
import json
import sys


def read_csv(path):
    """Read a CSV file and return (headers, rows_dict).

    rows_dict maps key_value -> {col: val, ...}
    Returns (headers, rows_dict, key_order) where key_order preserves row order.
    Raises SystemExit(2) on file or parse errors.
    """
    try:
        with open(path, newline="", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            try:
                headers = next(reader)
            except StopIteration:
                print(f"error: {path} is empty (no header row)", file=sys.stderr)
                sys.exit(2)
            rows = {}
            order = []
            for row in reader:
                if not row:
                    continue
                row_dict = dict(zip(headers, row))
                key_val = row_dict[headers[0]]
                if key_val in rows:
                    print(
                        f"error: duplicate key '{key_val}' in {path}", file=sys.stderr
                    )
                    sys.exit(2)
                rows[key_val] = row_dict
                order.append(key_val)
            return headers, rows, order
    except FileNotFoundError:
        print(f"error: file not found: {path}", file=sys.stderr)
        sys.exit(2)
    except csv.Error as e:
        print(f"error: CSV parse error in {path}: {e}", file=sys.stderr)
        sys.exit(2)


def diff_csvs(path_a, path_b, key_col=None, emit_json=False):
    headers_a, rows_a, order_a = read_csv(path_a)
    headers_b, rows_b, order_b = read_csv(path_b)

    # Determine key column
    if key_col is None:
        key_col = headers_a[0]

    if key_col not in headers_a:
        print(f"error: key column '{key_col}' not found in {path_a}", file=sys.stderr)
        sys.exit(2)
    if key_col not in headers_b:
        print(f"error: key column '{key_col}' not found in {path_b}", file=sys.stderr)
        sys.exit(2)

    # Re-key if key_col is not the first column (it is by default, but support --key)
    if key_col != headers_a[0]:
        # Re-read with correct key
        new_rows_a = {}
        for row in rows_a.values():
            k = row[key_col]
            if k in new_rows_a:
                print(f"error: duplicate key '{k}' in {path_a}", file=sys.stderr)
                sys.exit(2)
            new_rows_a[k] = row
        rows_a = new_rows_a

        new_rows_b = {}
        for row in rows_b.values():
            k = row[key_col]
            if k in new_rows_b:
                print(f"error: duplicate key '{k}' in {path_b}", file=sys.stderr)
                sys.exit(2)
            new_rows_b[k] = row
        rows_b = new_rows_b

    # Check column mismatch
    if set(headers_a) != set(headers_b):
        mismatch_msg = (
            f"column mismatch: a has [{', '.join(headers_a)}]; "
            f"b has [{', '.join(headers_b)}]"
        )
        if emit_json:
            result = {
                "changed": [],
                "added": [],
                "removed": [],
                "column_mismatch": {"a": headers_a, "b": headers_b},
            }
            print(json.dumps(result))
        else:
            print(mismatch_msg)
        sys.exit(1)

    # Non-key columns in file-A order
    non_key_cols_a = [c for c in headers_a if c != key_col]

    # Compute diffs
    changed = []
    added = []
    removed = []

    all_keys = sorted(set(list(rows_a.keys()) + list(rows_b.keys())))

    for key in all_keys:
        in_a = key in rows_a
        in_b = key in rows_b

        if in_a and in_b:
            row_a = rows_a[key]
            row_b = rows_b[key]
            for col in headers_a:
                if col == key_col:
                    continue
                val_a = row_a.get(col, "")
                val_b = row_b.get(col, "")
                if val_a != val_b:
                    changed.append(
                        {"key": key, "column": col, "old": val_a, "new": val_b}
                    )
        elif in_a and not in_b:
            removed.append({"key": key, "row": rows_a[key]})
        elif in_b and not in_a:
            added.append({"key": key, "row": rows_b[key]})

    if emit_json:
        result = {
            "changed": changed,
            "added": added,
            "removed": removed,
            "column_mismatch": None,
        }
        print(json.dumps(result))
        if changed or added or removed:
            sys.exit(1)
        else:
            sys.exit(0)
    else:
        # Human-readable output
        lines = []

        for entry in changed:
            key = entry["key"]
            col = entry["column"]
            old = entry["old"]
            new = entry["new"]
            lines.append(f"CHANGED row {key_col}={key}: {col} {old} -> {new}")

        for entry in added:
            key = entry["key"]
            row = entry["row"]
            # Non-key columns in file-B column order (per spec: for ADDED rows)
            non_key_cols_b = [c for c in headers_b if c != key_col]
            parts = [f"{c}={row[c]}" for c in non_key_cols_b]
            lines.append(f"ADDED row {key_col}={key}: {', '.join(parts)}")

        for entry in removed:
            key = entry["key"]
            row = entry["row"]
            parts = [f"{c}={row[c]}" for c in non_key_cols_a]
            lines.append(f"REMOVED row {key_col}={key}: {', '.join(parts)}")

        if lines:
            print("\n".join(lines))
            sys.exit(1)
        else:
            sys.exit(0)


def main():
    parser = argparse.ArgumentParser(
        description="Compare two CSV files and report differences."
    )
    parser.add_argument("a", metavar="A.csv", help="First CSV file")
    parser.add_argument("b", metavar="B.csv", help="Second CSV file")
    parser.add_argument(
        "--json", action="store_true", dest="emit_json", help="Emit JSON output"
    )
    parser.add_argument(
        "--key", metavar="COL", default=None, help="Column to use as row identifier"
    )
    args = parser.parse_args()
    diff_csvs(args.a, args.b, key_col=args.key, emit_json=args.emit_json)


if __name__ == "__main__":
    main()
