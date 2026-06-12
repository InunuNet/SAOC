#!/usr/bin/env python3
"""
batch — All-or-Nothing Batch Write Atomicity
Spec: SPEC.md | CLI: python3 batch.py logfile.txt commands.txt

THE TRAP: wrong implementations write ADD directly to logfile.txt, making
partial batches visible in READ before COMMIT.
"""

import json
import os
import sys


def load_stage(stage_path: str) -> dict:
    """Load the sidecar staging file. Returns {} if missing or empty."""
    if not os.path.exists(stage_path):
        return {}
    try:
        with open(stage_path) as f:
            content = f.read().strip()
        if not content:
            return {}
        return json.loads(content)
    except (json.JSONDecodeError, OSError):
        return {}


def save_stage(stage_path: str, stage: dict) -> None:
    """Atomically write the staging file."""
    tmp = stage_path + ".tmp"
    with open(tmp, "w") as f:
        f.write(json.dumps(stage, indent=2))
    os.replace(tmp, stage_path)


def load_log(log_path: str) -> list:
    """Return lines from logfile (empty list if missing)."""
    if not os.path.exists(log_path):
        return []
    with open(log_path) as f:
        return f.read().splitlines()


def append_log(log_path: str, events: list) -> None:
    """Append events atomically to logfile using read-modify-write with tmp."""
    existing = load_log(log_path)
    tmp = log_path + ".tmp"
    with open(tmp, "w") as f:
        for line in existing:
            f.write(line + "\n")
        for evt in events:
            f.write(evt + "\n")
    os.replace(tmp, log_path)


def stage_path_for(log_path: str) -> str:
    return log_path + ".stage.json"


def cmd_begin(stage: dict, batch_id: str) -> None:
    if batch_id in stage:
        sys.exit(2)
    stage[batch_id] = {"events": [], "state": "open"}


def cmd_add(stage: dict, batch_id: str, event: str) -> None:
    if batch_id not in stage:
        sys.exit(2)
    if stage[batch_id]["state"] == "corrupted":
        sys.exit(2)
    stage[batch_id]["events"].append(event)


def cmd_commit(stage: dict, log_path: str, batch_id: str) -> None:
    if batch_id not in stage:
        sys.exit(2)
    if stage[batch_id]["state"] == "corrupted":
        sys.exit(2)
    events = stage[batch_id]["events"]
    append_log(log_path, events)
    del stage[batch_id]
    print(f"COMMITTED {batch_id}: {len(events)} events")


def cmd_abort(stage: dict, batch_id: str) -> None:
    if batch_id not in stage:
        sys.exit(2)
    del stage[batch_id]
    print(f"ABORTED {batch_id}")


def cmd_crash(stage: dict, batch_id: str) -> None:
    if batch_id not in stage:
        sys.exit(2)
    stage[batch_id]["events"].append("__CRASHED__")
    stage[batch_id]["state"] = "corrupted"
    print(f"CRASHED {batch_id}")


def cmd_recover(stage: dict) -> None:
    corrupted = [bid for bid, b in stage.items() if b["state"] == "corrupted"]
    if not corrupted:
        print("NOTHING_TO_RECOVER")
        return
    for bid in corrupted:
        del stage[bid]
        print(f"ROLLED_BACK {bid}")


def cmd_read(log_path: str) -> None:
    lines = load_log(log_path)
    for line in lines:
        print(line)


def parse_command(line: str):
    """Parse one command line. Returns (cmd, args_list) or exits 2 on malformed."""
    parts = line.strip().split(" ", 1)
    if not parts or not parts[0]:
        return None, []
    cmd = parts[0].upper()
    rest = parts[1] if len(parts) > 1 else ""
    return cmd, rest


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} logfile.txt commands.txt", file=sys.stderr)
        sys.exit(2)

    log_path = sys.argv[1]
    commands_path = sys.argv[2]
    s_path = stage_path_for(log_path)

    if not os.path.exists(commands_path):
        print(f"ERROR: commands file not found: {commands_path}", file=sys.stderr)
        sys.exit(2)

    with open(commands_path) as f:
        raw_lines = f.read().splitlines()

    for raw in raw_lines:
        line = raw.strip()
        if not line:
            continue

        stage = load_stage(s_path)
        cmd, rest = parse_command(line)
        if cmd is None:
            continue

        if cmd == "BEGIN":
            if not rest:
                sys.exit(2)
            batch_id = rest.strip()
            cmd_begin(stage, batch_id)
            save_stage(s_path, stage)

        elif cmd == "ADD":
            # ADD <BATCH_ID> <EVENT>  — EVENT may contain spaces
            parts2 = rest.split(" ", 1)
            if len(parts2) < 2:
                sys.exit(2)
            batch_id = parts2[0]
            event = parts2[1]
            cmd_add(stage, batch_id, event)
            save_stage(s_path, stage)

        elif cmd == "COMMIT":
            if not rest:
                sys.exit(2)
            batch_id = rest.strip()
            cmd_commit(stage, log_path, batch_id)
            save_stage(s_path, stage)

        elif cmd == "ABORT":
            if not rest:
                sys.exit(2)
            batch_id = rest.strip()
            cmd_abort(stage, batch_id)
            save_stage(s_path, stage)

        elif cmd == "CRASH":
            if not rest:
                sys.exit(2)
            batch_id = rest.strip()
            cmd_crash(stage, batch_id)
            save_stage(s_path, stage)

        elif cmd == "RECOVER":
            cmd_recover(stage)
            save_stage(s_path, stage)

        elif cmd == "READ":
            cmd_read(log_path)

        else:
            sys.exit(2)


if __name__ == "__main__":
    main()
