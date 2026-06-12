#!/usr/bin/env python3
"""
Resume — Node Re-execution with Positional Resume-Value Binding
Spec: SPEC.md
CLI: python3 resume.py node.txt run_file.txt
"""

import sys


def parse_node(node_path: str) -> list[tuple[str, str]]:
    """Parse node.txt into list of (directive, argument) tuples."""
    nodes = []
    try:
        with open(node_path) as f:
            for lineno, line in enumerate(f, 1):
                # Strip trailing newline only, not leading whitespace
                line = line.rstrip("\n")
                # Skip blank lines and comments
                if not line.strip() or line.strip().startswith("#"):
                    continue
                parts = line.split("\t", 1)
                if len(parts) != 2:
                    print(
                        f"ERROR: line {lineno}: expected TAB-separated directive and argument, got: {line!r}",
                        file=sys.stderr,
                    )
                    sys.exit(2)
                directive, arg = parts[0].strip(), parts[1]
                if directive not in ("EFFECT", "INTERRUPT"):
                    print(
                        f"ERROR: line {lineno}: unknown directive {directive!r}",
                        file=sys.stderr,
                    )
                    sys.exit(2)
                nodes.append((directive, arg))
    except OSError as exc:
        print(f"ERROR: cannot read node file {node_path!r}: {exc}", file=sys.stderr)
        sys.exit(2)
    return nodes


def parse_run_file(run_path: str) -> list[tuple[str, str | None]]:
    """Parse run_file.txt into list of (command, arg_or_None) tuples."""
    commands = []
    try:
        with open(run_path) as f:
            for lineno, line in enumerate(f, 1):
                line = line.rstrip("\n")
                if not line.strip() or line.strip().startswith("#"):
                    continue
                parts = line.split("\t", 1)
                cmd = parts[0].strip()
                arg = parts[1] if len(parts) == 2 else None
                if cmd not in ("RUN", "RESUME"):
                    print(
                        f"ERROR: line {lineno}: unknown command {cmd!r}",
                        file=sys.stderr,
                    )
                    sys.exit(2)
                commands.append((cmd, arg))
    except OSError as exc:
        print(f"ERROR: cannot read run file {run_path!r}: {exc}", file=sys.stderr)
        sys.exit(2)
    return commands


def count_interrupts(nodes: list[tuple[str, str]]) -> int:
    return sum(1 for d, _ in nodes if d == "INTERRUPT")


def execute_run(nodes: list[tuple[str, str]]) -> None:
    """
    RUN: walk nodes top-down.
    EFFECT → emit 'EFFECT <L>'
    INTERRUPT → emit 'INTERRUPTED: <Q>' and STOP
    """
    for directive, arg in nodes:
        if directive == "EFFECT":
            print(f"EFFECT {arg}")
        elif directive == "INTERRUPT":
            print(f"INTERRUPTED: {arg}")
            return


def execute_resume(nodes: list[tuple[str, str]], values: list[str]) -> None:
    """
    RESUME: full re-execution from the top.
    EFFECT → emit 'EFFECT <L>'
    INTERRUPT → consume next value, emit 'ANSWERED: <Q>=<vi>'
    After all nodes → emit 'COMPLETED: v1,v2,...'
    """
    value_idx = 0
    for directive, arg in nodes:
        if directive == "EFFECT":
            print(f"EFFECT {arg}")
        elif directive == "INTERRUPT":
            val = values[value_idx]
            print(f"ANSWERED: {arg}={val}")
            value_idx += 1
    print(f"COMPLETED: {','.join(values)}")


def main(argv=None):
    if argv is None:
        argv = sys.argv[1:]

    if len(argv) != 2:
        print(f"Usage: python3 resume.py <node_file> <run_file>", file=sys.stderr)
        sys.exit(2)

    node_path, run_path = argv[0], argv[1]

    nodes = parse_node(node_path)
    commands = parse_run_file(run_path)

    interrupt_count = count_interrupts(nodes)
    ran = False

    for cmd, arg in commands:
        if cmd == "RUN":
            ran = True
            execute_run(nodes)

        elif cmd == "RESUME":
            if not ran:
                print("ERROR: RESUME before RUN", file=sys.stderr)
                sys.exit(2)

            # Parse values
            if arg is None or arg.strip() == "":
                values = []
            else:
                values = arg.split(",")

            # Validate value count
            if len(values) != interrupt_count:
                print(
                    f"ERROR: RESUME provides {len(values)} value(s) but node has "
                    f"{interrupt_count} INTERRUPT(s)",
                    file=sys.stderr,
                )
                sys.exit(2)

            execute_resume(nodes, values)

    sys.exit(0)


if __name__ == "__main__":
    main()
