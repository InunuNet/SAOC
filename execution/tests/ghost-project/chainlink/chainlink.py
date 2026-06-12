#!/usr/bin/env python3
"""chainlink — ordered guardrail chain with retry logic."""

import sys

MAX_ATTEMPTS = 4
VALID_TYPES = {"transform", "validate", "counter_validate"}


def parse_guardrails(path):
    """Parse guardrails file. Returns list of (id, type, param) or exits 2."""
    try:
        with open(path, "r") as f:
            content = f.read()
    except OSError as e:
        print(f"Error reading {path}: {e}", file=sys.stderr)
        sys.exit(2)

    lines = [line.rstrip('\n') for line in content.splitlines()]
    # Filter out empty lines at end (trailing newline produces empty string)
    lines = [line for line in lines if line]

    if not lines:
        print("Error: guardrails file is empty", file=sys.stderr)
        sys.exit(2)

    guardrails = []
    seen_ids = set()

    for line in lines:
        fields = line.split('\t')
        if len(fields) != 3:
            print(f"Error: expected 3 tab-separated fields, got {len(fields)}: {line!r}",
                  file=sys.stderr)
            sys.exit(2)

        gid, gtype, param = fields

        if gtype not in VALID_TYPES:
            print(f"Error: unknown TYPE {gtype!r}", file=sys.stderr)
            sys.exit(2)

        if gid in seen_ids:
            print(f"Error: duplicate GUARDRAIL_ID {gid!r}", file=sys.stderr)
            sys.exit(2)
        seen_ids.add(gid)

        if gtype == "counter_validate":
            try:
                val = int(param)
                if val < 1:
                    raise ValueError("not positive")
            except ValueError:
                print(f"Error: counter_validate PARAM must be a positive integer, got {param!r}",
                      file=sys.stderr)
                sys.exit(2)

        guardrails.append((gid, gtype, param))

    return guardrails


def parse_input(path):
    """Parse input file. Returns original_input string or exits 2."""
    try:
        with open(path, "r") as f:
            content = f.read()
    except OSError as e:
        print(f"Error reading {path}: {e}", file=sys.stderr)
        sys.exit(2)

    original_input = content.rstrip('\n')

    if not original_input:
        print("Error: input file is empty", file=sys.stderr)
        sys.exit(2)

    return original_input


def apply_guardrail(gid, gtype, param, state, attempt_number):
    """Apply a single guardrail. Returns (new_state, passed)."""
    if gtype == "transform":
        new_state = param + "|" + state
        return new_state, True
    elif gtype == "validate":
        passed = param in state
        return state, passed
    elif gtype == "counter_validate":
        passed = attempt_number >= int(param)
        return state, passed


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <guardrails.txt> <input.txt>", file=sys.stderr)
        sys.exit(2)

    guardrails = parse_guardrails(sys.argv[1])
    original_input = parse_input(sys.argv[2])

    last_failed_id = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        state = original_input  # RESET every attempt — never carry forward

        all_passed = True
        for gid, gtype, param in guardrails:
            new_state, passed = apply_guardrail(gid, gtype, param, state, attempt)
            if passed:
                state = new_state
                print(f"ATTEMPT {attempt} PASS at {gid}")
            else:
                print(f"ATTEMPT {attempt} FAIL at {gid}")
                last_failed_id = gid
                all_passed = False
                break  # skip remaining guardrails for this attempt

        if all_passed:
            print(f"SUCCESS: {state}")
            print(f"ATTEMPTS: {attempt}")
            sys.exit(0)

    # Budget exhausted
    print(f"EXHAUSTED: {last_failed_id}")
    print(f"ATTEMPTS: {MAX_ATTEMPTS}")
    sys.exit(0)


if __name__ == "__main__":
    main()
