#!/usr/bin/env python3
"""Escrow — Lamport Logical Clock Simulator."""

import sys


def main():
    if len(sys.argv) != 2:
        sys.stderr.write("escrow: usage: escrow.py <input_file>\n")
        sys.exit(2)

    input_file = sys.argv[1]

    try:
        with open(input_file, "r") as f:
            lines = f.readlines()
    except OSError as e:
        sys.stderr.write(f"escrow: cannot open file: {e}\n")
        sys.exit(2)

    clock = {}   # proc_id -> Lamport clock (default 0)
    pending = {} # (sender, receiver) -> FIFO list of send-time clocks

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue

        parts = line.split()

        if len(parts) == 2 and parts[1] == "INTERNAL":
            proc = parts[0]
            clock[proc] = clock.get(proc, 0) + 1
            print(f"{proc} INTERNAL {clock[proc]}")

        elif len(parts) == 3 and parts[1] == "SEND":
            proc = parts[0]
            target = parts[2]
            clock[proc] = clock.get(proc, 0) + 1
            pending.setdefault((proc, target), []).append(clock[proc])
            print(f"{proc} SEND {clock[proc]}")

        elif len(parts) == 3 and parts[1] == "RECV":
            proc = parts[0]
            sender = parts[2]
            queue = pending.get((sender, proc))
            if not queue:
                sys.stderr.write(f"escrow: unmatched RECV ({sender} -> {proc})\n")
                sys.exit(2)
            sent_clock = queue.pop(0)
            clock[proc] = max(clock.get(proc, 0), sent_clock) + 1
            print(f"{proc} RECV {clock[proc]}")

        else:
            sys.stderr.write(f"escrow: malformed line: {line!r}\n")
            sys.exit(2)


if __name__ == "__main__":
    main()
