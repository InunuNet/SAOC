#!/usr/bin/env python3
"""Print the active mission's checkpoint (milestone/feature) from active.json.

Pure function of a path: reads checkpoint.milestone/checkpoint.feature and
prints "Checkpoint: <milestone>/<feature>" if either is set, else nothing.
Never raises or exits nonzero -- boot must never abort on this.
"""
import json
import pathlib
import sys


def main() -> int:
    if len(sys.argv) != 2:
        return 0
    active_path = pathlib.Path(sys.argv[1])
    try:
        data = json.loads(active_path.read_text())
        checkpoint = data.get("checkpoint") or {}
        milestone = checkpoint.get("milestone")
        feature = checkpoint.get("feature")
        if milestone or feature:
            print(f"Checkpoint: {milestone or '?'}/{feature or '?'}")
    except Exception:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
