#!/usr/bin/env python3
"""
relay2 — Asymmetric Error Propagation Dispatcher
Usage: python3 relay2.py handlers.txt commands.txt

handlers.txt: tab-separated HANDLER_NAME<TAB>BEHAVIOR (BEHAVIOR ∈ {ok, fail})
commands.txt: tab-separated CALL_TYPE<TAB>HANDLER_NAME (CALL_TYPE ∈ {DIRECT, BROADCAST})

Validates ALL input before producing any output.
Exit 0 on success (errors recorded in output lines).
Exit 2 on malformed input (prints nothing to stdout, diagnostic to stderr).
"""
import sys

VALID_BEHAVIORS = {"ok", "fail"}
VALID_CALL_TYPES = {"DIRECT", "BROADCAST"}


def parse_handlers(path: str):
    """Parse handlers file. Returns dict {name: behavior} or raises ValueError."""
    handlers = {}
    try:
        with open(path, "r") as f:
            lines = f.readlines()
    except OSError as e:
        raise ValueError(f"Cannot open handlers file '{path}': {e}")

    for lineno, line in enumerate(lines, 1):
        # Strip trailing newline only; preserve internal structure for validation
        raw = line.rstrip("\n")
        if raw == "":
            continue  # skip blank lines

        parts = raw.split("\t")
        if len(parts) != 2:
            raise ValueError(
                f"handlers.txt line {lineno}: expected 2 tab-separated fields, got {len(parts)}: {raw!r}"
            )

        name, behavior = parts[0], parts[1]

        if not name:
            raise ValueError(f"handlers.txt line {lineno}: handler name is empty")

        if behavior not in VALID_BEHAVIORS:
            raise ValueError(
                f"handlers.txt line {lineno}: invalid BEHAVIOR {behavior!r}; "
                f"must be one of {sorted(VALID_BEHAVIORS)}"
            )

        if name in handlers:
            raise ValueError(
                f"handlers.txt line {lineno}: duplicate handler name {name!r}"
            )

        handlers[name] = behavior

    return handlers


def parse_commands(path: str, handlers: dict):
    """Parse commands file. Returns list of (call_type, handler_name) or raises ValueError."""
    commands = []
    try:
        with open(path, "r") as f:
            lines = f.readlines()
    except OSError as e:
        raise ValueError(f"Cannot open commands file '{path}': {e}")

    for lineno, line in enumerate(lines, 1):
        raw = line.rstrip("\n")
        if raw == "":
            continue  # skip blank lines

        parts = raw.split("\t")
        if len(parts) != 2:
            raise ValueError(
                f"commands.txt line {lineno}: expected 2 tab-separated fields, got {len(parts)}: {raw!r}"
            )

        call_type, handler_name = parts[0], parts[1]

        if call_type not in VALID_CALL_TYPES:
            raise ValueError(
                f"commands.txt line {lineno}: invalid CALL_TYPE {call_type!r}; "
                f"must be one of {sorted(VALID_CALL_TYPES)}"
            )

        if handler_name not in handlers:
            raise ValueError(
                f"commands.txt line {lineno}: unknown handler {handler_name!r}"
            )

        commands.append((call_type, handler_name))

    return commands


def dispatch(commands: list, handlers: dict) -> list:
    """
    Execute commands and return output lines.

    Asymmetric error propagation:
    - DIRECT + fail  → "DIRECT <name> ERROR: handler failed"   (error propagates to caller)
    - BROADCAST + fail → "BROADCAST <name> LOGGED"             (error swallowed by dispatcher)
    """
    results = []
    for call_type, name in commands:
        behavior = handlers[name]
        if call_type == "DIRECT":
            if behavior == "ok":
                results.append(f"DIRECT {name} OK")
            else:
                results.append(f"DIRECT {name} ERROR: handler failed")
        else:  # BROADCAST
            if behavior == "ok":
                results.append(f"BROADCAST {name} OK")
            else:
                # Exception is caught and logged by the dispatcher; caller cannot observe it
                results.append(f"BROADCAST {name} LOGGED")
    return results


def main():
    if len(sys.argv) != 3:
        print(
            f"Usage: {sys.argv[0]} handlers.txt commands.txt", file=sys.stderr
        )
        sys.exit(2)

    handlers_path = sys.argv[1]
    commands_path = sys.argv[2]

    # Validate ALL input before producing any output
    try:
        handlers = parse_handlers(handlers_path)
    except ValueError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(2)

    try:
        commands = parse_commands(commands_path, handlers)
    except ValueError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(2)

    # All input is valid — now produce output
    results = dispatch(commands, handlers)
    for line in results:
        print(line)

    sys.exit(0)


if __name__ == "__main__":
    main()
