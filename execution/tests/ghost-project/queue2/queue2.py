#!/usr/bin/env python3
"""
queue2 — Two-Phase Commit Pending-Confirmation Queue
Spec: SPEC.md | CLI: python3 queue2.py statefile.json commands.txt

The two-phase commit journal (in_flight zone) ensures that an item dequeued
from pending is durably recorded before it is marked done. A crash between
dequeue and confirmation leaves the item in in_flight, which RECOVER rescues.
"""

import json
import os
import sys


# ── state I/O ─────────────────────────────────────────────────────────────────

EMPTY_STATE = {"pending": [], "in_flight": [], "done": []}


def load_state(path: str) -> dict:
    """Return state dict; initialize empty if file absent."""
    if not os.path.exists(path):
        return {"pending": [], "in_flight": [], "done": []}
    try:
        with open(path) as f:
            raw = f.read().strip()
        if not raw:
            # Empty file — treat as fresh state (e.g. created by mktemp)
            return {"pending": [], "in_flight": [], "done": []}
        data = json.loads(raw)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot read state file {path}: {exc}", file=sys.stderr)
        sys.exit(2)
    # Validate top-level structure
    for key in ("pending", "in_flight", "done"):
        if key not in data or not isinstance(data[key], list):
            print(f"ERROR: state file missing or invalid list for key '{key}'", file=sys.stderr)
            sys.exit(2)
    return data


def save_state(state: dict, path: str) -> None:
    """Atomically write state to path using a .tmp intermediate."""
    tmp = path + ".tmp"
    try:
        with open(tmp, "w") as f:
            json.dump(state, f, indent=2)
            f.write("\n")
        os.replace(tmp, path)
    except OSError as exc:
        print(f"ERROR: cannot write state file {path}: {exc}", file=sys.stderr)
        try:
            os.unlink(tmp)
        except OSError:
            pass
        sys.exit(3)


# ── command handlers ──────────────────────────────────────────────────────────

def cmd_enqueue(state: dict, path: str, item_id: str, payload: str) -> None:
    """Append item to pending. No stdout."""
    state["pending"].append({"id": item_id, "payload": payload})
    save_state(state, path)


def cmd_execute(state: dict, path: str) -> None:
    """
    Two-phase commit: pop head of pending → write in_flight →
    move in_flight item to done → write done.
    Prints EXECUTED <id> or EXECUTED NONE.
    """
    if not state["pending"]:
        print("EXECUTED NONE")
        return

    item = state["pending"].pop(0)

    # Phase 1: record in_flight (durable before confirmation)
    state["in_flight"].append(item)
    save_state(state, path)

    # Phase 2: move from in_flight to done (confirm)
    state["in_flight"].remove(item)
    state["done"].append(item)
    save_state(state, path)

    print(f"EXECUTED {item['id']}")


def cmd_fail(state: dict, path: str) -> None:
    """
    Simulate a crash after Phase 1: pop head of pending → write in_flight.
    Do NOT move to done. Prints FAILED <id> or FAILED NONE.
    """
    if not state["pending"]:
        print("FAILED NONE")
        return

    item = state["pending"].pop(0)

    # Phase 1 only — intentionally not completing Phase 2
    state["in_flight"].append(item)
    save_state(state, path)

    print(f"FAILED {item['id']}")


def cmd_recover(state: dict, path: str) -> None:
    """
    Move all in_flight items to done (in order). Emit RECOVERED <id> per item.
    If in_flight is empty, emit NOTHING_TO_RECOVER.
    """
    if not state["in_flight"]:
        print("NOTHING_TO_RECOVER")
        return

    recovered = list(state["in_flight"])
    state["in_flight"] = []
    state["done"].extend(recovered)
    save_state(state, path)

    for item in recovered:
        print(f"RECOVERED {item['id']}")


def cmd_status(state: dict) -> None:
    """Print counts for all three queues."""
    print(
        f"PENDING: {len(state['pending'])}, "
        f"IN_FLIGHT: {len(state['in_flight'])}, "
        f"DONE: {len(state['done'])}"
    )


# ── command parsing ───────────────────────────────────────────────────────────

def parse_commands(commands_path: str) -> list[list[str]]:
    """
    Read commands file. Return list of tokenized lines (non-empty).
    Exit 2 if file cannot be read.
    """
    try:
        with open(commands_path) as f:
            lines = f.readlines()
    except OSError as exc:
        print(f"ERROR: cannot read commands file {commands_path}: {exc}", file=sys.stderr)
        sys.exit(2)

    parsed = []
    for lineno, raw in enumerate(lines, 1):
        line = raw.strip()
        if not line:
            continue
        parsed.append((lineno, line))
    return parsed


def dispatch(state: dict, state_path: str, lineno: int, line: str) -> None:
    """Dispatch a single command line. Exit 2 on malformed input."""
    # ENQUEUE uses split(None, 2) to preserve spaces in PAYLOAD
    if line.startswith("ENQUEUE"):
        parts = line.split(None, 2)
        if len(parts) < 3:
            print(f"ERROR: line {lineno}: ENQUEUE requires <ID> <PAYLOAD>, got: {line!r}", file=sys.stderr)
            sys.exit(2)
        _, item_id, payload = parts
        cmd_enqueue(state, state_path, item_id, payload)
    elif line == "EXECUTE":
        cmd_execute(state, state_path)
    elif line == "FAIL":
        cmd_fail(state, state_path)
    elif line == "RECOVER":
        cmd_recover(state, state_path)
    elif line == "STATUS":
        cmd_status(state)
    else:
        print(f"ERROR: line {lineno}: unknown command: {line!r}", file=sys.stderr)
        sys.exit(2)


# ── main ──────────────────────────────────────────────────────────────────────

def main(argv=None):
    args = argv if argv is not None else sys.argv[1:]

    if len(args) != 2:
        print("Usage: python3 queue2.py statefile.json commands.txt", file=sys.stderr)
        sys.exit(2)

    state_path, commands_path = args

    state = load_state(state_path)
    commands = parse_commands(commands_path)

    for lineno, line in commands:
        dispatch(state, state_path, lineno, line)

    sys.exit(0)


if __name__ == "__main__":
    main()
