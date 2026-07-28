"""Sliding-window rate limiter CLI.

Reads JSONL events from stdin, emits per-event allow/deny verdicts to stdout.
Uses integer-only arithmetic and a collections.deque for the sliding window.
"""

import argparse
import collections
import json
import sys


def parse_args():
    parser = argparse.ArgumentParser(
        description="Sliding-window rate limiter for JSONL event streams."
    )
    parser.add_argument(
        "--window",
        type=int,
        required=True,
        help="Window size in seconds (>= 1).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        required=True,
        help="Max allowed requests per window (>= 1).",
    )
    args = parser.parse_args()
    if args.window < 1:
        parser.error("--window must be >= 1")
    if args.limit < 1:
        parser.error("--limit must be >= 1")
    return args


def process_stream(window: int, limit: int) -> int:
    """Process JSONL lines from stdin. Returns exit code 0 or 1."""
    dq = collections.deque()

    for raw_line in sys.stdin:
        line = raw_line.rstrip("\n")
        if not line.strip():
            continue  # skip blank / whitespace-only lines (R10)

        try:
            event = json.loads(line)
            ts = event["ts"]
            event_id = event["id"]
            if not isinstance(ts, int):
                raise ValueError("ts is not an integer")
        except (json.JSONDecodeError, KeyError, ValueError):
            return 1  # malformed input (R9)

        # Evict timestamps that fell out of the window (>= is exact per R1/R5)
        while dq and (ts - dq[0]) >= window:
            dq.popleft()

        if len(dq) < limit:
            dq.append(ts)
            allowed = True
        else:
            allowed = False  # DENY — do not append (R4)

        remaining = limit - len(dq)  # computed after possible append (R3)

        record = {"id": event_id, "allowed": allowed, "remaining": remaining}
        sys.stdout.write(json.dumps(record) + "\n")

    return 0


def main():
    args = parse_args()
    exit_code = process_stream(args.window, args.limit)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
