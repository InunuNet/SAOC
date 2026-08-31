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
CONFIG_LIVE_DIR = REPO_ROOT / ".agent" / "config"
CONFIG_MIRROR_DIR = REPO_ROOT / "template" / ".agent" / "config"
CONFIG_MUST_SHIP = [
    "free_models.json",
]

# MUST_SHIP: load-bearing execution/ files that every downstream workspace
# must receive via template/execution/. Unlike find_shared_files() below
# (which only ever sees files that already exist in BOTH trees), this list
# is hardcoded so a file that is missing from the mirror ENTIRELY — not just
# byte-diverged — is still caught. This is the gap that let quota.py (the
# admission-control oracle behind mission.py's gates) ship live but never
# reach template/execution/ at all.
#
# overlay_all.sh, overlay_fleet.sh, and fleet_update.sh are deliberately NOT
# in this list. They are this-machine-only fleet tooling: overlay_all.sh's
# IGNORE array is the operator's personal project roster and PROJECTS_ROOT
# defaults to $HOME/ai, and overlay_fleet.sh/fleet_update.sh assume the same
# local sibling-project layout. None of that exists in a downstream
# workspace, so shipping them via the mirror would mislead a fresh project
# into running fleet commands against a fleet it doesn't have. This mirrors
# the F7 backlog ruling (.agent/memory/project/backlog.md) — they were
# excluded on purpose, not forgotten.
MUST_SHIP = [
    "quota.py",
    "codex_qa.sh",
    "failure_router.sh",
    "hooks/session_token_log.sh",
    "hooks/compaction_backstop.sh",
    "hooks/lib/context_window.py",
    "skills/lib/mission_complete.py",
    "skills/lib/scoped_stage.py",
    "skills/lib/secret_guard.py",
    "skills/wrap_mission.sh",
    "skills/quick_gate.sh",
    "dispatch_free_model.py",
    "dispatch_name.py",
    "sync_autonomy.py",
    "retro.py",
    "capture_pain.py",
    "verify_agents.sh",
    "validate_manifest.sh",
    "audit_gates.py",
    "token_report.py",
    "onboard_headless.py",
    "gh_closure_scan.py",
    "repo_info.sh",
]


def find_missing_must_ship(mirror_dir: Path = MIRROR_DIR,
                            must_ship: list = MUST_SHIP) -> list:
    """Return the sorted subset of must_ship whose path does not exist as a
    file under mirror_dir."""
    return sorted(rel for rel in must_ship if not (mirror_dir / rel).is_file())


def find_shared_files(live_dir: Path = LIVE_DIR, mirror_dir: Path = MIRROR_DIR,
                       patterns: tuple = ("*.py", "*.sh")):
    """Yield (live_path, mirror_path, rel) for every file matching patterns
    that exists in BOTH live_dir and mirror_dir, matched by path relative
    to each root."""
    shared = []
    for pattern in patterns:
        for mirror_path in sorted(mirror_dir.rglob(pattern)):
            rel = mirror_path.relative_to(mirror_dir)
            live_path = live_dir / rel
            if live_path.is_file():
                shared.append((live_path, mirror_path, str(rel)))
    return shared


def main():
    missing = find_missing_must_ship()
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

    config_missing = find_missing_must_ship(CONFIG_MIRROR_DIR, CONFIG_MUST_SHIP)
    config_shared = find_shared_files(CONFIG_LIVE_DIR, CONFIG_MIRROR_DIR, patterns=("*.json",))
    config_diverged = []
    for live_path, mirror_path, rel in config_shared:
        live_bytes = live_path.read_bytes()
        mirror_bytes = mirror_path.read_bytes()
        if live_bytes != mirror_bytes:
            config_diverged.append((rel, len(live_bytes.splitlines()),
                                     len(mirror_bytes.splitlines())))

    live_version = (REPO_ROOT / ".agent" / "version").read_text().strip()
    mirror_version = (REPO_ROOT / "template" / ".agent" / "version").read_text().strip()

    print(f"[scan] {len(shared)} shared execution file(s) compared between "
          f"execution/ and template/execution/")
    print(f"[config-scan] {len(config_shared)} shared config file(s) compared "
          f"between .agent/config/ and template/.agent/config/")
    print(f"[version] .agent/version={live_version}  "
          f"template/.agent/version={mirror_version}")

    if missing:
        print()
        print(f"FAIL — {len(missing)} MUST-SHIP file(s) missing entirely from "
              f"template/execution/ (not just diverged):")
        for rel in missing:
            print(f"  MISSING: {rel}")

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

    if config_missing:
        print()
        print(f"FAIL — {len(config_missing)} MUST-SHIP file(s) missing entirely from "
              f"template/.agent/config/ (not just diverged):")
        for rel in config_missing:
            print(f"  MISSING: {rel}")

    if config_diverged:
        print()
        print(f"FAIL — {len(config_diverged)} config file(s) diverged between "
              f".agent/config/ (live) and template/.agent/config/ (mirror):")
        for rel, live_lines, mirror_lines in config_diverged:
            print(f"  DIVERGED: {rel}  "
                  f"(.agent/config/{rel}={live_lines} lines, "
                  f"template/.agent/config/{rel}={mirror_lines} lines)")

    if missing or diverged or config_missing or config_diverged:
        return 1

    print()
    print(f"OK — all {len(shared)} shared execution file(s) are byte-identical "
          f"between execution/ and template/execution/.")
    print(f"OK — all {len(config_shared)} shared config file(s) are byte-identical "
          f"between .agent/config/ and template/.agent/config/.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
