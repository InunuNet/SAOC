#!/usr/bin/env python3
"""A1 -- the prerendered /national-show hub page does not reach firebase-admin.

Replaces ticket-onsale-predicate A7, a shell pipeline that negated the sweep's grep: it passed
whenever the sweep crashed, was missing, or changed its output format. This helper fails closed:
the sweep must run, its VIOLATIONS header must be present, and no violation line may name the
hub page.

Usage: check-national-show-not-prerendered-admin.py <repo_root>
"""
import subprocess
import sys
from pathlib import Path

HEADER = "(VIOLATIONS):"
SWEEP = Path("contracts/golden/build-without-secrets/check_no_prerendered_admin_routes.py")


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: check-national-show-not-prerendered-admin.py <repo_root>", file=sys.stderr)
        return 2
    root = Path(sys.argv[1]).resolve()
    sweep = root / SWEEP
    if not sweep.is_file():
        print(f"FAIL sweep script missing: {sweep}")
        return 1
    proc = subprocess.run([sys.executable, str(sweep), str(root)], capture_output=True, text=True)
    # The sweep exits 1 for ANY violation anywhere; only its report matters here.
    lines = proc.stdout.splitlines()
    heads = [i for i, ln in enumerate(lines) if ln.endswith(HEADER)]
    if not heads:
        print(f"FAIL sweep produced no VIOLATIONS header (rc={proc.returncode}): {proc.stderr[-200:]}")
        return 1
    violations = [ln.strip() for ln in lines[heads[0] + 1:] if ln.startswith("  ")]
    hub = [v for v in violations if v.endswith("national-show/page.tsx") and "/" in v and v.count("national-show/") == 1]
    if hub:
        print(f"FAIL prerendered hub page reaches firebase-admin: {hub}")
        return 1
    if not (root / "app/(nos)/national-show/page.tsx").is_file():
        print("FAIL hub page app/(nos)/national-show/page.tsx not found; check would be vacuous")
        return 1
    print("PASS A1 hub page is not a prerendered firebase-admin violation")
    return 0


if __name__ == "__main__":
    sys.exit(main())
