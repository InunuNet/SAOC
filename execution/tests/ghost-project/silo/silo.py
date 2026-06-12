#!/usr/bin/env python3
"""
Silo — Per-(type,key) Actor Instantiation Registry
Spec: SPEC.md

CLI: python3 silo.py invocations.txt

Input: tab-separated, one event per line
  INIT<TAB>AGENT_TYPE<TAB>KEY
  INCREMENT<TAB>AGENT_TYPE<TAB>KEY
  GET<TAB>AGENT_TYPE<TAB>KEY

Registry key is the TUPLE (AGENT_TYPE, KEY) — never AGENT_TYPE alone.

Exit codes:
  0 — all operations succeeded
  2 — any error (duplicate INIT, uninitialized pair, bad operation, bad fields, empty line)
"""

import sys


VALID_OPERATIONS = {"INIT", "INCREMENT", "GET"}


def load_invocations(path: str) -> list[tuple[int, str, str, str]]:
    """
    Parse the invocations file.
    Returns list of (lineno, operation, agent_type, key).
    Exits 2 on any parse error (empty line, wrong field count, unknown op).
    """
    try:
        with open(path) as f:
            raw_lines = f.readlines()
    except OSError as exc:
        print(f"ERROR: cannot read {path}: {exc}", file=sys.stderr)
        sys.exit(2)

    events = []
    for lineno, raw in enumerate(raw_lines, 1):
        line = raw.rstrip("\n")

        # Empty lines are an error
        if not line.strip():
            print(f"ERROR: line {lineno}: empty line", file=sys.stderr)
            sys.exit(2)

        parts = line.split("\t")
        if len(parts) != 3:
            print(
                f"ERROR: line {lineno}: expected 3 tab-separated fields, got {len(parts)}",
                file=sys.stderr,
            )
            sys.exit(2)

        agent_type, key, operation = parts[0], parts[1], parts[2]

        if operation not in VALID_OPERATIONS:
            print(
                f"ERROR: line {lineno}: unknown operation {operation!r}",
                file=sys.stderr,
            )
            sys.exit(2)

        events.append((lineno, operation, agent_type, key))

    return events


def run(events: list[tuple[int, str, str, str]]) -> None:
    """
    Process events against the registry.
    Registry key: (agent_type, key) tuple — isolation by BOTH dimensions.
    Exits 2 on any error; prints GET results to stdout.
    """
    registry: dict[tuple[str, str], int] = {}
    output_lines: list[str] = []

    for lineno, operation, agent_type, key in events:
        pair = (agent_type, key)

        if operation == "INIT":
            if pair in registry:
                print(
                    f"ERROR: line {lineno}: duplicate INIT for ({agent_type!r}, {key!r})",
                    file=sys.stderr,
                )
                sys.exit(2)
            registry[pair] = 0

        elif operation == "INCREMENT":
            if pair not in registry:
                print(
                    f"ERROR: line {lineno}: INCREMENT on uninitialized ({agent_type!r}, {key!r})",
                    file=sys.stderr,
                )
                sys.exit(2)
            registry[pair] += 1

        elif operation == "GET":
            if pair not in registry:
                print(
                    f"ERROR: line {lineno}: GET on uninitialized ({agent_type!r}, {key!r})",
                    file=sys.stderr,
                )
                sys.exit(2)
            output_lines.append(f"{agent_type} {key} {registry[pair]}")

    # All operations succeeded — emit GET output
    for line in output_lines:
        print(line)


def main(argv=None) -> None:
    if argv is None:
        argv = sys.argv[1:]

    if len(argv) != 1:
        print(f"Usage: python3 silo.py <invocations.txt>", file=sys.stderr)
        sys.exit(2)

    events = load_invocations(argv[0])
    run(events)
    sys.exit(0)


if __name__ == "__main__":
    main()
