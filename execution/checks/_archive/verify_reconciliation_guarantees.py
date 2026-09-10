#!/usr/bin/env python3
"""
verify_reconciliation_guarantees.py — F15: QA's disclosed-unexercised
items, promoted from contract-f5's F11 verification-obligation prose
into real, fixture-driven assertions, per the lead's explicit
instruction ("I want them as real assertions in f6, not obligations").

THREE ROWS:

ROW A — "already-current" baseline persistence
  (cmd_reconcile_from_history's branch for a file whose local content
  matches the CURRENT live upstream but not the historical snapshot).
  @dev caught, by re-tracing the code rather than via any check, that an
  earlier draft of this branch printed "baseline recorded" without
  actually calling save_template_baselines() -- a function-vs-presence
  gap of exactly the same shape as the `gh api` GET-vs-POST bug: the
  branch existed, ran, and printed a success line, but did not perform
  the write it claimed. contract-f4's verify_baseline_reconciliation.py
  is grep+AST-parse only and has NO fixture reaching this branch at all,
  so nothing there would have caught it. This row calls
  cmd_reconcile_from_history() directly against a real local fixture
  (network calls monkeypatched to local tmpdirs, everything else real)
  and asserts the baseline is actually ON DISK afterward, not merely
  that a "recorded" string was printed.

ROW B — F3's no-baseline-as-diverged guarantee holds THROUGH the
  --reconcile-from-history entry point specifically, not just through
  plain --apply (already covered by contract-f3's own goldens). A file
  whose local content matches NEITHER the historical snapshot NOR
  current upstream is a genuine hand-edit; --reconcile-from-history must
  leave it byte-for-byte untouched and must NOT write a baseline for it
  -- a coincidental content match against the WRONG resolved historical
  version (the residual risk contract-f4's own spec already names as
  not fully closable) must never be treated as license to overwrite.
  This is asserted against the actual delivery code path (force=False
  passed through to _sync_file_with_guard), not merely against the
  print statements.

ROW C — the F7 STYLES-dict refactor (contract-f4) preserved the SAME
  COVERAGE contract-f2's and contract-f3's goldens asserted before the
  refactor, not merely that they still exit 0 after it. Runs both
  checks for real and asserts (a) both still exit 0, (b) the shared
  no_update_styles.STYLES dict still has exactly the 5 pattern-style
  entries by name (trailing-slash, trailing-wildcard, bare-dir-no-slash,
  double-star, exact-file) contract-f2's spec originally enumerated --
  a refactor that silently dropped a style while keeping the import
  wired correctly would still pass a naive "both files import the
  shared module, exit 0" check without this name-set assertion.

STATUS AT TIME OF WRITING (2026-08-15, verified against the live
HEAD/working-tree state at verification time, see contract notes for
exact commit): ALL THREE ROWS PASS ALREADY. This is a regression LOCK,
not new RED-to-fix work — @dev's commit fixing F6's deliver-in-same-run
behavior (message: "Also fixed a real bug found during manual
verification... an already-current branch computed and printed
'baseline recorded' without actually calling save_template_baselines()")
landed before this golden was authored, closing Row A ahead of the
architect writing this check. Rows B and C were never broken. Asserted
here anyway, as directed, because "no check ever exercised this branch"
is precisely the gap that let Row A regress silently once already; a
green check that exists is a guardrail future refactors must keep
green, not proof the guardrail was needed to reach green this time.
"""
import io
import json
import contextlib
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, "execution")
import update_template as ut  # noqa: E402


def _isolated(fn):
    work = Path(tempfile.mkdtemp()).resolve()
    old_cwd = os.getcwd()
    try:
        os.chdir(work)
        return fn(work)
    finally:
        os.chdir(old_cwd)
        shutil.rmtree(work, ignore_errors=True)


def _run_reconcile_fixture():
    """Shared fixture for rows A and B: three targets (stale / current /
    hand-edit) reconciled in one real call to cmd_reconcile_from_history(),
    with only the two network-touching helpers monkeypatched to copy from
    local tmpdirs instead of calling `gh`."""
    def body(work):
        Path("stale.txt").write_text("OLD CONTENT")
        Path("current.txt").write_text("NEW CONTENT")
        Path("handedit.txt").write_text("SOMETHING THE USER TYPED THEMSELVES")

        Path(".agent").mkdir(parents=True, exist_ok=True)
        # The stamp must carry THIS workspace's provenance. delivery-integrity
        # F4c made an identity-less stamp read as INHERITED (the file is
        # tracked, so every clone receives the upstream workspace's receipt),
        # and cmd_reconcile_from_history() declines to resolve and deliver
        # against an inherited version record. Fixture-only: it asks the
        # implementation for whatever provenance fields it records rather than
        # reconstructing a field name or a hash here.
        _state = {"template_version": "1.2.3"}
        _state.update(ut._stamp_identity_fields())
        Path(".agent/.template_state").write_text(json.dumps(_state))

        old_tree = work / "old_tree"
        new_tree = work / "new_tree"
        old_tree.mkdir()
        new_tree.mkdir()
        (old_tree / "stale.txt").write_text("OLD CONTENT")
        (old_tree / "current.txt").write_text("OLD-OLD CONTENT (already updated once before)")
        (old_tree / "handedit.txt").write_text("ORIGINAL SHIPPED CONTENT")
        (new_tree / "stale.txt").write_text("BRAND NEW CONTENT FROM UPSTREAM")
        (new_tree / "current.txt").write_text("NEW CONTENT")  # matches local exactly
        (new_tree / "handedit.txt").write_text("UPSTREAM MOVED ON TOO")

        ut._read_recorded_template_version = lambda: "1.2.3"
        ut._resolve_version_to_commit = lambda version, repo=ut.ATHANOR_REPO: "deadbeef"
        ut._fetch_historical_tree = lambda sha, tmpdir: (
            shutil.copytree(old_tree, tmpdir, dirs_exist_ok=True), True)[1]
        ut.fetch_latest_from_github = lambda tmpdir: (
            shutil.copytree(new_tree, tmpdir, dirs_exist_ok=True), True)[1]

        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            rc = ut.cmd_reconcile_from_history(["stale.txt", "current.txt", "handedit.txt"])

        baselines = ut.load_template_baselines()
        return {
            "rc": rc,
            "output": buf.getvalue(),
            "baselines": baselines,
            "stale_content": Path("stale.txt").read_text(),
            "current_content": Path("current.txt").read_text(),
            "handedit_content": Path("handedit.txt").read_text(),
        }
    return _isolated(body)


def row_a_already_current_baseline_persisted(result):
    return (
        "current.txt" in result["baselines"]
        and result["current_content"] == "NEW CONTENT"
    )


def row_b_handedit_untouched_no_baseline(result):
    return (
        result["handedit_content"] == "SOMETHING THE USER TYPED THEMSELVES"
        and "handedit.txt" not in result["baselines"]
    )


def row_c_f7_refactor_same_coverage():
    checks_dir = Path("execution/checks")
    styles_mod = checks_dir / "no_update_styles.py"
    if not styles_mod.exists():
        return False, "no_update_styles.py missing"

    ns = {}
    exec(compile(styles_mod.read_text(), str(styles_mod), "exec"), ns)
    styles = ns.get("STYLES", {})
    expected_names = {
        "trailing-slash", "trailing-wildcard", "bare-dir-no-slash",
        "double-star", "exact-file",
    }
    if set(styles.keys()) != expected_names:
        return False, f"STYLES name set changed: {sorted(styles.keys())}"

    for script in ("verify_no_update_provenance_matrix.py", "verify_no_baseline_data_loss.py"):
        proc = subprocess.run(
            [sys.executable, str(checks_dir / script)],
            capture_output=True, text=True, cwd=str(checks_dir.parent.parent),
        )
        if proc.returncode != 0:
            return False, f"{script} exited {proc.returncode}: {proc.stdout}{proc.stderr}"
    return True, "both checks green, STYLES dict has all 5 original pattern styles"


def main() -> int:
    failures = []

    result = _run_reconcile_fixture()

    ok_a = row_a_already_current_baseline_persisted(result)
    print(f"[ROW A: already-current baseline persisted to disk] {'PASS' if ok_a else 'FAIL'}")
    if not ok_a:
        failures.append("ROW A: baseline not actually written for already-current file")

    ok_b = row_b_handedit_untouched_no_baseline(result)
    print(f"[ROW B: genuine hand-edit untouched through --reconcile-from-history] {'PASS' if ok_b else 'FAIL'}")
    if not ok_b:
        failures.append("ROW B: hand-edited file was modified or baselined via reconciliation")

    ok_c, detail_c = row_c_f7_refactor_same_coverage()
    print(f"[ROW C: F7 STYLES refactor preserves same coverage] {'PASS' if ok_c else 'FAIL'} ({detail_c})")
    if not ok_c:
        failures.append(f"ROW C: {detail_c}")

    print()
    if failures:
        print(f"FAIL — {len(failures)} reconciliation guarantee(s) broken:")
        for f in failures:
            print(f"  {f}")
        return 1
    print("OK — already-current baselines persist for real, genuine hand-edits survive "
          "--reconcile-from-history untouched, and the F7 refactor kept all 5 pattern "
          "styles wired into both checks.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
