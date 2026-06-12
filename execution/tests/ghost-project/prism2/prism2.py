#!/usr/bin/env python3
"""
prism2 — Output Shape Precedence Processor (pydantic > json > raw)
Spec: SPEC.md | README: README.md
"""

import sys
import os


def run_pipeline(pipeline_path: str) -> int:
    """
    Process a pipeline file and emit output per EMIT commands.
    Returns exit code: 0 on success, 2 on protocol errors.
    """
    try:
        with open(pipeline_path) as f:
            lines = f.readlines()
    except OSError as exc:
        print(f"ERROR: cannot open pipeline file: {exc}", file=sys.stderr)
        return 2

    slot_pydantic = None
    slot_json = None
    slot_raw = None

    for lineno, line in enumerate(lines, 1):
        # Strip only the trailing newline, preserve internal spaces
        line = line.rstrip("\n").rstrip("\r")

        # Empty lines → exit 2
        if line == "":
            print(f"ERROR: empty line at line {lineno}", file=sys.stderr)
            return 2

        # Parse command
        if line.startswith("SET_RAW "):
            # value = everything after "SET_RAW " (can contain spaces)
            value = line[len("SET_RAW "):]
            slot_raw = value

        elif line.startswith("SET_JSON "):
            token = line[len("SET_JSON "):]
            # Single token — no spaces allowed
            if " " in token:
                print(f"ERROR: SET_JSON value contains spaces at line {lineno}: {token!r}", file=sys.stderr)
                return 2
            slot_json = token

        elif line.startswith("SET_PYDANTIC "):
            token = line[len("SET_PYDANTIC "):]
            # Single token — no spaces allowed
            if " " in token:
                print(f"ERROR: SET_PYDANTIC value contains spaces at line {lineno}: {token!r}", file=sys.stderr)
                return 2
            slot_pydantic = token

        elif line == "EMIT":
            result = _compute_emit(slot_pydantic, slot_json, slot_raw)
            if result is None:
                print(f"ERROR: EMIT with nothing set at line {lineno}", file=sys.stderr)
                return 2
            print(result)

        elif line == "RESET":
            slot_pydantic = None
            slot_json = None
            slot_raw = None

        elif line == "PIPE":
            result = _compute_emit(slot_pydantic, slot_json, slot_raw)
            if result is None:
                print(f"ERROR: PIPE with nothing set at line {lineno}", file=sys.stderr)
                return 2
            # Store full emitted string (including prefix) into raw; clear others
            slot_raw = result
            slot_pydantic = None
            slot_json = None

        else:
            print(f"ERROR: unknown command at line {lineno}: {line!r}", file=sys.stderr)
            return 2

    return 0


def _compute_emit(slot_pydantic, slot_json, slot_raw):
    """
    Apply precedence: pydantic > json > raw.
    Returns the full output string including prefix, or None if nothing set.
    """
    if slot_pydantic is not None:
        return f"PYDANTIC:{slot_pydantic}"
    elif slot_json is not None:
        return f"JSON:{slot_json}"
    elif slot_raw is not None:
        return f"RAW:{slot_raw}"
    return None


def main():
    if len(sys.argv) != 2:
        print(f"Usage: {os.path.basename(sys.argv[0])} pipeline.txt", file=sys.stderr)
        sys.exit(2)

    pipeline_path = sys.argv[1]
    exit_code = run_pipeline(pipeline_path)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
