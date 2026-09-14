#!/usr/bin/env python3
"""Verify a named argparse.Namespace block contains a substring before its closing paren.

Usage: verify_block_contains.py <file> <anchor> <needle>
  <anchor>: text marking the start line, e.g. "single_phase_args = argparse.Namespace("
  <needle>: substring that must appear after the anchor and before the first line
            whose stripped content is exactly ")"
Exits 0 if found, 1 otherwise.
"""
import sys


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: verify_block_contains.py <file> <anchor> <needle>", file=sys.stderr)
        return 2
    path, anchor, needle = sys.argv[1], sys.argv[2], sys.argv[3]
    try:
        lines = open(path, encoding="utf-8").read().splitlines()
    except OSError as exc:
        print(f"cannot read {path}: {exc}", file=sys.stderr)
        return 2
    in_block = False
    for line in lines:
        if not in_block:
            if anchor in line:
                in_block = True
            continue
        if line.strip() == ")":
            break
        if needle in line:
            return 0
    print(f"needle {needle!r} not found inside block {anchor!r} in {path}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
