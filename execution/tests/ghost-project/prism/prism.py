#!/usr/bin/env python3
"""Prism — histogram bucketing tool.

Usage: prism.py <config.json>
Reads floats from stdin, one per line.
Config: {"buckets": [b1, b2, ..., bN]} sorted ascending, >=2 entries.

Buckets are half-open [lo, hi):
  underflow: value < b1
  bucket i: b_i <= value < b_{i+1}  (for i in 0..N-2)
  final bucket: value >= b_{N-1}

Exit 0 on success, 2 on NaN or non-numeric input.
Output: JSON to stdout with sort_keys=True, separators=(",",":"), trailing newline.
"""

import json
import math
import sys


def main():
    if len(sys.argv) < 2:
        print("Usage: prism.py <config.json>", file=sys.stderr)
        sys.exit(2)

    config_path = sys.argv[1]
    with open(config_path) as f:
        config = json.load(f)

    boundaries = config["buckets"]  # sorted ascending, >=2 entries

    # Initialize counts
    underflow = 0
    bucket_counts = [0] * (len(boundaries) - 1 + 1)  # N-1 bounded + 1 unbounded final

    # Actually: N boundaries produce N buckets (N-1 bounded + 1 final open)
    # boundaries = [b0, b1, ..., b_{N-1}]
    # bucket 0: [b0, b1)
    # bucket 1: [b1, b2)
    # ...
    # bucket N-2: [b_{N-2}, b_{N-1})
    # bucket N-1: [b_{N-1}, +inf)
    n = len(boundaries)
    bucket_counts = [0] * n  # n buckets total (index 0 to n-1)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            val = float(line)
        except ValueError:
            sys.exit(2)

        # Reject NaN
        if math.isnan(val):
            sys.exit(2)

        if val < boundaries[0]:
            underflow += 1
        else:
            # Find which bucket: largest boundary index where boundaries[i] <= val
            placed = False
            for i in range(n - 1):
                lo = boundaries[i]
                hi = boundaries[i + 1]
                if lo <= val < hi:
                    bucket_counts[i] += 1
                    placed = True
                    break
            if not placed:
                # val >= boundaries[-1] → final bucket
                bucket_counts[n - 1] += 1

    # Build output
    buckets_out = []
    for i in range(n):
        lo = boundaries[i]
        if i < n - 1:
            hi = boundaries[i + 1]
        else:
            hi = None  # final bucket: open-ended
        buckets_out.append({"count": bucket_counts[i], "hi": hi, "lo": lo})

    result = {"buckets": buckets_out, "underflow": underflow}
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    main()
