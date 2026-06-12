#!/usr/bin/env python3
"""
fanin — Async Fan-In Context Assembly
Spec: SPEC.md

Usage: python3 fanin.py tasks.txt

tasks.txt: tab-separated, one row per line: TASK_ID<TAB>DELAY_RANK<TAB>OUTPUT_VALUE
- DELAY_RANK: integer (lower = completes first). Negative allowed.
- Completion order: stable sort by DELAY_RANK ascending (ties = file/declaration order).
- Context assembled in DECLARATION ORDER (file line order), separator " | ".

Output exactly 2 lines:
  CONTEXT: <out1> | <out2> | ... | <outN>    (declaration order)
  COMPLETED_ORDER: <id1>,<id2>,...,<idN>      (completion order)

Exit codes:
  0 — success
  2 — input error (wrong field count, non-integer DELAY_RANK, duplicate TASK_ID, empty file)
"""

import sys


def parse_tasks(path: str) -> list[tuple[str, int, str]]:
    """
    Parse tasks.txt. Returns list of (task_id, delay_rank, output_value) in file order.
    Exits 2 on any input error.
    """
    try:
        with open(path) as f:
            raw_lines = f.readlines()
    except OSError as exc:
        print(f"ERROR: cannot read {path}: {exc}", file=sys.stderr)
        sys.exit(2)

    tasks: list[tuple[str, int, str]] = []
    seen_ids: set[str] = set()

    for lineno, line in enumerate(raw_lines, 1):
        line = line.rstrip("\n")
        if not line:
            continue

        fields = line.split("\t")
        if len(fields) != 3:
            print(
                f"ERROR: line {lineno}: expected 3 tab-separated fields, got {len(fields)}",
                file=sys.stderr,
            )
            sys.exit(2)

        task_id, delay_rank_str, output_value = fields

        try:
            delay_rank = int(delay_rank_str)
        except ValueError:
            print(
                f"ERROR: line {lineno}: DELAY_RANK must be an integer, got {delay_rank_str!r}",
                file=sys.stderr,
            )
            sys.exit(2)

        if task_id in seen_ids:
            print(
                f"ERROR: line {lineno}: duplicate TASK_ID {task_id!r}",
                file=sys.stderr,
            )
            sys.exit(2)
        seen_ids.add(task_id)

        tasks.append((task_id, delay_rank, output_value))

    if not tasks:
        print("ERROR: empty file — no tasks found", file=sys.stderr)
        sys.exit(2)

    return tasks


def assemble(tasks: list[tuple[str, int, str]]) -> tuple[str, str]:
    """
    Given tasks in declaration order, return:
      (context_line, completed_order_line)

    context_line: OUTPUT_VALUE joined by " | " in declaration order.
    completed_order_line: TASK_IDs in completion order (stable sort by DELAY_RANK ascending).
    """
    # Declaration order: tasks as-is
    context = " | ".join(output_value for _, _, output_value in tasks)

    # Completion order: stable sort by DELAY_RANK (Python sort is stable → ties = file order)
    completed = sorted(tasks, key=lambda t: t[1])
    completed_order = ",".join(task_id for task_id, _, _ in completed)

    return context, completed_order


def main(argv=None) -> None:
    if argv is None:
        argv = sys.argv[1:]

    if len(argv) != 1:
        print(f"Usage: python3 fanin.py tasks.txt", file=sys.stderr)
        sys.exit(2)

    tasks_path = argv[0]
    tasks = parse_tasks(tasks_path)
    context, completed_order = assemble(tasks)

    print(f"CONTEXT: {context}")
    print(f"COMPLETED_ORDER: {completed_order}")
    sys.exit(0)


if __name__ == "__main__":
    main()
