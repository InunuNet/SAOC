#!/usr/bin/env python3
"""
watchdog — Quiescence Detection via FIFO Task Queue
Spec: SPEC.md

Usage:
    python3 watchdog.py tasks.txt

Exit codes:
    0 — success, all tasks processed
    2 — input error (duplicate TASK_ID as line-leader, empty file, whitespace-only line)
"""

import collections
import sys


def load_tasks(path: str) -> tuple[str, dict[str, list[str]]]:
    """
    Parse tasks.txt.

    Returns:
        (initial_task_id, followups_map)

    followups_map[task_id] = [list of followup task IDs]
    Only tasks that appear as line-leaders have entries in followups_map.

    Exit 2 on:
        - empty file (no lines at all)
        - any whitespace-only line
        - duplicate TASK_ID as line-leader
    """
    try:
        with open(path) as f:
            raw_lines = f.readlines()
    except OSError as exc:
        print(f"ERROR: cannot open {path}: {exc}", file=sys.stderr)
        sys.exit(2)

    if not raw_lines:
        print("ERROR: empty file", file=sys.stderr)
        sys.exit(2)

    lines = []
    for lineno, raw in enumerate(raw_lines, 1):
        # A whitespace-only line (including blank lines) is an error
        stripped = raw.rstrip("\n")
        if stripped != stripped.strip():
            # Has surrounding whitespace — but we need to check if the whole
            # line (after stripping newline) is whitespace-only
            pass
        if stripped.strip() == "" and stripped != "":
            # Line has content but it's all whitespace
            print(f"ERROR: whitespace-only line at line {lineno}", file=sys.stderr)
            sys.exit(2)
        if stripped == "":
            # Completely blank line — also an error per spec
            # (spec says exit 2 on whitespace-only line; blank line is a subset)
            print(f"ERROR: whitespace-only line at line {lineno}", file=sys.stderr)
            sys.exit(2)
        lines.append(stripped)

    if not lines:
        print("ERROR: empty file", file=sys.stderr)
        sys.exit(2)

    followups: dict[str, list[str]] = {}
    initial_task: str | None = None

    for lineno, line in enumerate(lines, 1):
        tokens = line.split()
        task_id = tokens[0]
        children = tokens[1:]

        if task_id in followups:
            print(f"ERROR: duplicate TASK_ID {task_id!r} at line {lineno}", file=sys.stderr)
            sys.exit(2)

        followups[task_id] = children

        if initial_task is None:
            initial_task = task_id

    # initial_task is guaranteed non-None because lines is non-empty
    return initial_task, followups  # type: ignore[return-value]


def run(tasks_path: str) -> None:
    """
    Main processing loop.

    Algorithm:
        1. Load definitions from tasks.txt.
        2. Seed FIFO queue with the first line's TASK_ID.
        3. While queue non-empty:
             a. Pop from head (popleft).
             b. Print PROCESSED <TASK_ID>.
             c. Look up followups in definition map.
             d. Append each followup to tail of queue.
        4. Print TOTAL <N>.
    """
    initial_task, followups = load_tasks(tasks_path)

    queue: collections.deque[str] = collections.deque()
    queue.append(initial_task)

    total = 0

    while queue:
        task_id = queue.popleft()
        print(f"PROCESSED {task_id}")
        total += 1

        # Look up followups; leaves (no definition) enqueue nothing
        for child in followups.get(task_id, []):
            queue.append(child)

    print(f"TOTAL {total}")


def main() -> None:
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} tasks.txt", file=sys.stderr)
        sys.exit(2)

    run(sys.argv[1])


if __name__ == "__main__":
    main()
