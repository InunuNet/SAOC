#!/usr/bin/env python3
"""scoped_stage.py — stage only a mission's own touched files.

Resolves the mission's touched-files ledger (execution/mission.py's
<slug>.touched.json sidecar) plus always-owned paths (the mission file
itself, everything under its own spec dir), intersects that with the
current `git status --porcelain` dirty set (dropping stale ledger entries
for files that have since been cleaned/reverted), and stages exactly that
resolved list via explicit `git add -- <paths>`. Never stages everything
in the working tree.

Usage:
    scoped_stage.py --mission <mission.md> [--dry-run]
    scoped_stage.py --mission <mission.md> --list

--dry-run / --list both resolve and print the path list without staging,
so callers (e.g. mission.py's secret-guard preflight) can reuse this same
resolution logic instead of running their own separate dry run.
"""
import argparse
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "execution"))

import mission  # noqa: E402  (sys.path must be set up first)

SPECS_ROOT = ".agent/memory/project/specs"


def _dirty_paths() -> set[str]:
    return {p for p in mission._git_status_porcelain() if p}


def resolve_paths(mission_path: str) -> list[str]:
    """Return the sorted, currently-dirty paths owned by this mission.

    Owned = ledger's recorded `paths` (per-feature touched files) union
    always-owned paths (the mission file itself, everything under the
    mission's own spec dir), intersected with what git currently reports
    as dirty. An empty or missing ledger resolves to "stage nothing but
    always-owned paths that are dirty" — never "stage everything".
    """
    fm, _ = mission.parse_mission_file(mission_path)
    slug = fm.get("slug", Path(mission_path).stem)
    ledger = mission._read_touched_ledger(slug)
    owned = set(ledger.get("paths", []))

    mission_path_str = str(Path(mission_path).as_posix())
    spec_dir = f"{SPECS_ROOT}/{slug}/"

    dirty = _dirty_paths()

    resolved = set()
    for path in dirty:
        if path == mission_path_str:
            resolved.add(path)
        elif path.startswith(spec_dir) or path == spec_dir.rstrip("/"):
            resolved.add(path)
        elif path in owned:
            resolved.add(path)

    return sorted(resolved)


def stage(paths: list[str]) -> None:
    """Stage the resolved paths. A single bad/invalid pathspec must never block
    staging of the rest: try the fast batched `git add --` first, and only if
    that fails, fall back to staging paths one at a time so we can isolate and
    report the specific failure(s) instead of staging nothing.
    """
    if not paths:
        return
    result = subprocess.run(["git", "add", "--"] + paths, capture_output=True, text=True)
    if result.returncode == 0:
        return

    failures = []
    for path in paths:
        single = subprocess.run(["git", "add", "--", path], capture_output=True, text=True)
        if single.returncode != 0:
            failures.append((path, single.stderr.strip()))

    if failures:
        for path, err in failures:
            print(f"  FAILED to stage: {path}  ({err})", file=sys.stderr)
        raise SystemExit(
            f"scoped_stage: {len(failures)} of {len(paths)} path(s) failed to stage; "
            f"the rest were staged individually."
        )


def main():
    parser = argparse.ArgumentParser(description="Stage only a mission's own touched files.")
    parser.add_argument("--mission", required=True, help="Path to the mission .md file")
    parser.add_argument("--dry-run", action="store_true",
                         help="Resolve and print paths without staging")
    parser.add_argument("--list", action="store_true", dest="list_only",
                         help="Alias for --dry-run")
    args = parser.parse_args()

    paths = resolve_paths(args.mission)

    dry = args.dry_run or args.list_only
    if dry:
        for p in paths:
            print(p)
        return

    stage(paths)
    print("staged:")
    for p in paths:
        print(f"  {p}")


if __name__ == "__main__":
    main()
