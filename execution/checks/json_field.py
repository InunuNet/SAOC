#!/usr/bin/env python3
"""Print one value from a JSON file by dotted path. Exit 3 if the path is absent.

Usage: json_field.py <file.json> <dotted.path>
Scalars print bare; objects and lists print as compact JSON. A missing file or an
unparseable one exits 2 (usage/setup), a missing path exits 3 (BLOCKED — nothing learned),
so a contract assertion built on this never mistakes "could not look" for "looked and failed".
"""
import json
import sys

EXIT_USAGE = 2
EXIT_ABSENT = 3


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: json_field.py <file.json> <dotted.path>", file=sys.stderr)
        return EXIT_USAGE
    try:
        with open(sys.argv[1], encoding="utf-8") as handle:
            node = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"json_field.py: cannot read {sys.argv[1]}: {exc}", file=sys.stderr)
        return EXIT_USAGE
    for part in sys.argv[2].split("."):
        if isinstance(node, dict) and part in node:
            node = node[part]
        elif isinstance(node, list) and part.isdigit() and int(part) < len(node):
            node = node[int(part)]
        else:
            print(f"json_field.py: path {sys.argv[2]!r} absent in {sys.argv[1]}", file=sys.stderr)
            return EXIT_ABSENT
    if isinstance(node, (dict, list)):
        print(json.dumps(node, separators=(",", ":")))
    else:
        print(node)
    return 0


if __name__ == "__main__":
    sys.exit(main())
