#!/usr/bin/env python3
"""
check_no_broad_gh_issue.py — A12/A13 bypass-prevention verifier.

Usage: python3 check_no_broad_gh_issue.py <path-to-autonomy.toml>

For each [[rule]] block that does NOT contain 'InunuNet/Athanor':
  - Check if the block contains 'gh issue' as a pattern in commandRegex.
  - If found: print the offending block and exit 1.
  - If clean: exit 0.

Stdlib only (re, sys).
"""
import re
import sys


def main():
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <path-to-autonomy.toml>", file=sys.stderr)
        sys.exit(1)

    path = sys.argv[1]
    try:
        with open(path, "r") as f:
            content = f.read()
    except FileNotFoundError:
        print(f"ERROR: file not found: {path}", file=sys.stderr)
        sys.exit(1)

    # Split into [[rule]] blocks. The separator is [[rule]] itself.
    # We keep the separator by splitting on the marker and rejoining.
    raw_blocks = re.split(r"(?=\[\[rule\]\])", content)

    offenders = []
    for block in raw_blocks:
        # Skip blocks that don't contain a [[rule]] header (e.g. leading comments).
        if "[[rule]]" not in block:
            continue

        # Blocks that are scoped to InunuNet/Athanor are the narrow, sanctioned rule — skip.
        if "InunuNet/Athanor" in block:
            continue

        # Check for 'gh issue' appearing inside a commandRegex value.
        # We look for the literal text 'gh issue' anywhere in the block
        # since it only appears meaningfully inside commandRegex strings.
        if re.search(r"gh issue", block):
            offenders.append(block.strip())

    if offenders:
        print(f"FAIL: broad commandRegex contains 'gh issue' outside InunuNet/Athanor scope.")
        print(f"Offending block(s) in {path}:\n")
        for b in offenders:
            print("---")
            print(b)
            print("---")
        sys.exit(1)

    print(f"OK: no broad 'gh issue' pattern found outside the scoped InunuNet/Athanor rule.")
    sys.exit(0)


if __name__ == "__main__":
    main()
