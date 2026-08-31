#!/usr/bin/env python3
"""Loud-not-silent boot-context check (GH #1366 P0). Never exits nonzero —
mirrors full_boot.sh's own "all steps non-fatal" philosophy. Prints a
warning when boot context was never injected this session (missing marker)
or looks stale (marker older than the max-age window), silent otherwise."""
import os
import sys
import time

MARKER = os.environ.get(
    "ATHANOR_BOOT_MARKER_PATH", ".agent/memory/scratch/.last_full_boot_ts"
)
MAX_AGE_SECONDS = int(os.environ.get("ATHANOR_BOOT_MARKER_MAX_AGE", "21600"))


def main() -> int:
    try:
        with open(MARKER) as f:
            ts = float(f.read().strip())
    except (FileNotFoundError, ValueError):
        print(
            "⛔ BOOT CONTEXT NOT INJECTED THIS SESSION — run: "
            "bash execution/hooks/full_boot.sh before any substantive work."
        )
        return 0

    age = time.time() - ts
    if age > MAX_AGE_SECONDS:
        print(
            f"⛔ BOOT CONTEXT STALE ({int(age)}s old) — run: "
            "bash execution/hooks/full_boot.sh"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
