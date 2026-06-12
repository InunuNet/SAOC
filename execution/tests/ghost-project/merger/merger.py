#!/usr/bin/env python3
"""
Merger — Per-Key Reducer Registry with Parallel-Write Conflict Detection
Spec: SPEC.md
"""

import sys


VALID_REDUCERS = {"append", "overwrite", "none"}


def parse_commands(path: str) -> list[list[str]]:
    """
    Read commands file. Each non-empty line is split on spaces into tokens.
    Returns list of token lists.
    Exits 2 on unknown command or wrong token count.
    """
    try:
        with open(path) as f:
            lines = f.readlines()
    except OSError as exc:
        print(f"ERROR: cannot read {path}: {exc}", file=sys.stderr)
        sys.exit(2)

    commands = []
    for lineno, line in enumerate(lines, 1):
        line = line.rstrip("\n")
        if not line.strip():
            continue
        tokens = line.split(" ")
        cmd = tokens[0]

        if cmd == "REGISTER":
            if len(tokens) != 3:
                print(f"ERROR: REGISTER requires 2 args, line {lineno}: {line!r}", file=sys.stderr)
                sys.exit(2)
            reducer = tokens[2]
            if reducer not in VALID_REDUCERS:
                print(f"ERROR: unknown reducer {reducer!r} on line {lineno}", file=sys.stderr)
                sys.exit(2)

        elif cmd == "STEP":
            if len(tokens) != 1:
                print(f"ERROR: STEP takes no args, line {lineno}: {line!r}", file=sys.stderr)
                sys.exit(2)

        elif cmd == "UPDATE":
            if len(tokens) < 3:
                print(f"ERROR: UPDATE requires KEY and VALUE, line {lineno}: {line!r}", file=sys.stderr)
                sys.exit(2)

        elif cmd == "APPLY":
            if len(tokens) != 1:
                print(f"ERROR: APPLY takes no args, line {lineno}: {line!r}", file=sys.stderr)
                sys.exit(2)

        elif cmd == "GET":
            if len(tokens) != 2:
                print(f"ERROR: GET requires exactly 1 arg, line {lineno}: {line!r}", file=sys.stderr)
                sys.exit(2)

        else:
            print(f"ERROR: unknown command {cmd!r} on line {lineno}", file=sys.stderr)
            sys.exit(2)

        commands.append(tokens)

    return commands


def run(commands: list[list[str]]) -> None:
    """
    Execute commands against the merger state machine.
    Prints output for CONFLICT, UNREGISTERED, and GET.
    """
    # Registry: key -> reducer name
    registry: dict[str, str] = {}
    # Stored values: key -> str
    stored: dict[str, str] = {}
    # Accumulator: ordered dict key -> list of values (first-touch order)
    # Using a plain dict (insertion-ordered in Python 3.7+)
    accumulator: dict[str, list[str]] = {}

    for tokens in commands:
        cmd = tokens[0]

        if cmd == "REGISTER":
            _, key, reducer = tokens
            registry[key] = reducer

        elif cmd == "STEP":
            accumulator.clear()

        elif cmd == "UPDATE":
            key = tokens[1]
            # VALUE = everything after "KEY " — rejoin with spaces
            value = " ".join(tokens[2:])
            if key not in accumulator:
                accumulator[key] = []
            accumulator[key].append(value)

        elif cmd == "APPLY":
            # Process keys in first-touch (insertion) order
            for key, pending in accumulator.items():
                if key not in registry:
                    print(f"UNREGISTERED {key}")
                    continue

                reducer = registry[key]

                if reducer == "none":
                    if len(pending) >= 2:
                        print(f"CONFLICT {key}")
                        # Do NOT change stored value
                    else:
                        # Exactly 1 pending write
                        stored[key] = pending[0]

                elif reducer == "append":
                    if key in stored:
                        all_values = [stored[key]] + pending
                    else:
                        all_values = list(pending)
                    stored[key] = "|".join(all_values)

                elif reducer == "overwrite":
                    stored[key] = pending[-1]

            accumulator.clear()

        elif cmd == "GET":
            key = tokens[1]
            if key in stored:
                print(f"{key}: {stored[key]}")
            else:
                print(f"{key}: <unset>")


def main(argv=None):
    if argv is None:
        argv = sys.argv[1:]

    if len(argv) != 1:
        print(f"ERROR: usage: merger.py <commands.txt>", file=sys.stderr)
        sys.exit(2)

    commands = parse_commands(argv[0])
    run(commands)
    sys.exit(0)


if __name__ == "__main__":
    main()
