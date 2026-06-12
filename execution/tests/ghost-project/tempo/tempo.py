#!/usr/bin/env python3
"""Tempo — deterministic exponential backoff scheduler."""

import json
import math
import random
import sys


def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError) as e:
        sys.stderr.write(f"Invalid JSON input: {e}\n")
        sys.exit(1)

    # Extract fields
    attempt = data.get("attempt")
    base_ms = data.get("base_ms")
    max_ms = data.get("max_ms")
    seed = data.get("seed")
    jitter = data.get("jitter")

    # Validate
    errors = []
    if not isinstance(attempt, int) or attempt < 1:
        errors.append("attempt must be an integer >= 1")
    if not isinstance(base_ms, int) or base_ms < 1:
        errors.append("base_ms must be an integer >= 1")
    if not isinstance(max_ms, int) or (isinstance(base_ms, int) and max_ms < base_ms):
        errors.append("max_ms must be an integer >= base_ms")
    if not isinstance(seed, int) or seed < 0:
        errors.append("seed must be an integer >= 0")
    if jitter not in ("none", "full"):
        errors.append('jitter must be "none" or "full"')

    if errors:
        for err in errors:
            sys.stderr.write(f"Validation error: {err}\n")
        sys.exit(1)

    # Compute raw backoff using Python int math (no overflow)
    raw = base_ms * (2 ** (attempt - 1))

    # Apply cap
    capped_delay = min(raw, max_ms)
    capped_flag = raw > max_ms  # strict: raw == max_ms → False

    # Apply jitter
    if jitter == "none":
        final = capped_delay
    else:  # jitter == "full"
        r = random.Random(seed)
        last_value = None
        for _ in range(attempt):
            last_value = r.random()
        final = math.floor(last_value * capped_delay)

    result = {
        "attempt": attempt,
        "capped": capped_flag,
        "delay_ms": final,
    }
    sys.stdout.write(json.dumps(result, sort_keys=True, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
