#!/usr/bin/env python3
"""mission_complete.py — check whether the mission referenced by active.json is done.

Usage:
    mission_complete.py <active_json_path>

Exit codes (three-valued — callers MUST branch on all three, not just 0/nonzero):
    0 — mission file exists AND its YAML frontmatter "status" == "done".
        This is the ONLY case in which a caller may clear active.json.
    1 — mission file exists but status != "done" (pending/paused/no status
        key). active.json must be left intact.
    2 — no-op: active.json missing/unreadable, its "mission" field is
        absent/null, OR the referenced mission file is missing on disk.
        Prints "no-mission" to stdout. Must never crash. active.json must
        be left intact — exit 2 is NOT "done" and must never be treated
        as such by a caller checking only `$?`.
"""

import json
import pathlib
import sys

NO_MISSION = "no-mission"


def load_mission_pointer(active_path: pathlib.Path):
    """Return the "mission" pointer from active.json, or None if unavailable."""
    if not active_path.exists():
        return None
    try:
        data = json.loads(active_path.read_text())
    except (json.JSONDecodeError, OSError):
        return None
    return data.get("mission")


def parse_frontmatter_status(mission_path: pathlib.Path):
    """Return the "status" value from a mission file's YAML frontmatter, or None."""
    text = mission_path.read_text()
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None
    status = None
    for line in lines[1:]:
        stripped = line.strip()
        if stripped == "---":
            break
        if stripped.startswith("status:"):
            status = stripped.split(":", 1)[1].strip().strip("'\"")
    return status


def main() -> int:
    if len(sys.argv) < 2:
        print(NO_MISSION)
        return 2

    active_path = pathlib.Path(sys.argv[1])
    mission_pointer = load_mission_pointer(active_path)
    if not mission_pointer:
        print(NO_MISSION)
        return 2

    mission_path = pathlib.Path(mission_pointer)
    if not mission_path.exists():
        print(NO_MISSION)
        return 2

    status = parse_frontmatter_status(mission_path)
    print(status if status is not None else "")
    return 0 if status == "done" else 1


if __name__ == "__main__":
    sys.exit(main())
