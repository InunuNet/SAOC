#!/usr/bin/env python3
"""Portable stand-in for `grep -Pzo` (PCRE, whole-file/multiline match). This project's dev
machine runs ugrep 7.8.4, which DOES support -P (PCRE) fine on its own -- `grep -P "t.st"`
works. The actual break is a flag collision: GNU grep overloads -z for null-data mode (which
is what makes -Pzo do whole-file/multiline matching), but ugrep overloads the same -z flag for
DECOMPRESS mode (zlib/bzip2/zstd/7z/tar) instead. So `grep -Pzo <pattern> <file>` on this
machine asks ugrep to treat the file as a compressed archive and it exits 2 -- nothing to do
with PCRE support, which is present and working. Verified by RUNNING it, not inferred
(2026-08-18, team-lead reproduced directly): `echo test | grep -P "t.st"` matched, exit 0;
`grep -Pzo 'foo\nbar' file` exited 2; `grep --version` reports ugrep 7.8.4.
Every multiline-regex assertion in this project's contracts must route through a real script
like this one instead of `-Pzo`, regardless of which grep variant is installed where. Uses
Python's stdlib re module (re.search over the whole file, DOTALL so `.` spans newlines) -- no
extra dependency beyond python3, which is already required elsewhere in this project's check
scripts and contract.py itself.

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
