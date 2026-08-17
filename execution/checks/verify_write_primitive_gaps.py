#!/usr/bin/env python3
"""
verify_write_primitive_gaps.py — F12/F13/F14: the write sites contract-f5
(F10) does not cover, because F10 only wired the ancestor-symlink walk
into copy_harness()'s two branches, apply_fresh_manifest_backstop(),
apply_missing_file_backstop(), and the two MERGE functions' DELIVERY
targets. @dev traced ~15 total write sites from source (not the 6 F10's
own scope enumerated) and found 8 more with zero ancestor-symlink
awareness, grouped into three classes below. All three real, unmocked,
reproduced directly against update_template.py's own functions
(2026-08-15) -- no golden-only mutation assumed.

CLASS F12 -- BACKUP EXFILTRATION (asserted separately from F13/F14
because it is a materially different primitive: not a delivery-write
that lands attacker content at an attacker path, but a REDIRECT of the
user's EXISTING, legitimate file content to an attacker-chosen location
via `backup_path = backup_dir / dst` at three sites
(_sync_file_with_guard, merge_line_union, merge_json_deep). dst_file
itself can be entirely clean -- no symlink anywhere in ITS ancestor
chain, passing F10's own check with room to spare -- while backup_dir
(created fresh by the script itself under the fixed, predictable
.agent/memory/scratch/ prefix) has an attacker-planted symlink at the
exact component backup_dir/dst walks through. F10's fix at dst_file's
ancestor chain does nothing for this: the vulnerable expression is
backup_path's chain, never checked at all. This survives even if EVERY
delivery path from F10 is perfectly fixed, because the write here is to
backup_path, not dst_file. Confirmed against all 3 real backup sites:
_sync_file_with_guard (~line 281), merge_json_deep (~line 514).
merge_line_union (~line 453) is byte-identical code shape to
merge_json_deep's backup construction, sharing the same missing check.

CLASS F13 -- FIXED WORKSPACE-RELATIVE PATH WRITES with zero symlink
check: update_profile_version() (.agent/version, profile.json),
write_template_state() (.agent/.template_state), save_template_baselines
() (the baseline store itself). Narrower blast radius than F12 -- an
attacker must plant a symlink at one of these exact, fixed paths ahead
of time, not an arbitrary manifest-driven one -- but the same missing
pattern; save_template_baselines()'s corruption in particular degrades
only to F5's no-baseline safe default rather than arbitrary content, so
it is lower severity than the version/state files but still asserted.

CLASS F14 -- backup_dir ROOT creation, both call sites (main(),
cmd_reconcile_from_history()): `Path(f".agent/memory/scratch/...-{ts}")
.mkdir(parents=True, exist_ok=True)` with no check on
.agent/memory/scratch's own ancestor chain. Lowest severity here (the
timestamped leaf component is unpredictable) but .agent/memory/scratch
itself is a fixed, predictable, symlinkable path an attacker can plant
ahead of any run.

F14 ROWS EXERCISE THE REAL ENTRY POINTS, NOT AN INLINED COPY OF THE
VULNERABLE LINE (self-caught defect, corrected 2026-08-15): an earlier
draft of these two rows constructed their own local backup_dir Path and
called `.mkdir(parents=True, exist_ok=True)` directly inside the test
body, which asserts a property of Python's stdlib (mkdir always follows
a symlinked ancestor) rather than a property of this codebase --
un-fixable by any change to update_template.py, and un-catchable if the
real code were already correct. Fixed by invoking the REAL entry points
end-to-end: row_f14a runs `execution/update_template.py --apply` as a
real subprocess against a fixture with .agent/memory/scratch
pre-symlinked, and asserts the semantics main()'s own author (@dev)
already established for this failure mode -- the WHOLE RUN aborts
(nonzero exit, zero delivery, nothing created under the symlink target)
rather than proceeding without backup protection, since every other
guard's assumption (a backup exists before an overwrite) would silently
break otherwise. row_f14b calls cmd_reconcile_from_history() directly
in-process (network-touching helpers monkeypatched to local tmpdirs,
identical pattern to F15's fixture) against the same symlinked-scratch
fixture, and asserts the DIFFERENT semantics that call site already
establishes -- delivery for this run DEGRADES TO DEFERRED (baseline
handling continues, run completes with rc=0, nothing is delivered or
exfiltrated) rather than aborting mid-reconciliation, consistent with
the existing "delivery deferred: current live tree unavailable this
run" degrade pattern already in that function for a different failure
cause (no live tree available). Both rows are satisfied by
`_create_guarded_backup_dir(prefix: str) -> Path`, the single shared
helper @dev is implementing for both call sites (raises
`BackupDirRefused` when the constructed backup directory's ancestor
chain contains a symlink; main() catches it and aborts the run,
cmd_reconcile_from_history() catches it and defers delivery) -- named
here for context on how the two call sites are expected to converge,
but neither row asserts against that helper directly by name: asserting
only the OBSERVABLE behavior of the real entry points means a helper
that exists but is not actually wired into both call sites still fails
these rows, which a name/signature-only check would not catch.

Mutation table (each row must independently flip this script's exit
code):
  M1: fix F12's _sync_file_with_guard backup site only, leave
      merge_json_deep/merge_line_union's backup sites unguarded -> ROW
      F12b still fails.
  M2: fix all three F12 backup sites but not F13's three fixed-path
      writes -> ROWS F13a/b/c still fail independently.
  M3: fix F13 but not F14 -> ROWS F14a/b still fail. Implementing
      _create_guarded_backup_dir() but wiring it into only ONE of the
      two call sites reopens exactly one of F14a/F14b while the other
      falsely appears fixed -- this is why both call sites are asserted
      independently in one run, same reasoning as contract-f5's A1.
  M4: add an ancestor-symlink check to dst_file/dst (F10's own scope)
      without ever touching backup_path's construction -> gives a false
      sense of completeness; this script's F12 rows must still catch it
      because they plant the symlink inside backup_dir, never on dst.
  M5: implement _create_guarded_backup_dir() but have main() swallow
      BackupDirRefused and continue the run anyway (proceeding without
      backup protection instead of aborting) -> ROW F14a's returncode==0
      check still fails even though the helper itself works correctly in
      isolation -- proving this row checks main()'s actual handling of
      the exception, not merely the helper's existence.
"""
import contextlib
import hashlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path.cwd()
UPDATE_TEMPLATE_SCRIPT = REPO_ROOT / "execution" / "update_template.py"

sys.path.insert(0, "execution")
import update_template as ut  # noqa: E402


def _isolated(fn):
    """Run fn() inside a fresh tmp workspace with cwd set to it (matching
    the real call sites' stop_at=Path.cwd() / relative TEMPLATE_BASELINES_PATH
    default), then clean up."""
    work = Path(tempfile.mkdtemp()).resolve()
    old_cwd = os.getcwd()
    try:
        os.chdir(work)
        return fn(work)
    finally:
        os.chdir(old_cwd)
        shutil.rmtree(work, ignore_errors=True)


def row_f12a_sync_file_with_guard_backup():
    def body(work):
        backup_dir = Path("backup")
        backup_dir.mkdir()
        src = Path("incoming.txt")
        src.write_text("NEW CANONICAL CONTENT")
        dst = Path("attacker") / "controlled" / "dst.txt"
        dst.parent.mkdir(parents=True)
        dst.write_text("USER SECRET CONTENT")
        assert ut._contains_symlink_component(dst, stop_at=Path.cwd()) == (False, None), \
            "test fixture invalid: dst must itself be a CLEAN path (no symlink), " \
            "isolating this from F10's already-fixed dst_file check"
        baseline_key = "attacker/controlled/dst.txt"
        ut.save_template_baselines({baseline_key: hashlib.sha256(b"USER SECRET CONTENT").hexdigest()})
        exfil_target = Path("exfil_dropzone")
        exfil_target.mkdir()
        (backup_dir / "attacker").symlink_to(exfil_target.resolve())
        ut._sync_file_with_guard(src, dst, backup_dir, baseline_key, force=False)
        landed = exfil_target / "controlled" / "dst.txt"
        return landed.exists() and landed.read_text() == "USER SECRET CONTENT"
    return _isolated(body)


def row_f12b_merge_json_deep_backup():
    def body(work):
        backup_dir = Path("backup")
        backup_dir.mkdir()
        src = Path("incoming.json")
        src.write_text('{"new_key": "new_val"}')
        dst = Path("attacker") / "controlled" / "dst.json"
        dst.parent.mkdir(parents=True)
        dst.write_text('{"secret": "USER SECRET CONTENT"}')
        exfil_target = Path("exfil_dropzone")
        exfil_target.mkdir()
        (backup_dir / "attacker").symlink_to(exfil_target.resolve())
        ut.merge_json_deep(src, dst, backup_dir)
        landed = exfil_target / "controlled" / "dst.json"
        return landed.exists() and "USER SECRET CONTENT" in landed.read_text()
    return _isolated(body)


def row_f12c_merge_line_union_backup():
    def body(work):
        backup_dir = Path("backup")
        backup_dir.mkdir()
        src = Path("incoming.txt")
        src.write_text("new line from upstream")
        dst = Path("attacker") / "controlled" / "dst.txt"
        dst.parent.mkdir(parents=True)
        dst.write_text("USER SECRET LINE")
        exfil_target = Path("exfil_dropzone")
        exfil_target.mkdir()
        (backup_dir / "attacker").symlink_to(exfil_target.resolve())
        ut.merge_line_union(src, dst, backup_dir)
        landed = exfil_target / "controlled" / "dst.txt"
        return landed.exists() and "USER SECRET LINE" in landed.read_text()
    return _isolated(body)


def row_f13a_update_profile_version():
    def body(work):
        source = Path("source")
        (source / ".agent").mkdir(parents=True)
        (source / ".agent" / "version").write_text("9.9.9")
        (Path(".agent")).mkdir(exist_ok=True)
        outside = Path("..") / "outside_target.txt"
        outside = outside.resolve()
        outside.write_text("SENTINEL")
        version_link = Path(".agent") / "version"
        version_link.symlink_to(outside)
        profile_path = Path(".agent") / "profile.json"
        profile_path.write_text('{"template_version": "1.0.0"}')
        ut.update_profile_version(source, profile_path)
        return outside.read_text() != "SENTINEL"
    return _isolated(body)


def row_f13b_write_template_state():
    def body(work):
        source = Path("source")
        (source / ".agent").mkdir(parents=True)
        (source / ".agent" / "version").write_text("9.9.9")
        outside = (Path("..") / "outside_state.json").resolve()
        outside.write_text("SENTINEL")
        state_link = Path(".template_state")
        state_link.symlink_to(outside)
        ut.write_template_state(source, state_link)
        return outside.read_text() != "SENTINEL"
    return _isolated(body)


def row_f13c_save_template_baselines():
    def body(work):
        outside = (Path("..") / "outside_baselines.json").resolve()
        outside.write_text("SENTINEL")
        store_link = Path("template_baselines.json")
        store_link.symlink_to(outside)
        ut.save_template_baselines({"foo": "bar"}, store_link)
        return outside.read_text() != "SENTINEL"
    return _isolated(body)


def row_f14a_main_apply_backup_dir_abort():
    """Real end-to-end invocation: `execution/update_template.py --apply`
    as an actual subprocess against a fixture whose .agent/memory/scratch
    is pre-symlinked to an external directory. main()'s own established
    semantics (per @dev, backing _create_guarded_backup_dir /
    BackupDirRefused): the WHOLE RUN must abort before any HARNESS
    delivery happens -- proceeding without backup protection would break
    every other guard's assumption that a backup exists before an
    overwrite. VIOLATION (returns True) if the run reports success, if
    the manifest's HARNESS entry got delivered anyway, or if anything
    landed under the symlink's external target."""
    def body(work):
        (Path(".agent") / "memory").mkdir(parents=True)
        exfil_target = Path("exfil_scratch_dropzone").resolve()
        exfil_target.mkdir()
        Path(".agent/memory/scratch").symlink_to(exfil_target)

        (Path(".agent") / "update-manifest.yaml").write_text(
            "paths:\n  - path: delivered.txt\n    category: HARNESS\n"
        )
        src_upstream = Path("src_upstream")
        src_upstream.mkdir()
        (src_upstream / "delivered.txt").write_text("NEW CONTENT")

        proc = subprocess.run(
            [sys.executable, str(UPDATE_TEMPLATE_SCRIPT), "--apply", "--source", "src_upstream"],
            cwd=str(work), capture_output=True, text=True, timeout=60,
        )
        delivered = Path("delivered.txt")
        exfiltrated = bool(list(exfil_target.iterdir()))
        aborted = proc.returncode != 0
        violation = delivered.exists() or exfiltrated or not aborted
        if violation:
            print(f"    [F14a detail] returncode={proc.returncode} delivered={delivered.exists()} "
                  f"exfiltrated={exfiltrated}")
        return violation
    return _isolated(body)


def row_f14b_reconcile_backup_dir_deferred():
    """Real end-to-end invocation: cmd_reconcile_from_history() called
    directly in-process (only the two gh-touching helpers monkeypatched
    to local tmpdirs -- identical pattern to
    verify_reconciliation_guarantees.py's fixture, everything else real)
    against a fixture whose .agent/memory/scratch is pre-symlinked.
    cmd_reconcile_from_history()'s own established semantics DIFFER from
    main()'s: delivery for this run DEGRADES TO DEFERRED rather than
    aborting mid-reconciliation (the same degrade shape already used
    when the live tree is unavailable). VIOLATION (returns True) if the
    file actually got delivered this run, if anything landed under the
    symlink's external target, or if the run crashed (rc != 0) instead
    of completing with delivery deferred."""
    def body(work):
        Path("stale.txt").write_text("OLD CONTENT")
        Path(".agent").mkdir(parents=True, exist_ok=True)
        Path(".agent/.template_state").write_text(json.dumps({"template_version": "1.2.3"}))

        old_tree = work / "old_tree"
        new_tree = work / "new_tree"
        old_tree.mkdir()
        new_tree.mkdir()
        (old_tree / "stale.txt").write_text("OLD CONTENT")
        (new_tree / "stale.txt").write_text("BRAND NEW CONTENT FROM UPSTREAM")

        ut._read_recorded_template_version = lambda: "1.2.3"
        ut._resolve_version_to_commit = lambda version, repo=ut.ATHANOR_REPO: "deadbeef"
        ut._fetch_historical_tree = lambda sha, tmpdir: (
            shutil.copytree(old_tree, tmpdir, dirs_exist_ok=True), True)[1]
        ut.fetch_latest_from_github = lambda tmpdir: (
            shutil.copytree(new_tree, tmpdir, dirs_exist_ok=True), True)[1]

        (Path(".agent") / "memory").mkdir(parents=True, exist_ok=True)
        exfil_target = Path("exfil_scratch_dropzone_reconcile").resolve()
        exfil_target.mkdir()
        Path(".agent/memory/scratch").symlink_to(exfil_target)

        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            rc = ut.cmd_reconcile_from_history(["stale.txt"])

        delivered = Path("stale.txt").read_text() == "BRAND NEW CONTENT FROM UPSTREAM"
        exfiltrated = bool(list(exfil_target.iterdir()))
        crashed = rc != 0
        violation = delivered or exfiltrated or crashed
        if violation:
            print(f"    [F14b detail] rc={rc} delivered={delivered} exfiltrated={exfiltrated}")
        return violation
    return _isolated(body)


def main() -> int:
    rows = [
        ("F12a: _sync_file_with_guard backup exfiltration", row_f12a_sync_file_with_guard_backup),
        ("F12b: merge_json_deep backup exfiltration", row_f12b_merge_json_deep_backup),
        ("F12c: merge_line_union backup exfiltration", row_f12c_merge_line_union_backup),
        ("F13a: update_profile_version fixed-path write", row_f13a_update_profile_version),
        ("F13b: write_template_state fixed-path write", row_f13b_write_template_state),
        ("F13c: save_template_baselines fixed-path write", row_f13c_save_template_baselines),
        ("F14a: main() --apply aborts whole run on symlinked backup_dir ancestor", row_f14a_main_apply_backup_dir_abort),
        ("F14b: cmd_reconcile_from_history defers delivery on symlinked backup_dir ancestor", row_f14b_reconcile_backup_dir_deferred),
    ]

    failures = []
    for name, fn in rows:
        vulnerable = fn()
        status = "VULNERABLE" if vulnerable else "safe"
        print(f"[{name}] {status}")
        if vulnerable:
            failures.append(name)

    print()
    if failures:
        print(f"FAIL — {len(failures)} unguarded write site(s):")
        for f in failures:
            print(f"  {f}")
        return 1
    print("OK — all 8 write sites refuse to write through a planted symlink.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
