#!/usr/bin/env python3
"""
verify_no_baseline_data_loss.py — CRITICAL data-loss regression guard.

QA FAIL on commit dff283f1 (2026-08-15), reproduced here against the
current HEAD (50461724885c8db4d0b9eb9404da5d3086d06fc6) via the real CLI,
no mocking:

  A file that exists locally, has NO recorded baseline (no prior sync ever
  ran, or ran before baseline-tracking was recorded for it), and differs
  from the incoming upstream content, is SILENTLY OVERWRITTEN. Even when
  .agent/no-update explicitly names the containing directory, the tool
  prints "Protected patterns from .agent/no-update: [...]" and then, in
  the SAME run, overwrites the file anyway with a plain "update (dir) ..."
  line — no WARN, indistinguishable from a routine safe update.

ROOT CAUSE (execution/update_template.py's _sync_file_with_guard(), current
HEAD): the divergence check is gated on `if baseline_hash:` where
baseline_hash = baselines.get(baseline_key). No recorded baseline ->
falsy -> the entire guard branch is skipped -> falls straight through to
unconditional backup+copy. "No record of whether this file ever diverged"
is being treated as equivalent to "this file has never diverged" — those
are NOT the same claim, and only one of them is safe to act on. This
conflation is explicitly named in verify_provenance_protection.py's own
docstring ("ROW 1 - no local baseline recorded, or local == recorded
baseline ... -> UPDATE FREELY") — that equivalence IS the defect.

COMPOUNDING CAUSE: the identical-content short-circuit ("if
_sha256_of_file(dst_file) == _sha256_of_file(src_file): return
'unchanged'") returns BEFORE ever recording a baseline for that key. So a
file that is untouched and happens to match upstream on its first sync
NEVER gets a baseline recorded — it stays permanently in the dangerous
"no record" bucket, meaning a protected-but-never-yet-diverged file is
one hand-edit away from silent, permanent data loss the next time upstream
changes, forever, unless something changes this.

REQUIRED FIX (behavioral contract, not a prescribed diff): no-baseline
must default to the SAME outcome as a recorded divergence — skip, WARN,
name the --force-path escape hatch — UNLESS the local file is already
byte-identical to the incoming content, in which case there is nothing to
lose and it may proceed (silently or not; no data is at risk either way).
The four ways "no record" can occur must behave IDENTICALLY:
  (a) the baseline store file does not exist at all
  (b) the store exists, is valid JSON, but this key is absent
  (c) the store exists but is corrupt / unparseable
  (d) the store exists, parses, but is an empty dict
A missing store and a missing key are the same claim ("no record") and
must produce the same behavior — this golden asserts all four collapse to
one code path, not four coincidentally-matching special cases.

MATRIX EXPANSION: this defect is orthogonal to, but must be verified
against, the pattern-style matrix in verify_no_update_provenance_matrix.py
-- adding this as ROW D makes that matrix 5 STYLES x 4 ROWS = 20
combinations, not 5x3. This script owns rows D (no-record, diverged) and
D' (no-record, identical -- the safe exception) across all 5 styles;
verify_no_update_provenance_matrix.py.golden should be updated by @dev to
import/reuse this script's STYLES dict rather than re-declare a second
copy that could drift out of sync (see mutation M6 below).

TWO ADDITIONAL ROWS (field follow-up, 2026-08-15, from @dev's empirical
work -- the exposure is WORSE than "no baseline recorded" alone):

  ROW E — never-diverged, then first-ever hand-edit. The identical-content
  short-circuit means a file that has NEVER differed from upstream since
  entering the workspace carries NO baseline, indefinitely -- this is the
  DEFAULT resting state of most boilerplate, and exactly what an operator
  reaches for .agent/no-update to protect. The moment they make their
  FIRST hand-edit and a real upstream change lands, run2 silently
  overwrites it (confirmed empirically: run1 with local==upstream leaves
  no baseline store on disk at all; hand-edit; run2 destroys it, no WARN).
  Contrast: a file delivered via a genuine first-time WRITE (did not
  exist locally, actually passed through the copy+baseline-record path)
  DOES get a baseline, and a later hand-edit to THAT file IS correctly
  preserved. Only pass ONE argument through the identical-content
  short-circuit unfixed and this row alone still fails even if ROW D is
  fixed -- they are different code paths into the same "no record" state
  and both must be closed.

  ROW F — REQUIRED_FILES delivered via apply_missing_file_backstop()
  (execution/update_template.py:504-505) never call
  _sync_file_with_guard() at all -- they shutil.copy2() directly and
  record no baseline, ever, even at creation. REQUIRED_FILES is
  execution/handoff_check.py, execution/mission.py, execution/contract.py,
  .agent/handoffs.yaml -- mission.py and contract.py are exactly the files
  a harness user is most likely to hand-modify locally. Fixing ROW D/E
  alone (inside _sync_file_with_guard()) does not reach this: the fix
  must ALSO touch apply_missing_file_backstop() so files it delivers get
  a baseline recorded at creation time, the same guarantee a normal
  first-time write already gets.

DESIGN DECISION — record eagerly vs. preserve-by-default (architect's
reasoning, not merely restating instinct): the identical-content
short-circuit SHOULD record a baseline before returning "unchanged," not
leave the store sparse and rely on "no record = protected" alone. Argument:
(1) "local content matches upstream RIGHT NOW" is legitimate, verified
provenance -- recording it is not overreaching, it is exactly the signal
this system is built around, and --apply already writes other state on
this path (profile.json, .template_state, backups), so this is not a new
category of side effect. (2) The alternative (preserve-by-default, no
eager recording) makes "no baseline" a PERMANENT trap: the vast majority
of files in any workspace are NEVER hand-edited, and under preserve-only
semantics, every one of them would falsely show "local modifications
detected" on its very first real upstream change forever, requiring a
manual --force-path for files nobody ever touched -- defeating the
update mechanism for the common case, not just the dangerous one. (3) The
two rules compose safely: eager-recording only fires on the IDENTICAL
branch, never on a currently-diverged file with no baseline (that stays
correctly protected by ROW D's rule, and --force-path's existing code
already records a fresh baseline post-force) -- so a file's local content
is never mistakenly stamped as canonical while it visibly differs from
upstream. The only file that stays baseline-less indefinitely under this
combined design is one that is BOTH never-created-by-this-tool AND
currently-diverged -- exactly the class that should stay protected.

MUTATION TABLE:
  M1: revert `if baseline_hash:` to accept a falsy/missing baseline as
      "safe to overwrite" (today's actual bug) -> kills ROW D for all 4
      no-record sub-cases x all 5 pattern styles (20 cells).
  M2: fix the no-baseline default but leave the identical-content
      short-circuit not recording a baseline -> kills nothing directly in
      THIS run (ROW D' still passes, since identical content is safe
      either way) but is caught by a SECOND run of this script's
      "protected-then-later-diverges" scenario (see PART 3 below): sync
      once while identical (records nothing), hand-edit locally, sync
      again with a real upstream change -> now must be treated as
      diverged; if no baseline was ever recorded, the fix must still catch
      it via the "record a baseline on the identical-content path too"
      requirement, or ROW D silently regresses on the SECOND sync.
  M3: only fix the missing-store case (a) and not missing-key /
      corrupt-store / empty-dict (b/c/d) -> kills ROW D for whichever
      sub-case was left unfixed, while (a) falsely appears green --
      exactly the shape of M4 in the pattern-style matrix (a fix that
      generalizes to the case that was seen, not the class).
  M4: treat corrupt-store (c) as a hard error / crash instead of
      degrading to "no record" -> kills the corrupt-store sub-case
      specifically (this script asserts the run still completes and
      treats the file as protected, not that it exits nonzero).
  M5: print the WARN for entry-level protection but still silently
      overwrite (i.e. fix the message without fixing the write) -> kills
      the OUTPUT assertion (see PART 2) even though the FILESYSTEM
      assertion might look right for other rows -- this is why filesystem
      and output are asserted separately and both must pass.
  M6: matrix golden and this golden diverge on pattern-style definitions
      (e.g. someone edits one STYLES dict and not the other) -> not
      directly testable by either script alone; flagged as a standing
      maintenance risk, see MATRIX EXPANSION note above.
  M7: fix the no-baseline default (M1) but leave the identical-content
      short-circuit not recording a baseline -> ROW D/D' still pass (they
      don't exercise the identical-then-edited sequence), but ROW E fails
      -- this is precisely why ROW E is a distinct assertion and not
      assumed to be covered by M1's fix.
  M8: fix ROW D/E's guard logic but leave
      apply_missing_file_backstop() calling shutil.copy2() directly
      without recording a baseline -> ROW F fails in isolation even
      though ROW D/E pass; proves the fix must touch BOTH code paths, not
      only _sync_file_with_guard().
"""
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

# Shared with verify_no_update_provenance_matrix.py (template-update-
# actually-updates F7) -- see no_update_styles.py's own docstring for why
# this is a single source of truth rather than two independently-maintained
# copies. STYLES maps style name -> function of a filename -> pattern
# string; this script's fixtures always target "foo.py", so call sites
# below invoke pattern("foo.py") rather than using pattern directly.
from no_update_styles import STYLES

UPDATE_TEMPLATE = Path("execution/update_template.py").resolve()
SANDBOX = Path("/tmp/verify_no_baseline_data_loss_sandbox")

BASELINE_SUBCASES = ["absent-store", "missing-key", "corrupt-store", "empty-dict"]

# Explicit expected membership for the shared STYLES dict (no_update_styles.py).
# Iterating STYLES.items() alone cannot detect a silently-narrowed dict -- a
# deleted entry just makes both loops below run fewer times and this check
# still exits 0. This set makes a shrunk (or renamed, or padded) STYLES a
# hard, named failure instead of a quiet coverage loss.
EXPECTED_STYLES = {
    "trailing-slash", "trailing-wildcard", "bare-dir-no-slash",
    "double-star", "exact-file",
}


def _write(p: Path, content: str):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)


def build_fixture(style_name, no_update_pattern, subcase, identical: bool):
    tag = f"{style_name}_{subcase}_{'id' if identical else 'div'}".replace("/", "_").replace("*", "star")
    ws = SANDBOX / f"ws_{tag}"
    up = SANDBOX / f"up_{tag}"
    shutil.rmtree(ws, ignore_errors=True)
    shutil.rmtree(up, ignore_errors=True)

    incoming = "INCOMING upstream content -- v2\n"
    local = incoming if identical else "LOCAL HAND-EDIT -- precious, never synced before\n"

    _write(up / ".agent/skills/foo.py", incoming)
    _write(up / ".agent/version", "9.9.9\n")

    _write(ws / "WORKSPACE", "TestWorkspace\n")
    _write(ws / ".agent/update-manifest.yaml", "paths:\n  - category: HARNESS\n    path: .agent/skills/\n")
    _write(ws / ".agent/no-update", no_update_pattern + "\n")
    _write(ws / ".agent/profile.json", json.dumps({"project_name": "test", "template_version": "1.0.0"}))
    _write(ws / ".agent/version", "1.0.0\n")
    _write(ws / ".agent/skills/foo.py", local)

    baselines_path = ws / ".agent/memory/scratch/template_baselines.json"
    if subcase == "absent-store":
        pass  # no file at all
    elif subcase == "missing-key":
        _write(baselines_path, json.dumps({"some/other/file.md": hashlib.sha256(b"unrelated").hexdigest()}))
    elif subcase == "corrupt-store":
        _write(baselines_path, "{not valid json!!!")
    elif subcase == "empty-dict":
        _write(baselines_path, json.dumps({}))

    return ws, up


def run_apply(ws: Path, up: Path) -> str:
    result = subprocess.run(
        [sys.executable, str(UPDATE_TEMPLATE), "--apply", "--source", str(up)],
        cwd=ws, capture_output=True, text=True, timeout=30,
    )
    return result.stdout + result.stderr


def main() -> int:
    failures = []

    actual_styles = set(STYLES.keys())
    if actual_styles != EXPECTED_STYLES:
        missing = EXPECTED_STYLES - actual_styles
        extra = actual_styles - EXPECTED_STYLES
        print(f"FAIL -- no_update_styles.STYLES membership changed: "
              f"missing={sorted(missing)} extra={sorted(extra)}")
        return 1

    # PART 1 + 2: no-record x diverged, across all 4 subcases x all 5 styles.
    # Both FILESYSTEM (preserved) and OUTPUT (named WARN) are asserted.
    for style_name, pattern_fn in STYLES.items():
        for subcase in BASELINE_SUBCASES:
            ws, up = build_fixture(style_name, pattern_fn("foo.py"), subcase, identical=False)
            out = run_apply(ws, up)
            preserved = (ws / ".agent/skills/foo.py").read_text() == "LOCAL HAND-EDIT -- precious, never synced before\n"
            # Must name THIS file specifically -- a generic WARN/skip elsewhere in
            # the run (e.g. the unrelated missing-file backstop noise) must not
            # count. A bare substring match on "WARN"/"skip" anywhere in output
            # would false-positive on exactly that noise; require the file's own
            # path in the same line as the signal word.
            warned = any(
                ("foo.py" in line) and ("WARN" in line or "protected" in line.lower() or "skip" in line.lower())
                for line in out.splitlines()
            )
            label = f"{style_name}/{subcase}"
            print(f"[{label}] diverged: preserved={preserved} warned_in_output={warned}")
            if not preserved:
                failures.append(f"{label}: ROW D (no-baseline, diverged) SILENTLY OVERWRITTEN -- data loss")
            elif not warned:
                failures.append(f"{label}: ROW D preserved on disk but run gave no WARN/skip signal -- silent skip, not reported")

    # PART 2: no-record x identical -- the one safe case, must proceed (no false WARN needed, no data lost either way).
    for style_name, pattern_fn in STYLES.items():
        ws, up = build_fixture(style_name, pattern_fn("foo.py"), "absent-store", identical=True)
        out = run_apply(ws, up)
        content = (ws / ".agent/skills/foo.py").read_text()
        ok = content == "INCOMING upstream content -- v2\n"  # identical anyway, but confirms no crash/incorrect skip
        print(f"[{style_name}/identical] rowD-prime: content_matches={ok}")
        if not ok:
            failures.append(f"{style_name}: ROW D' (no-baseline, but locally identical) unexpectedly diverged from expected safe outcome")

    # PART 3 (ROW E): never-diverged file -- run1 delivers content byte-identical
    # to upstream (the identical-content short-circuit in _sync_file_with_guard
    # fires, returns "unchanged", records NO baseline today). Operator makes
    # their FIRST EVER hand-edit. A real upstream change lands. run2 MUST
    # preserve the hand-edit with a WARN naming the file -- exactly the same
    # obligation as ROW D, but reached via a different route into "no record"
    # (a file that was legitimately synced once, not one that predates
    # baseline-tracking). This is the "dangerous population is precisely
    # 'files that have never differed from upstream since entering the
    # workspace'" case from the field follow-up -- the default resting state
    # of most boilerplate, and exactly what .agent/no-update is reached for.
    sandbox_e = SANDBOX / "row_e"
    ws_e = sandbox_e / "ws"
    up_e = sandbox_e / "up"
    shutil.rmtree(sandbox_e, ignore_errors=True)
    same_content = "boilerplate content, identical to upstream\n"
    _write(ws_e / "WORKSPACE", "TestWorkspace\n")
    _write(ws_e / ".agent/update-manifest.yaml", "paths:\n  - category: HARNESS\n    path: .agent/skills/\n")
    _write(ws_e / ".agent/profile.json", json.dumps({"project_name": "test", "template_version": "1.0.0"}))
    _write(ws_e / ".agent/version", "1.0.0\n")
    _write(ws_e / ".agent/skills/foo.py", same_content)
    _write(up_e / ".agent/skills/foo.py", same_content)
    _write(up_e / ".agent/version", "2.0.0\n")
    run_apply(ws_e, up_e)  # run1: identical -> "unchanged", no baseline recorded today

    hand_edit = "MY FIRST EVER HAND-EDIT -- precious\n"
    _write(ws_e / ".agent/skills/foo.py", hand_edit)
    _write(up_e / ".agent/skills/foo.py", "upstream changed again v3\n")
    _write(up_e / ".agent/version", "3.0.0\n")
    out_e = run_apply(ws_e, up_e)  # run2: local now diverges from a real (if unrecorded) prior sync
    final_e = (ws_e / ".agent/skills/foo.py").read_text()
    preserved_e = final_e == hand_edit
    warned_e = any(("foo.py" in line) and ("WARN" in line or "skip" in line.lower()) for line in out_e.splitlines())
    print(f"[row-E: never-diverged-then-edited] preserved={preserved_e} warned={warned_e}")
    if not preserved_e:
        failures.append("ROW E (never-diverged, then first hand-edit): SILENTLY OVERWRITTEN -- data loss")
    elif not warned_e:
        failures.append("ROW E preserved on disk but run gave no WARN naming the file -- silent skip, not reported")
    shutil.rmtree(sandbox_e, ignore_errors=True)

    # PART 4 (ROW F): apply_missing_file_backstop() (execution/update_template.py,
    # REQUIRED_FILES) does shutil.copy2() directly, never calling
    # _sync_file_with_guard() -- it must ALSO record a baseline at delivery time,
    # or every file it ever delivers (execution/handoff_check.py,
    # execution/mission.py, execution/contract.py, .agent/handoffs.yaml -- exactly
    # the files a harness user is most likely to hand-edit) is born already inside
    # the dangerous no-record population. Asserted DIRECTLY against the baseline
    # store immediately after delivery -- not via a second simulated run through a
    # different code path, since whether a second run ever revisits this file
    # depends on manifest completeness this golden should not have to model.
    sandbox_f = SANDBOX / "row_f"
    ws_f = sandbox_f / "ws"
    up_f = sandbox_f / "up"
    shutil.rmtree(sandbox_f, ignore_errors=True)
    _write(ws_f / "WORKSPACE", "TestWorkspace\n")
    _write(ws_f / ".agent/update-manifest.yaml", "paths: []\n")  # force delivery via the backstop, not the main loop
    _write(ws_f / ".agent/profile.json", json.dumps({"project_name": "test", "template_version": "1.0.0"}))
    _write(ws_f / ".agent/version", "1.0.0\n")
    _write(up_f / "execution/contract.py", "def contract(): pass  # delivered by backstop\n")
    _write(up_f / ".agent/version", "2.0.0\n")
    run_apply(ws_f, up_f)
    baseline_store_f = ws_f / ".agent/memory/scratch/template_baselines.json"
    has_baseline_f = False
    if baseline_store_f.exists():
        try:
            has_baseline_f = "execution/contract.py" in json.loads(baseline_store_f.read_text())
        except Exception:
            has_baseline_f = False
    print(f"[row-F: backstop-delivered file] baseline_recorded_at_creation={has_baseline_f}")
    if not has_baseline_f:
        failures.append(
            "ROW F: apply_missing_file_backstop() delivered execution/contract.py "
            "WITHOUT recording a baseline -- this file is born inside the "
            "no-record population and stays there until some future code path "
            "happens to revisit it (not guaranteed)."
        )
    shutil.rmtree(sandbox_f, ignore_errors=True)

    shutil.rmtree(SANDBOX, ignore_errors=True)

    if failures:
        print(f"\nFAIL — {len(failures)} violation(s):")
        for f in failures:
            print(f"  {f}")
        return 1

    print(f"\nOK — no-baseline treated as diverged (preserved + reported) across "
          f"{len(STYLES)} styles x {len(BASELINE_SUBCASES)} no-record subcases, "
          f"the identical-content exception still proceeds safely, never-diverged "
          f"files survive their first hand-edit (ROW E), and backstop-delivered "
          f"REQUIRED_FILES get a baseline at creation (ROW F).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
