#!/usr/bin/env python3
"""
verify_mirror_sync.py — F7: template/execution/ must never silently ship
stale harness code.

CONFIRMED LIVE DEFECT (2026-08-15): execution/update_template.py's main()
falls back to `source = Path("template")` — the DOWNSTREAM workspace's own
local template/ mirror — whenever `fetch_latest_from_github()` fails (gh
missing, no auth, network down). The manifest (.agent/update-manifest.yaml)
ships `execution/` under HARNESS, so on that fallback path template/execution/
is copied OVER execution/, silently DOWNGRADING the very updater plus every
guard it carries. Right now in this repo:
  execution/update_template.py           = 1863 lines (has _refuse_symlinked_write,
                                            _create_guarded_backup_dir,
                                            BackupDirRefused, cmd_reconcile_from_history)
  template/execution/update_template.py  =  469 lines (has NONE of them; last
                                            touched 241ac24e, 2026-07-09)
...while .agent/version and template/.agent/version BOTH read 3.7.109 — the
version stamp claims currency while the mirrored code is a month stale. That
is what made this invisible: nothing compared the two copies' actual bytes.

This check is broader than update_template.py alone: it walks every .py and
.sh file that exists in BOTH execution/ (repo root) and template/execution/
(the harness's own self-mirror, delivered to every downstream workspace on
the update_template.py fallback path above) and fails if any pair's bytes
differ. It intentionally does NOT check files that exist in only one side —
new root-only scripts not yet mirrored are a related but distinct defect
(see the contract's notes) — this check is scoped to DIVERGENCE of files
that are supposed to be identical copies, which is the exact failure mode
that shipped a broken updater as "current".

SCOPE (see contract-f7.yaml notes for the full inclusion/exclusion
rationale): executable harness code only —
  - execution/**/*.py  vs  template/execution/**/*.py
  - execution/**/*.sh  vs  template/execution/**/*.sh
This deliberately excludes .agent/agents/*.md, Makefile, README.md, and
other manifest HARNESS/MERGE entries that are legitimately edited on
different cadences or use a MERGE strategy rather than a straight mirror —
see contract notes for why those are out of scope for THIS check.
"""
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
LIVE_DIR = REPO_ROOT / "execution"
MIRROR_DIR = REPO_ROOT / "template" / "execution"


def find_shared_files():
    """Yield (live_path, mirror_path, rel) for every *.py/*.sh that exists
    in BOTH execution/ and template/execution/, matched by path relative
    to each root."""
    shared = []
    for pattern in ("*.py", "*.sh"):
        for mirror_path in sorted(MIRROR_DIR.rglob(pattern)):
            rel = mirror_path.relative_to(MIRROR_DIR)
            live_path = LIVE_DIR / rel
            if live_path.is_file():
                shared.append((live_path, mirror_path, str(rel)))
    return shared


def main():
    shared = find_shared_files()
    if not shared:
        print("FAIL — found zero shared execution/*.py|*.sh files between "
              "execution/ and template/execution/; the discovery walk is "
              "broken (expected dozens, e.g. update_template.py, "
              "hooks/full_boot.sh)")
        return 1

    diverged = []
    for live_path, mirror_path, rel in shared:
        live_bytes = live_path.read_bytes()
        mirror_bytes = mirror_path.read_bytes()
        if live_bytes != mirror_bytes:
            diverged.append((rel, len(live_bytes.splitlines()),
                              len(mirror_bytes.splitlines())))

    live_version = (REPO_ROOT / ".agent" / "version").read_text().strip()
    mirror_version = (REPO_ROOT / "template" / ".agent" / "version").read_text().strip()

    print(f"[scan] {len(shared)} shared execution file(s) compared between "
          f"execution/ and template/execution/")
    print(f"[version] .agent/version={live_version}  "
          f"template/.agent/version={mirror_version}")

    if diverged:
        print()
        print(f"FAIL — {len(diverged)} harness file(s) diverged between "
              f"execution/ (live) and template/execution/ (mirror):")
        for rel, live_lines, mirror_lines in diverged:
            print(f"  DIVERGED: {rel}  "
                  f"(execution/{rel}={live_lines} lines, "
                  f"template/execution/{rel}={mirror_lines} lines)")
        if live_version == mirror_version:
            print()
            print(f"  version stamps MATCH ({live_version}) despite this "
                  f"divergence — a version-currency check alone would have "
                  f"reported this workspace as up to date while shipping "
                  f"stale/regressed code on the next fallback-source apply.")
        return 1

    print()
    print(f"OK — all {len(shared)} shared execution file(s) are byte-identical "
          f"between execution/ and template/execution/.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
