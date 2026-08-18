#!/usr/bin/env python3
"""Portable stand-in for `grep -Pzo` (PCRE, whole-file/multiline match), for environments
without GNU/PCRE grep -- confirmed on 2026-08-18 that this project's own dev machine has only
BSD grep with no -P support and no ggrep installed, so every multiline-regex assertion in this
contract must route through this script instead. Uses Python's stdlib re module (re.search
over the whole file, DOTALL so `.` spans newlines) -- no extra dependency beyond python3,
which is already required elsewhere in this project's check scripts and contract.py itself.

Usage: python3 check_regex.py <file> <pattern>
Exit 0 + PASS line on match, exit 1 + FAIL line (to stderr) on no match, exit 2 on usage error.
"""
import re
import sys

def main() -> int:
    if len(sys.argv) != 3:
        print("usage: check_regex.py <file> <pattern>", file=sys.stderr)
        return 2
    file_path, pattern = sys.argv[1], sys.argv[2]
    try:
        content = open(file_path, encoding="utf-8").read()
    except OSError as exc:
        print(f"FAIL: could not read {file_path}: {exc}", file=sys.stderr)
        return 1
    if re.search(pattern, content, re.DOTALL):
        print(f"PASS: pattern matched in {file_path}")
        return 0
    print(f"FAIL: pattern not found in {file_path}: {pattern}", file=sys.stderr)
    return 1

if __name__ == "__main__":
    sys.exit(main())
