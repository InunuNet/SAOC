#!/usr/bin/env python3
"""Verify gh_closure_scan.py merges commit+mission evidence and filters to open issues only.

Exit 0 + print "OK" on success. Exit 1 + diff on stderr on failure.
"""
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
OPEN_ISSUES_FIXTURE = (
    REPO_ROOT
    / ".agent/memory/project/specs/maintainer-gh-closure-candidates/goldens/open_issues_fixture.json"
)
EXPECTED = [1293, 1295, 1296]


def main():
    result = subprocess.run(
        [
            sys.executable,
            "execution/gh_closure_scan.py",
            "--since",
            "2026-07-10T00:00:00",
            "--repo",
            "InunuNet/Athanor",
            "--open-issues-json",
            str(OPEN_ISSUES_FIXTURE),
            "--format",
            "json",
        ],
        capture_output=True,
        text=True,
        cwd=str(REPO_ROOT),
    )
    if result.returncode != 0:
        print(f"FAIL: gh_closure_scan.py exited {result.returncode}", file=sys.stderr)
        print(f"stdout: {result.stdout}", file=sys.stderr)
        print(f"stderr: {result.stderr}", file=sys.stderr)
        sys.exit(1)

    try:
        candidates = json.loads(result.stdout)
    except json.JSONDecodeError as e:
        print(f"FAIL: could not parse stdout as JSON: {e}", file=sys.stderr)
        print(f"stdout: {result.stdout}", file=sys.stderr)
        sys.exit(1)

    got = sorted(c["number"] for c in candidates)
    if got != EXPECTED:
        print(f"FAIL: got {got}, want {EXPECTED}", file=sys.stderr)
        print(f"full output: {json.dumps(candidates, indent=2)}", file=sys.stderr)
        sys.exit(1)

    print("OK")
    sys.exit(0)


if __name__ == "__main__":
    main()
