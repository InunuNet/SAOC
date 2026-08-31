#!/usr/bin/env python3
"""Fail if RUNTIME_ARTIFACT_EXCLUDES in a wrap_mission.sh-style file contains
a glob/wildcard metacharacter -- entries must be exact literal paths.

Usage: python3 execution/checks/no_glob_in_excludes.py <path-to-wrap_mission.sh>
"""
import sys

GLOB_CHARS = set("*?[]")
ARRAY_START = "RUNTIME_ARTIFACT_EXCLUDES=("


def extract_entries(lines: list[str]) -> list[str]:
    entries = []
    in_array = False
    for line in lines:
        if not in_array:
            if ARRAY_START in line:
                in_array = True
            continue
        stripped = line.strip()
        if stripped == ")":
            break
        if stripped:
            entries.append(stripped)
    return entries


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: no_glob_in_excludes.py <path-to-wrap_mission.sh>", file=sys.stderr)
        return 1

    target = sys.argv[1]
    with open(target, encoding="utf-8") as f:
        lines = f.readlines()

    entries = extract_entries(lines)
    if not entries:
        print(f"FAIL: RUNTIME_ARTIFACT_EXCLUDES array is missing or empty in {target}", file=sys.stderr)
        return 1

    offenders = [entry for entry in entries if GLOB_CHARS & set(entry)]
    if offenders:
        print("FAIL: RUNTIME_ARTIFACT_EXCLUDES contains glob metacharacter(s):", file=sys.stderr)
        for offender in offenders:
            print(f"  {offender}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
