#!/usr/bin/env python3
"""Cairn — idempotent task-state accumulator.

Usage: cairn.py <task-list-file> <state-file>

Exit codes:
  0 — success
  3 — invalid task ID in input (state file untouched)
  4 — corrupt/invalid state file
"""
import json
import os
import re
import sys

ID_RE = re.compile(r'^[A-Z]{2}-[0-9]{4}$')


def main():
    if len(sys.argv) != 3:
        sys.stderr.write("usage: cairn.py <task-list-file> <state-file>\n")
        sys.exit(1)

    task_file = sys.argv[1]
    state_file = sys.argv[2]

    # --- Read and validate input task list ---
    with open(task_file) as f:
        raw_lines = [line.rstrip('\n') for line in f if line.strip()]

    for line in raw_lines:
        if not ID_RE.match(line):
            sys.stderr.write(f"invalid task ID: {line}\n")
            sys.exit(3)

    # Deduplicate input while preserving order (for adding new IDs)
    seen_input = []
    seen_set = set()
    for tid in raw_lines:
        if tid not in seen_set:
            seen_input.append(tid)
            seen_set.add(tid)

    # --- Read existing state file if present ---
    existing_processed = []
    if os.path.exists(state_file):
        try:
            with open(state_file) as f:
                state = json.load(f)
            if not isinstance(state, dict):
                raise ValueError("state must be a JSON object")
            if state.get("version") != 1:
                raise ValueError("missing or wrong version")
            if not isinstance(state.get("processed"), list):
                raise ValueError("processed must be a list")
            existing_processed = state["processed"]
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            sys.stderr.write(f"corrupt state file: {e}\n")
            sys.exit(4)

    # --- Compute new IDs to add ---
    existing_set = set(existing_processed)
    new_ids = [tid for tid in seen_input if tid not in existing_set]

    merged = sorted(existing_processed + new_ids)

    # --- Atomic write ---
    tmp_path = state_file + ".tmp"
    payload = json.dumps({"processed": merged, "version": 1},
                         sort_keys=True, separators=(",", ":")) + "\n"
    with open(tmp_path, "w") as f:
        f.write(payload)
    os.replace(tmp_path, state_file)

    added = len(new_ids)
    total = len(merged)
    sys.stdout.write(f"added={added} total={total}\n")


if __name__ == "__main__":
    main()
