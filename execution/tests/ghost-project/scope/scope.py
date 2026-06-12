#!/usr/bin/env python3
"""
Scope — Nested State Shared-Key Reducer
Spec: SPEC.md | README: README.md

Usage:
    python3 scope.py commands.txt

Exit codes:
    0 — all commands processed successfully
    2 — malformed input (duplicate register, unknown key, blocked reducer, etc.)
"""

import sys
from collections import OrderedDict


# ── state ─────────────────────────────────────────────────────────────────────

# registry: (key, scope) -> reducer
registry: dict[tuple[str, str], str] = {}

# state stores: key -> current value (str) or None (unset)
inner_state: dict[str, object] = {}
outer_state: dict[str, object] = {}

# pending inner updates in insertion order: list of (key, value)
pending: list[tuple[str, str]] = []


# ── reducer logic ─────────────────────────────────────────────────────────────

def apply_reducer(current, value: str, reducer: str):
    """Apply reducer to current state, returning new state."""
    if reducer == "overwrite":
        return value
    elif reducer == "append":
        if current is None:
            return value
        return f"{current},{value}"
    else:
        raise ValueError(f"Unknown reducer: {reducer!r}")


# ── command handlers ──────────────────────────────────────────────────────────

def cmd_register(parts: list[str]) -> None:
    """REGISTER KEY SCOPE REDUCER"""
    if len(parts) != 4:
        sys.stderr.write(f"ERROR: REGISTER requires KEY SCOPE REDUCER, got {parts[1:]!r}\n")
        sys.exit(2)
    _, key, scope, reducer = parts
    if scope not in ("inner", "outer"):
        sys.stderr.write(f"ERROR: SCOPE must be 'inner' or 'outer', got {scope!r}\n")
        sys.exit(2)
    if reducer not in ("append", "overwrite", "unregistered"):
        sys.stderr.write(f"ERROR: REDUCER must be append/overwrite/unregistered, got {reducer!r}\n")
        sys.exit(2)
    reg_key = (key, scope)
    if reg_key in registry:
        sys.stderr.write(f"ERROR: duplicate REGISTER for key={key!r} scope={scope!r}\n")
        sys.exit(2)
    registry[reg_key] = reducer
    # Initialize state slot (unset)
    if scope == "inner" and key not in inner_state:
        inner_state[key] = None
    elif scope == "outer" and key not in outer_state:
        outer_state[key] = None


def cmd_inner_update(parts: list[str]) -> None:
    """INNER_UPDATE KEY VALUE"""
    if len(parts) != 3:
        sys.stderr.write(f"ERROR: INNER_UPDATE requires KEY VALUE\n")
        sys.exit(2)
    _, key, value = parts
    if (key, "inner") not in registry:
        sys.stderr.write(f"ERROR: key {key!r} not registered in inner scope\n")
        sys.exit(2)
    pending.append((key, value))


def cmd_outer_update(parts: list[str]) -> None:
    """OUTER_UPDATE KEY VALUE — applies immediately"""
    if len(parts) != 3:
        sys.stderr.write(f"ERROR: OUTER_UPDATE requires KEY VALUE\n")
        sys.exit(2)
    _, key, value = parts
    if (key, "outer") not in registry:
        sys.stderr.write(f"ERROR: key {key!r} not registered in outer scope\n")
        sys.exit(2)
    reducer = registry[(key, "outer")]
    if reducer == "unregistered":
        sys.stderr.write(f"ERROR: key {key!r} has unregistered reducer in outer scope\n")
        sys.exit(2)
    outer_state[key] = apply_reducer(outer_state.get(key), value, reducer)


def cmd_cross() -> None:
    """CROSS — flush pending inner updates, applying cross-boundary logic."""
    for key, value in pending:
        in_outer = (key, "outer") in registry
        inner_reducer = registry[(key, "inner")]

        if in_outer:
            outer_reducer = registry[(key, "outer")]
            if outer_reducer in ("append", "overwrite"):
                # Apply to outer using outer's reducer
                outer_state[key] = apply_reducer(outer_state.get(key), value, outer_reducer)
                # Apply to inner using inner's reducer
                inner_state[key] = apply_reducer(inner_state.get(key), value, inner_reducer)
                print(f"CROSSED {key}={value}")
            else:
                # outer reducer = unregistered: DROPPED at outer boundary
                # Inner still updated
                inner_state[key] = apply_reducer(inner_state.get(key), value, inner_reducer)
                print(f"DROPPED {key}")
        else:
            # Key not in outer at all: ISOLATED
            inner_state[key] = apply_reducer(inner_state.get(key), value, inner_reducer)
            print(f"ISOLATED {key}")

    pending.clear()


def cmd_get_inner(parts: list[str]) -> None:
    """GET_INNER KEY"""
    if len(parts) != 2:
        sys.stderr.write(f"ERROR: GET_INNER requires KEY\n")
        sys.exit(2)
    _, key = parts
    if (key, "inner") not in registry:
        sys.stderr.write(f"ERROR: key {key!r} not registered in inner scope\n")
        sys.exit(2)
    val = inner_state.get(key)
    if val is None:
        print(f"INNER {key}: <unset>")
    else:
        print(f"INNER {key}: {val}")


def cmd_get_outer(parts: list[str]) -> None:
    """GET_OUTER KEY"""
    if len(parts) != 2:
        sys.stderr.write(f"ERROR: GET_OUTER requires KEY\n")
        sys.exit(2)
    _, key = parts
    if (key, "outer") not in registry:
        sys.stderr.write(f"ERROR: key {key!r} not registered in outer scope (possible inner-only leakage attempt)\n")
        sys.exit(2)
    val = outer_state.get(key)
    if val is None:
        print(f"OUTER {key}: <unset>")
    else:
        print(f"OUTER {key}: {val}")


# ── dispatch table ─────────────────────────────────────────────────────────────

DISPATCH = {
    "REGISTER": cmd_register,
    "INNER_UPDATE": cmd_inner_update,
    "OUTER_UPDATE": cmd_outer_update,
    "CROSS": lambda _: cmd_cross(),
    "GET_INNER": cmd_get_inner,
    "GET_OUTER": cmd_get_outer,
}


# ── main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    if len(sys.argv) != 2:
        sys.stderr.write(f"Usage: python3 scope.py commands.txt\n")
        sys.exit(2)

    commands_path = sys.argv[1]
    try:
        with open(commands_path) as f:
            lines = f.readlines()
    except OSError as exc:
        sys.stderr.write(f"ERROR: cannot read {commands_path}: {exc}\n")
        sys.exit(2)

    for lineno, raw in enumerate(lines, 1):
        line = raw.rstrip("\n")
        if not line.strip():
            continue  # skip blank lines
        parts = line.split("\t")
        command = parts[0]

        handler = DISPATCH.get(command)
        if handler is None:
            sys.stderr.write(f"ERROR: unknown command {command!r} on line {lineno}\n")
            sys.exit(2)

        handler(parts)

    sys.exit(0)


if __name__ == "__main__":
    main()
