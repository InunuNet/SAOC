#!/usr/bin/env python3
"""
verify_edge_cases.py — F8: symlink / read-only / directory-mismatch edges
QA deferred out of contract-f3 (2026-08-15). Three scenarios, each
confirmed against current HEAD via the real CLI subprocess:

EDGE 1 — symlink at a HARNESS destination. Today's behavior is
ACCIDENTALLY safe in the one case tested (a symlinked file whose external
target's content differs from incoming, no baseline recorded -> F5's
guard fires because content differs, exactly like any other diverged
no-baseline file, so the write is never attempted). But `shutil.copy2()`
follows symlinks: the moment a legitimate row-C write IS attempted against
a HARNESS path that happens to be a symlink (local matches a recorded
baseline, incoming differs -- the exact case F5 is supposed to deliver
freely), the write goes THROUGH the symlink into whatever it points to,
which may be entirely outside the workspace (e.g. a symlink an operator
created pointing at a shared config, or, worst case, something like
~/.ssh/config if a HARNESS path were ever symlinked there by accident or
malice). This is not merely a staleness/data-loss question like F5 -- it
is a write-target-confusion / potential-escape question. Required
behavior: refuse to write through a symlink at a HARNESS destination path
by default (treat it the same as a permission failure -- WARN, skip, name
--force-path or an explicit override), never silently follow it.

EDGE 2 — read-only destination file. Already handled better than
expected: a PermissionError during a legitimate write is caught by the
per-entry try/except in main()'s manifest loop and reported as "WARN
entry '...' failed: ... — continuing" (confirmed, current HEAD). BUT the
same false-success shape this whole mission exists to eliminate recurs
here: the run's summary still prints a bumped template_version even
though this specific file's legitimate update failed to apply. Required
behavior: the Summary block (already required by contract-f1's F1 to
cross-reference paths_skipped with any version-bump line) must also
surface entries that failed with a Python exception mid-copy, not only
entries the manifest-category dispatch explicitly chose to skip.

EDGE 3 — directory/file manifest mismatch (a HARNESS manifest entry says
`path: .agent/skills/` but the workspace has a plain FILE named
`.agent/skills`, not a directory). CONFIRMED CRASH, current HEAD, real
CLI: an uncaught `FileExistsError` in `apply_fresh_manifest_backstop()`
(`.mkdir(parents=True, exist_ok=True)` on a path where a same-named FILE
already exists) propagates all the way out of main(), producing a raw
Python traceback and a nonzero exit with no WARN naming the actual
problem. This does NOT bump the version (the crash happens before
update_profile_version() runs, so no false-success is created) but it
violates the "one bad manifest entry must never abort the whole run"
principle the main manifest loop already implements via its own
try/except -- apply_fresh_manifest_backstop() is called OUTSIDE that
protection. Required behavior: wrap this call (and any other post-loop
backstop call) in the same isolate-and-continue pattern, with a WARN
naming the specific path and the specific mismatch (not a stack trace).

Exercised via the real CLI subprocess against current HEAD, no mocking.
"""
import json
import os
import shutil
import stat
import subprocess
import sys
from pathlib import Path

UPDATE_TEMPLATE = Path("execution/update_template.py").resolve()
SANDBOX = Path("/tmp/verify_edge_cases_sandbox")


def _write(p: Path, content: str):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)


def base_ws(name):
    ws = SANDBOX / f"ws_{name}"
    up = SANDBOX / f"up_{name}"
    shutil.rmtree(ws, ignore_errors=True)
    shutil.rmtree(up, ignore_errors=True)
    _write(ws / "WORKSPACE", "TestWorkspace\n")
    _write(ws / ".agent/update-manifest.yaml", "paths:\n  - category: HARNESS\n    path: .agent/skills/\n")
    _write(ws / ".agent/profile.json", json.dumps({"project_name": "test", "template_version": "1.0.0"}))
    _write(ws / ".agent/version", "1.0.0\n")
    return ws, up


def run(ws, up):
    # stderr=STDOUT for TRUE chronological interleaving -- capturing the two
    # streams separately and concatenating them after the fact (stdout +
    # stderr) reorders a stderr WARN to always appear "after" a later stdout
    # Summary block regardless of when it actually printed, which would make
    # EDGE 2's check pass for the wrong reason (a stream-capture artifact,
    # not a real design property). Caught this via a direct debug run before
    # trusting the first pass.
    r = subprocess.run(
        [sys.executable, str(UPDATE_TEMPLATE), "--apply", "--source", str(up)],
        cwd=ws, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=30,
    )
    return r.returncode, r.stdout


def main() -> int:
    failures = []

    # EDGE 3: directory/file manifest mismatch must not crash uncaught.
    ws3, up3 = base_ws("dirmismatch")
    _write(up3 / ".agent/skills/baz.py", "incoming\n")
    _write(up3 / ".agent/version", "2.0.0\n")
    (ws3 / ".agent").mkdir(parents=True, exist_ok=True)
    _write(ws3 / ".agent/skills", "I am a FILE named skills, not a directory\n")
    rc3, out3 = run(ws3, up3)
    crashed = "Traceback (most recent call last)" in out3
    print(f"[EDGE 3: dir/file mismatch] exit={rc3} raw_traceback_leaked={crashed}")
    if crashed:
        failures.append("EDGE 3: uncaught exception (raw traceback) on a directory/file manifest mismatch — must be an isolated WARN instead")
    shutil.rmtree(ws3, ignore_errors=True)
    shutil.rmtree(up3, ignore_errors=True)

    # EDGE 2: read-only file's failed write must be cross-referenced in the
    # Summary, not just an earlier easy-to-miss WARN line while the run
    # still claims a full version bump.
    import hashlib
    ws2, up2 = base_ws("readonly")
    _write(up2 / ".agent/skills/qux.py", "upstream v2\n")
    _write(up2 / ".agent/version", "2.0.0\n")
    old_content = "upstream v1\n"
    _write(ws2 / ".agent/skills/qux.py", old_content)
    _write(ws2 / ".agent/memory/scratch/template_baselines.json",
           json.dumps({".agent/skills/qux.py": hashlib.sha256(old_content.encode()).hexdigest()}))
    os.chmod(ws2 / ".agent/skills/qux.py", stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)
    rc2, out2 = run(ws2, up2)
    version_bumped = "template_version: 1.0.0 → 2.0.0" in out2 or "template_version: 1.0.0 -> 2.0.0" in out2
    failure_in_summary = False
    if "Summary:" in out2:
        summary_block = out2.split("Summary:")[-1]
        failure_in_summary = "qux.py" in summary_block or "failed" in summary_block.lower()
    print(f"[EDGE 2: read-only legit update] exit={rc2} version_bumped={version_bumped} failure_named_in_summary={failure_in_summary}")
    os.chmod(ws2 / ".agent/skills/qux.py", stat.S_IRUSR | stat.S_IWUSR)
    if version_bumped and not failure_in_summary:
        failures.append("EDGE 2: template_version bumped in the same run a legitimate write failed with Permission denied, and the Summary block does not name the failure")
    shutil.rmtree(ws2, ignore_errors=True)
    shutil.rmtree(up2, ignore_errors=True)

    # EDGE 1: symlink at destination must never be written through when a
    # legitimate (baseline-matches, incoming-differs) update is attempted.
    ws1, up1 = base_ws("symlink")
    _write(up1 / ".agent/skills/foo.py", "upstream v2 -- should never land here\n")
    _write(up1 / ".agent/version", "2.0.0\n")
    (ws1 / ".agent/skills").mkdir(parents=True, exist_ok=True)
    outside_target = ws1 / "OUTSIDE_workspace_sensitive.txt"
    outside_target.write_text("upstream v1\n")  # matches a recorded baseline below
    (ws1 / ".agent/skills/foo.py").symlink_to(outside_target)
    _write(ws1 / ".agent/memory/scratch/template_baselines.json",
           json.dumps({".agent/skills/foo.py": hashlib.sha256(b"upstream v1\n").hexdigest()}))
    rc1, out1 = run(ws1, up1)
    link_path = ws1 / ".agent/skills/foo.py"
    still_symlink = link_path.is_symlink()
    outside_content = outside_target.read_text()
    written_through = outside_content != "upstream v1\n"
    print(f"[EDGE 1: symlink, legit-update path] exit={rc1} still_symlink={still_symlink} written_through_symlink={written_through}")
    if written_through:
        failures.append(
            "EDGE 1: a legitimate row-C update wrote THROUGH a symlinked HARNESS "
            "destination into its external target, unguarded -- must refuse by "
            "default (WARN + skip, same treatment as a permission failure)"
        )
    shutil.rmtree(ws1, ignore_errors=True)
    shutil.rmtree(up1, ignore_errors=True)

    shutil.rmtree(SANDBOX, ignore_errors=True)

    if failures:
        print(f"\nFAIL — {len(failures)} violation(s):")
        for f in failures:
            print(f"  {f}")
        return 1

    print("\nOK — symlink writes refused, read-only failures surfaced in Summary, directory/file mismatch isolated (no raw traceback).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
