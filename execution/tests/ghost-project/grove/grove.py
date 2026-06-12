#!/usr/bin/env python3
"""
grove — Priority Queue with FIFO Tiebreaking

Usage: python3 grove.py events.txt

events.txt format (tab-separated):
  PUSH<TAB>PRIORITY<TAB>ITEM_ID
  POP

Exits 0 on success, 2 on invalid input or queue error.
"""

import heapq
import sys


def run(filepath: str) -> int:
    heap = []   # (priority, seq, item_id)
    seq = 0     # monotonic counter, incremented on every PUSH

    try:
        with open(filepath, "r") as fh:
            lines = fh.read().splitlines()
    except OSError as exc:
        print(f"ERROR: cannot open file: {exc}", file=sys.stderr)
        return 2

    for lineno, raw in enumerate(lines, start=1):
        line = raw.rstrip("\r")
        if not line:
            continue

        parts = line.split("\t")
        op = parts[0]

        if op == "PUSH":
            if len(parts) != 3:
                print(
                    f"ERROR: line {lineno}: PUSH requires 3 tab-separated fields, got {len(parts)}",
                    file=sys.stderr,
                )
                return 2
            try:
                priority = int(parts[1].strip())
            except ValueError:
                print(
                    f"ERROR: line {lineno}: priority must be an integer, got {parts[1].strip()!r}",
                    file=sys.stderr,
                )
                return 2
            item_id = parts[2]
            if not item_id:
                print(f"line {lineno}: ITEM_ID must be non-empty", file=sys.stderr)
                sys.exit(2)
            heapq.heappush(heap, (priority, seq, item_id))
            seq += 1

        elif op == "POP":
            if len(parts) != 1:
                print(
                    f"ERROR: line {lineno}: POP takes no additional fields, got {len(parts)}",
                    file=sys.stderr,
                )
                return 2
            if not heap:
                print(
                    f"ERROR: line {lineno}: POP on empty queue",
                    file=sys.stderr,
                )
                return 2
            priority, _seq, item_id = heapq.heappop(heap)
            print(f"POPPED {item_id} {priority}")

        else:
            print(
                f"ERROR: line {lineno}: unknown operation {op!r}",
                file=sys.stderr,
            )
            return 2

    if heap:
        print(f"REMAINING {len(heap)}")

    return 0


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python3 grove.py events.txt", file=sys.stderr)
        sys.exit(2)

    sys.exit(run(sys.argv[1]))


if __name__ == "__main__":
    main()
