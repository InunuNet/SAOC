#!/usr/bin/env python3
"""Exit 0 iff a numeric JSON field lies inside a closed two-sided window.

Usage: json_in_window.py <file.json> <dotted.path> <min> <max>
Exit 0: min <= value <= max.  Exit 1: value present but outside the window (FAIL).
Exit 2: usage error / unreadable file.  Exit 3: path absent or non-numeric (BLOCKED).
Two-sided on purpose: a floor alone is a tuning surface (learned.md, NOS M7/M8 post-mortem).
"""
import json
import sys

EXIT_FAIL = 1
EXIT_USAGE = 2
EXIT_ABSENT = 3


def main() -> int:
    if len(sys.argv) != 5:
        print("usage: json_in_window.py <file.json> <dotted.path> <min> <max>", file=sys.stderr)
        return EXIT_USAGE
    file_path, dotted, lo_text, hi_text = sys.argv[1:]
    try:
        lo, hi = float(lo_text), float(hi_text)
    except ValueError:
        print("json_in_window.py: min and max must be numbers", file=sys.stderr)
        return EXIT_USAGE
    try:
        with open(file_path, encoding="utf-8") as handle:
            node = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"json_in_window.py: cannot read {file_path}: {exc}", file=sys.stderr)
        return EXIT_USAGE
    for part in dotted.split("."):
        if isinstance(node, dict) and part in node:
            node = node[part]
        elif isinstance(node, list) and part.isdigit() and int(part) < len(node):
            node = node[int(part)]
        else:
            print(f"json_in_window.py: path {dotted!r} absent in {file_path}", file=sys.stderr)
            return EXIT_ABSENT
    if isinstance(node, bool) or not isinstance(node, (int, float)):
        print(f"json_in_window.py: {dotted!r} is not numeric ({node!r})", file=sys.stderr)
        return EXIT_ABSENT
    inside = lo <= node <= hi
    print(f"{dotted} = {node} {'in' if inside else 'OUTSIDE'} [{lo}, {hi}]")
    return 0 if inside else EXIT_FAIL


if __name__ == "__main__":
    sys.exit(main())
