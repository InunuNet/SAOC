#!/usr/bin/env python3
"""
verify_symlink_full_path_refusal.py — F10: full-path symlink refusal.

QA FAIL on 5709fcd0: the F8 EDGE 1 symlink refusal (execution/update_
template.py's _sync_file_with_guard(), checking `dst_file.is_symlink()`)
is LEAF-ONLY. It lstats the FINAL path component, which naturally
resolves through any symlinked ANCESTOR directory via normal OS path
resolution before lstat-ing the leaf -- so a regular file sitting inside a
symlinked directory has `is_symlink()` return False for the file itself,
and the guard never fires. Confirmed with 5 REAL reproductions against
the shipped code (2026-08-15, real CLI subprocess, no mocking, no
mutation -- every one of these is a scenario the current code actually
gets wrong today):

  1. copy_harness() directory branch, ENTRY ROOT is a symlink to an
     external directory, legitimate write attempted (baseline matches
     local, incoming differs -- exactly the case F5 is supposed to
     deliver freely): WRITES THROUGH. `dst.mkdir(parents=True,
     exist_ok=True)` at the top of the directory branch has no symlink
     check at all, and succeeds silently (mkdir's exist_ok path checks
     is_dir(), which follows the symlink and reports True).
  2. copy_harness() directory branch, INTERMEDIATE component at depth 1
     is a symlink, entry root itself real: WRITES THROUGH. Same
     mechanism -- the rglob walk computes `dst_file = dst / rel`, and
     `_sync_file_with_guard()`'s `dst_file.is_symlink()` check lstats only
     the leaf, which is not itself a symlink.
  3. MERGE category (merge_line_union / merge_json_deep): WRITES THROUGH
     with ZERO symlink awareness whatsoever -- these two functions call
     `dst.write_text(...)` directly and never check `is_symlink()` at any
     level, leaf or ancestor. This is the MOST exposed of the six write
     paths, not merely as-exposed as the directory branches.
  4. apply_fresh_manifest_backstop() directory branch, entry root is a
     symlink, destination file MISSING through it (the scenario this
     backstop exists for): WRITES THROUGH, delivering canonical content
     into the external target.
  5. apply_missing_file_backstop(), a REQUIRED_FILES entry's PARENT
     directory (e.g. execution/) is a symlink: WRITES THROUGH.
  Relative-target symlinks behave identically to absolute-target symlinks
  in every case tested (Python's is_symlink()/lstat do not distinguish
  target format) -- confirmed for row 1's scenario with a `../OUTSIDE`
  relative target, same result.

REGRESSION CONTROL, must NOT change: leaf symlink (the case F8 EDGE 1
already fixed) -- confirmed still correctly refused under the identical
"legitimate write" framing used for rows 1/2/4/5 above (a baseline-
matching, content-differing scenario, not merely a content-mismatch that
would be guarded by F5 for unrelated reasons). This is the control that
proves the six real reproductions above are not simply "nothing works,"
narrowing the required fix to ancestor-path checking specifically.

ENUMERATION OF ALL SIX WRITE PATHS (per the lead's explicit instruction
that a fix covering some is not "covered" -- named from source,
execution/update_template.py, current HEAD):
  (a) copy_harness() single-file branch (~line 342) -> _sync_file_with_guard
  (b) copy_harness() directory branch (~line 310-340) -> per-file
      _sync_file_with_guard, entry root `dst.mkdir()` unguarded
  (c) apply_fresh_manifest_backstop() directory branch (~line 671-694)
  (d) apply_fresh_manifest_backstop() file branch (~line 695-710)
  (e) apply_missing_file_backstop() (~line 550-594)
  (f) MERGE category: merge_line_union() (~line 352) and
      merge_json_deep() (~line 388) -- ZERO symlink check, not even leaf
All six are exercised below except (a) and (d), which share the identical
_sync_file_with_guard() call as (b)/(c)'s per-file loop and (e) -- their
leaf behavior is proven by the regression control and their only
distinguishing risk (an ancestor-symlinked single-file manifest entry) is
covered by row 5's execution/ scenario, which IS a single-file-branch-
shaped delivery (apply_missing_file_backstop targets individual files,
not a directory rglob).

FIX SHAPE (per QA, endorsed): a centralized helper --
_contains_symlink_component(path, stop_at) -- walking path's ancestors up
to and including stop_at (the entry root), refusing if ANY component
(including the entry root itself) is a symlink. Called once before
entering (b), (c)'s directory branches (checking dst/dst_dir itself), and
reused inside _sync_file_with_guard()'s existing leaf check so the walk
logic exists ONCE, not three times. (f)'s merge functions need the same
check added net-new, since they currently have none at all. Refusal must
NEVER unlink-and-replace, and must name both the path and its resolved
target.
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

UPDATE_TEMPLATE = Path("execution/update_template.py").resolve()
SANDBOX = Path("/tmp/verify_symlink_full_path_refusal_sandbox")


def _write(p: Path, content: str):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)


def run(ws: Path, up: Path):
    r = subprocess.run(
        [sys.executable, str(UPDATE_TEMPLATE), "--apply", "--source", str(up)],
        cwd=ws, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=30,
    )
    return r.returncode, r.stdout


def base_ws(name):
    ws = SANDBOX / f"ws_{name}"
    up = SANDBOX / f"up_{name}"
    shutil.rmtree(ws, ignore_errors=True)
    shutil.rmtree(up, ignore_errors=True)
    _write(ws / "WORKSPACE", "TestWorkspace\n")
    _write(ws / ".agent/profile.json", json.dumps({"project_name": "test", "template_version": "1.0.0"}))
    _write(ws / ".agent/version", "1.0.0\n")
    return ws, up


def main() -> int:
    failures = []

    # ROW 1: copy_harness dir branch, entry root symlink, legit update.
    ws, up = base_ws("entryroot")
    _write(ws / ".agent/update-manifest.yaml", "paths:\n  - category: HARNESS\n    path: .agent/skills/\n")
    _write(up / ".agent/skills/foo.py", "upstream v2 -- must not land outside\n")
    _write(up / ".agent/version", "2.0.0\n")
    outside = ws / "OUTSIDE_entryroot"
    outside.mkdir(parents=True)
    old = "upstream v1 -- matches recorded baseline\n"
    (outside / "foo.py").write_text(old)
    (ws / ".agent").mkdir(parents=True, exist_ok=True)
    (ws / ".agent/skills").symlink_to(outside)
    _write(ws / ".agent/memory/scratch/template_baselines.json",
           json.dumps({".agent/skills/foo.py": hashlib.sha256(old.encode()).hexdigest()}))
    run(ws, up)
    written = (outside / "foo.py").read_text() != old
    print(f"[ROW 1: entry root symlink, dir branch] written_through={written}")
    if written:
        failures.append("ROW 1: copy_harness() directory branch wrote through a symlinked entry root")

    # ROW 1b: same as ROW 1 but a RELATIVE symlink target.
    ws1b, up1b = base_ws("entryroot_rel")
    _write(ws1b / ".agent/update-manifest.yaml", "paths:\n  - category: HARNESS\n    path: .agent/skills/\n")
    _write(up1b / ".agent/skills/foo.py", "upstream v2 -- must not land outside\n")
    _write(up1b / ".agent/version", "2.0.0\n")
    outside1b = ws1b / "OUTSIDE_entryroot_rel"
    outside1b.mkdir(parents=True)
    (outside1b / "foo.py").write_text(old)
    (ws1b / ".agent").mkdir(parents=True, exist_ok=True)
    os.symlink("../OUTSIDE_entryroot_rel", ws1b / ".agent/skills")
    _write(ws1b / ".agent/memory/scratch/template_baselines.json",
           json.dumps({".agent/skills/foo.py": hashlib.sha256(old.encode()).hexdigest()}))
    run(ws1b, up1b)
    written1b = (outside1b / "foo.py").read_text() != old
    print(f"[ROW 1b: entry root symlink, RELATIVE target] written_through={written1b}")
    if written1b:
        failures.append("ROW 1b: relative-target symlink at entry root also written through (same defect, different target style)")

    # ROW 2: copy_harness dir branch, intermediate component symlink.
    ws2, up2 = base_ws("intermediate")
    _write(ws2 / ".agent/update-manifest.yaml", "paths:\n  - category: HARNESS\n    path: .agent/skills/\n")
    _write(up2 / ".agent/skills/sub/deep.txt", "upstream v2 -- must not land outside\n")
    _write(up2 / ".agent/version", "2.0.0\n")
    (ws2 / ".agent/skills").mkdir(parents=True, exist_ok=True)
    outside2 = ws2 / "OUTSIDE_intermediate"
    outside2.mkdir(parents=True)
    (outside2 / "deep.txt").write_text(old)
    (ws2 / ".agent/skills/sub").symlink_to(outside2)
    _write(ws2 / ".agent/memory/scratch/template_baselines.json",
           json.dumps({".agent/skills/sub/deep.txt": hashlib.sha256(old.encode()).hexdigest()}))
    run(ws2, up2)
    written2 = (outside2 / "deep.txt").read_text() != old
    print(f"[ROW 2: intermediate component symlink] written_through={written2}")
    if written2:
        failures.append("ROW 2: an intermediate (non-leaf, non-entry-root) symlinked directory was written through")

    # ROW 3: MERGE category, zero symlink check at any level.
    ws3, up3 = base_ws("merge")
    _write(ws3 / ".agent/update-manifest.yaml",
           "paths:\n  - category: MERGE\n    path: rules.md\n    strategy: line_union\n")
    _write(up3 / "rules.md", "new upstream rule line\n")
    _write(up3 / ".agent/version", "2.0.0\n")
    outside3 = ws3 / "OUTSIDE_merge_target.md"
    outside3.write_text("pre-existing external content, must not be touched\n")
    (ws3 / "rules.md").symlink_to(outside3)
    run(ws3, up3)
    written3 = outside3.read_text() != "pre-existing external content, must not be touched\n"
    print(f"[ROW 3: MERGE category, no check at all] written_through={written3}")
    if written3:
        failures.append("ROW 3: merge_line_union() wrote through a symlinked destination with zero symlink awareness")

    # ROW 4: apply_fresh_manifest_backstop directory branch, entry root symlink.
    ws4, up4 = base_ws("backstop_entryroot")
    _write(ws4 / ".agent/update-manifest.yaml", "paths: []\n")
    _write(up4 / ".agent/update-manifest.yaml", "paths:\n  - category: HARNESS\n    path: .agent/skills/\n")
    _write(up4 / ".agent/skills/foo.py", "canonical incoming -- must not land outside\n")
    _write(up4 / ".agent/version", "2.0.0\n")
    outside4 = ws4 / "OUTSIDE_backstop_entryroot"
    outside4.mkdir(parents=True)
    (ws4 / ".agent").mkdir(parents=True, exist_ok=True)
    (ws4 / ".agent/skills").symlink_to(outside4)
    run(ws4, up4)
    delivered4 = (outside4 / "foo.py").exists()
    print(f"[ROW 4: fresh-manifest backstop, entry root symlink] delivered_into_external={delivered4}")
    if delivered4:
        failures.append("ROW 4: apply_fresh_manifest_backstop() delivered a new file through a symlinked entry root")

    # ROW 5: apply_missing_file_backstop, REQUIRED_FILES parent dir symlinked.
    ws5, up5 = base_ws("backstop_required")
    _write(ws5 / ".agent/update-manifest.yaml", "paths: []\n")
    _write(up5 / "execution/contract.py", "canonical incoming -- must not land outside\n")
    _write(up5 / ".agent/version", "2.0.0\n")
    outside5 = ws5 / "OUTSIDE_backstop_required"
    outside5.mkdir(parents=True)
    (ws5 / "execution").symlink_to(outside5)
    run(ws5, up5)
    delivered5 = (outside5 / "contract.py").exists()
    print(f"[ROW 5: missing-file backstop, REQUIRED_FILES parent symlinked] delivered_into_external={delivered5}")
    if delivered5:
        failures.append("ROW 5: apply_missing_file_backstop() delivered a REQUIRED_FILE through a symlinked parent directory")

    # REGRESSION CONTROL: leaf symlink, legit update -- must stay refused.
    ws6, up6 = base_ws("leaf_control")
    _write(ws6 / ".agent/update-manifest.yaml", "paths:\n  - category: HARNESS\n    path: .agent/skills/\n")
    _write(up6 / ".agent/skills/foo.py", "upstream v2 -- must not land outside\n")
    _write(up6 / ".agent/version", "2.0.0\n")
    (ws6 / ".agent/skills").mkdir(parents=True, exist_ok=True)
    outside6 = ws6 / "OUTSIDE_leaf.txt"
    outside6.write_text(old)
    (ws6 / ".agent/skills/foo.py").symlink_to(outside6)
    _write(ws6 / ".agent/memory/scratch/template_baselines.json",
           json.dumps({".agent/skills/foo.py": hashlib.sha256(old.encode()).hexdigest()}))
    run(ws6, up6)
    written6 = outside6.read_text() != old
    print(f"[REGRESSION: leaf symlink, must stay refused] written_through={written6}")
    if written6:
        failures.append("REGRESSION: leaf symlink refusal (already fixed) has regressed")

    shutil.rmtree(SANDBOX, ignore_errors=True)

    if failures:
        print(f"\nFAIL — {len(failures)} violation(s):")
        for f in failures:
            print(f"  {f}")
        return 1

    print("\nOK — no write path follows a symlink at any path depth, leaf regression control holds.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
