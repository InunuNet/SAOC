#!/usr/bin/env python3
"""
Barrier — Deferred Fan-In Barrier Processor
Spec: SPEC.md | CLI: python3 barrier.py workers.txt

Two-pass algorithm:
  Pass 1: Count total workers per group across entire file.
  Pass 2: Process commands in order; at BARRIER emit INCOMPLETE if
          some workers for that group appear later in the file.

Exit 0 on success. Exit 2 on malformed input lines.
"""

import sys


def parse_file(path: str):
    """
    Read and parse the workers file. Returns list of (lineno, command) tuples
    where command is one of:
      ("WORKER", worker_id, group, output)
      ("BARRIER", group)
      ("COMMENT",)   — skipped lines

    Exits 2 on malformed lines (wrong field count, non-TAB separator on
    command lines).
    """
    commands = []
    try:
        with open(path) as f:
            lines = f.readlines()
    except OSError as exc:
        print(f"ERROR: cannot open file {path!r}: {exc}", file=sys.stderr)
        sys.exit(1)

    for lineno, raw in enumerate(lines, 1):
        line = raw.rstrip("\n").rstrip("\r")

        # Blank lines and comment lines are silently ignored
        if not line or line.startswith("#"):
            commands.append((lineno, ("COMMENT",)))
            continue

        # Lines must be TAB-separated — split strictly on TAB
        parts = line.split("\t")

        if not parts:
            # Should not happen, but guard anyway
            print(f"ERROR: line {lineno}: empty after split", file=sys.stderr)
            sys.exit(2)

        cmd = parts[0]

        if cmd == "WORKER":
            # Expected: WORKER<TAB>ID<TAB>GROUP<TAB>OUTPUT  (4 fields)
            if len(parts) != 4:
                print(
                    f"ERROR: line {lineno}: WORKER requires 4 TAB-separated fields, "
                    f"got {len(parts)}: {line!r}",
                    file=sys.stderr,
                )
                sys.exit(2)
            _, worker_id, group, output = parts
            commands.append((lineno, ("WORKER", worker_id, group, output)))

        elif cmd == "BARRIER":
            # Expected: BARRIER<TAB>GROUP  (2 fields)
            if len(parts) != 2:
                print(
                    f"ERROR: line {lineno}: BARRIER requires 2 TAB-separated fields, "
                    f"got {len(parts)}: {line!r}",
                    file=sys.stderr,
                )
                sys.exit(2)
            group = parts[1]
            commands.append((lineno, ("BARRIER", group)))

        else:
            # Unknown command — treat as malformed
            print(
                f"ERROR: line {lineno}: unknown command {cmd!r}: {line!r}",
                file=sys.stderr,
            )
            sys.exit(2)

    return commands


def process(commands):
    """
    Two-pass evaluation. Prints results to stdout.

    Pass 1: count total WORKER declarations per group in the entire file.
    Pass 2: walk commands; track workers seen so far per group;
            at BARRIER, emit the appropriate result.
    """
    # ── Pass 1: total workers per group ──────────────────────────────────────
    total_workers: dict[str, int] = {}
    # Also capture outputs in declaration order for Pass 2 completion check
    # (we need them ordered as declared, so we collect them per group in order)
    all_outputs: dict[str, list[str]] = {}

    for _lineno, cmd in commands:
        if cmd[0] == "WORKER":
            _, worker_id, group, output = cmd
            total_workers[group] = total_workers.get(group, 0) + 1
            if group not in all_outputs:
                all_outputs[group] = []
            all_outputs[group].append(output)

    # ── Pass 2: process in order ──────────────────────────────────────────────
    seen_count: dict[str, int] = {}      # workers seen so far
    seen_outputs: dict[str, list[str]] = {}  # outputs seen so far (declaration order)

    for _lineno, cmd in commands:
        if cmd[0] == "COMMENT":
            continue

        elif cmd[0] == "WORKER":
            _, worker_id, group, output = cmd
            seen_count[group] = seen_count.get(group, 0) + 1
            if group not in seen_outputs:
                seen_outputs[group] = []
            seen_outputs[group].append(output)

        elif cmd[0] == "BARRIER":
            group = cmd[1]
            total = total_workers.get(group, 0)
            seen = seen_count.get(group, 0)

            if total == 0:
                # No workers declared anywhere for this group
                print(f"BARRIER {group}: EMPTY")
            elif seen < total:
                # Some workers for this group appear later in the file
                print(f"BARRIER {group}: INCOMPLETE")
            else:
                # All workers seen — emit their outputs in declaration order
                outputs = seen_outputs.get(group, [])
                print(f"BARRIER {group}: {','.join(outputs)}")


def main():
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} workers.txt", file=sys.stderr)
        sys.exit(2)

    path = sys.argv[1]
    commands = parse_file(path)
    process(commands)
    sys.exit(0)


if __name__ == "__main__":
    main()
