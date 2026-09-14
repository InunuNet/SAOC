#!/usr/bin/env python3
"""F8 (ticketing-complete M4) -- contract-f8.yaml A10, negative control A21.

Proves every open decision surfaced in the golden source
(.agent/memory/project/specs/ticketing-complete/goldens/f2-open-decisions.json) is actually
present in the morning-review walkthrough F8 hands Brad -- mechanically, against the SAME
golden F2's own A12 reads, never a second hand-typed keyword list that could silently drift
from it.

For every item in the golden's `requiredItems`, EVERY one of that item's `mustContain`
substrings must appear somewhere in the walkthrough doc (case-insensitive). Missing even one
substring of one item fails the whole check -- "most of them covered" is not coverage.

Usage:
    python3 verify_open_decisions_coverage.py <walkthrough.md> <f2-open-decisions.json>

Exit 0 = every item fully covered. Exit 1 = at least one item has a missing substring, or the
input could not be read/parsed (fail closed -- never exit 0 on "couldn't check").
"""

import json
import sys


def fail(message):
    print(f"FAIL: verify_open_decisions_coverage.py\n  - {message}", file=sys.stderr)
    sys.exit(1)


def main():
    if len(sys.argv) != 3:
        fail(
            "expected exactly 2 arguments: <walkthrough.md> <f2-open-decisions.json>, got "
            f"{len(sys.argv) - 1}"
        )

    doc_path, golden_path = sys.argv[1], sys.argv[2]

    try:
        with open(doc_path, "r", encoding="utf-8") as fh:
            doc_text = fh.read()
    except OSError as exc:
        fail(f"could not read walkthrough doc at {doc_path}: {exc}")

    try:
        with open(golden_path, "r", encoding="utf-8") as fh:
            golden_raw = fh.read()
    except OSError as exc:
        fail(f"could not read golden at {golden_path}: {exc}")

    try:
        golden = json.loads(golden_raw)
    except json.JSONDecodeError as exc:
        fail(f"golden at {golden_path} is not valid JSON: {exc}")

    required_items = golden.get("requiredItems")
    if not isinstance(required_items, list) or len(required_items) == 0:
        fail(f"golden at {golden_path} has no non-empty 'requiredItems' array")

    doc_lower = doc_text.lower()
    incomplete = []

    for item in required_items:
        item_id = item.get("id")
        must_contain = item.get("mustContain")
        if not item_id or not isinstance(must_contain, list) or len(must_contain) == 0:
            fail(
                f"golden item {item!r} is malformed -- expected a non-empty 'id' and a "
                "non-empty 'mustContain' array"
            )

        missing = [s for s in must_contain if s.lower() not in doc_lower]
        if missing:
            incomplete.append((item_id, missing))

    if incomplete:
        print("FAIL: verify_open_decisions_coverage.py", file=sys.stderr)
        for item_id, missing in incomplete:
            print(f"  - {item_id}: missing substring(s) {missing!r}", file=sys.stderr)
        sys.exit(1)

    print(
        f"PASS: all {len(required_items)} open decisions from {golden_path} are fully "
        f"covered in {doc_path}."
    )


if __name__ == "__main__":
    main()
