#!/usr/bin/env python3
"""
cipher — Token Bucket Rate Limiter
Spec: SPEC.md

Algorithm:
  For each event (TIMESTAMP_MS, TOKENS_REQUESTED):
    elapsed = current_timestamp - last_refill_timestamp
    refill  = (elapsed * rate) // 1000   ← integer floor division only
    bucket  = min(capacity, bucket + refill)
    last_refill_timestamp = current_timestamp
    if bucket >= tokens_requested: ALLOW, bucket -= tokens_requested
    else: DENY

Initial state: bucket = capacity, last_refill_timestamp = 0.
"""

import argparse
import sys


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="cipher — token bucket rate limiter"
    )
    parser.add_argument(
        "--capacity",
        required=True,
        help="Maximum token capacity (positive integer)",
    )
    parser.add_argument(
        "--rate",
        required=True,
        help="Refill rate in tokens per second (non-negative integer)",
    )
    parser.add_argument(
        "--events",
        required=True,
        metavar="FILE",
        help="Path to events file (TIMESTAMP_MS<TAB>TOKENS_REQUESTED per line)",
    )
    return parser.parse_args(argv)


def die(msg: str, code: int = 2) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def parse_int_arg(name: str, value: str) -> int:
    """Parse a CLI integer argument; exit 2 if not a valid integer."""
    try:
        return int(value)
    except ValueError:
        die(f"--{name} must be an integer, got: {value!r}")


def load_events(path: str) -> list[tuple[int, int]]:
    """
    Read events file.  Returns list of (timestamp_ms, tokens_requested).
    Exits 2 on missing file, non-integer fields, or non-monotonic timestamps.
    """
    try:
        with open(path) as f:
            raw = f.readlines()
    except OSError as exc:
        die(f"cannot open events file {path!r}: {exc}")

    events: list[tuple[int, int]] = []
    prev_ts = -1

    for lineno, line in enumerate(raw, 1):
        line = line.rstrip("\n")
        if not line:
            continue
        parts = line.split("\t")
        if len(parts) != 2:
            die(f"line {lineno}: expected TAB-separated TIMESTAMP TOKENS, got: {line!r}")
        ts_str, tok_str = parts
        try:
            ts = int(ts_str)
        except ValueError:
            die(f"line {lineno}: TIMESTAMP_MS must be an integer, got: {ts_str!r}")
        try:
            tokens = int(tok_str)
        except ValueError:
            die(f"line {lineno}: TOKENS_REQUESTED must be an integer, got: {tok_str!r}")
        if tokens <= 0:
            die(f"line {lineno}: TOKENS_REQUESTED must be a positive integer, got: {tokens}")

        if ts < prev_ts:
            die(
                f"line {lineno}: non-monotonic timestamp {ts} < previous {prev_ts}"
            )
        prev_ts = ts
        events.append((ts, tokens))

    return events


def run(capacity: int, rate: int, events: list[tuple[int, int]]) -> list[str]:
    """Execute the token bucket algorithm; return list of decision lines."""
    bucket = capacity
    last_refill_ts = 0
    results: list[str] = []

    for ts, tokens_requested in events:
        elapsed = ts - last_refill_ts
        refill = (elapsed * rate) // 1000          # integer floor division only
        bucket = min(capacity, bucket + refill)
        last_refill_ts = ts

        if bucket >= tokens_requested:
            results.append(f"ALLOW {tokens_requested}")
            bucket -= tokens_requested
        else:
            results.append(f"DENY {tokens_requested}")

    return results


def main(argv=None):
    args = parse_args(argv)

    capacity = parse_int_arg("capacity", args.capacity)
    rate = parse_int_arg("rate", args.rate)

    if capacity <= 0:
        die("--capacity must be a positive integer")
    if rate < 0:
        die("--rate must be non-negative")

    events = load_events(args.events)
    results = run(capacity, rate, events)

    for line in results:
        print(line)

    sys.exit(0)


if __name__ == "__main__":
    main()
