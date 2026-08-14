#!/usr/bin/env python3
"""verify_f3_no_direct_brain_call.py -- static check for mission
harness-integrity-hardening F3 (review Finding 4).

Asserts execution/mission.py's cmd_close_out function body does NOT invoke
execution/brain.py directly (that call must be delegated to
execution/skills/wrap_mission.sh instead -- see design.md for the chosen
delegation direction). Exit 0 = compliant, exit 1 = still calling brain.py
directly (RED / not yet fixed).
"""
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MISSION_PY = REPO_ROOT / "execution" / "mission.py"


def main() -> int:
    src = MISSION_PY.read_text()
    lines = src.splitlines()
    start = None
    end = len(lines)
    for i, line in enumerate(lines):
        if line.startswith("def cmd_close_out"):
            start = i
            continue
        if start is not None and i > start and line.startswith("def "):
            end = i
            break
    if start is None:
        print("FAIL: cmd_close_out function not found in execution/mission.py")
        return 1
    body = "\n".join(lines[start:end])
    if "brain.py" in body:
        print("FAIL: cmd_close_out still calls execution/brain.py directly -- must delegate to wrap_mission.sh instead")
        return 1
    if "wrap_mission.sh" not in body:
        print("FAIL: cmd_close_out does not delegate to execution/skills/wrap_mission.sh")
        return 1
    print("PASS: cmd_close_out delegates to wrap_mission.sh, no direct brain.py call")
    return 0


if __name__ == "__main__":
    sys.exit(main())
