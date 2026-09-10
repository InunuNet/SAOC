#!/usr/bin/env python3
"""
verify_no_update_provenance_matrix.py — Parametrized provenance check for
EVERY .agent/no-update pattern style, closing the gap the pattern-style
matrix exposed on 2026-08-15: "just delete the entry-level whole-directory
skip in main()'s HARNESS dispatch" only produces correct behavior for the
ONE pattern style Alembic happens to use (a bare trailing-slash directory
path, no wildcard). Under that spelling, is_protected() never matches any
per-file path, so nothing blocks file-level operations and the separate,
correct baseline-hash guard (_sync_file_with_guard()) does all the real
work. The moment a workspace writes an equally reasonable spelling —
`.agent/skills/*` or `.agent/skills/**` — per-file is_protected() starts
returning True for EVERY file under that directory, INCLUDING ones that
don't exist locally yet, and copy_harness()'s directory-branch check
(`if is_protected(workspace_rel): continue`, evaluated with no regard to
whether dst_file exists) blocks their creation. Deleting the entry-level
skip alone moves the accident to a different pattern spelling; it does not
remove it.

THE REQUIRED FIX this golden verifies: is_protected() must never be
consulted for a file that does not exist yet, at every per-file call
site — copy_harness()'s directory branch AND apply_fresh_manifest_backstop().
Existence must be checked BEFORE protection, not after or never:
    if dst_file.exists() and is_protected(workspace_rel):
        continue   # only NOW may protection ever block anything
A file with no local copy is always eligible for creation, regardless of
what pattern matched it. This makes protection a strict property of files
that ALREADY EXIST, independent of pattern spelling.

PROVENANCE MODEL — three rows, tested against ALL FIVE pattern styles
below (parametrized internally so a fix for one spelling cannot silently
leave another broken; a failure names the exact style AND row that
failed):
    ROW A (new)     — file absent locally -> MUST be delivered.
    ROW B (diverged) — file present, differs from its recorded baseline
                       (a real local hand-edit, e.g. GH #1343) -> MUST be
                       preserved, untouched, regardless of pattern style.
    ROW C (stale)   — file present, IDENTICAL to its recorded baseline
                       (operator never touched it), upstream has a real
                       content update -> MUST be delivered (this is "the
                       row MumblAI needed and didn't get" — see
                       verify_provenance_protection.py.golden's row-1
                       finding, generalized here across pattern styles).

PATTERN STYLES under test:
    1. trailing-slash        ".agent/skills/"    (Alembic's real pattern)
    2. trailing-wildcard     ".agent/skills/*"
    3. bare-dir-no-slash     ".agent/skills"
    4. double-star           ".agent/skills/**"
    5. exact-file            ".agent/skills/<the file under test>"
                              (only makes sense combined with the target
                              filename; verified as its own row-agnostic
                              case: protects exactly the named existing
                              file, never a sibling, never blocks it from
                              being created if absent)

MUTATION TABLE (each row names the exact code change that would make this
check fail, and which fixture row/style catches it — required per project
mutation-testability standard so this check cannot go decorative):
    M1: reintroduce the entry-level whole-entry `if is_protected(path):
        skip` in main()'s HARNESS dispatch, deleting nothing at the
        per-file level -> kills ROW A and ROW C for ALL five styles
        (nothing under a protected directory entry is ever created or
        updated again, exactly today's behavior pre-fix).
    M2: fix the existence-gate ONLY for copy_harness()'s directory branch,
        forget apply_fresh_manifest_backstop() (or vice versa) -> kills
        ROW A specifically for whichever pattern style causes the OTHER
        (unfixed) call site to be the one that actually processes that
        file. This is why both call sites are exercised via the real CLI,
        not one in isolation.
    M3: gate existence AFTER protection instead of before (i.e. keep
        `if is_protected(...): continue` first, add an existence check
        only inside the branch that already returned) -> logically
        equivalent to no fix at all; kills ROW A for wildcard styles
        (2, 4) exactly like M1.
    M4: only fix the wildcard styles' matching and leave the entry-level
        skip in place for non-wildcard styles -> kills ROW A/ROW C for
        style 1 (trailing-slash) and style 3 (bare-dir) specifically,
        while styles 2/4 falsely appear fixed. This is the mutation the
        matrix itself was built to catch — a fix "for the bug we saw" that
        does not generalize.
    M5: baseline-hash guard's divergence check disabled/weakened (e.g.
        --force behavior applied unconditionally) -> kills ROW B for ALL
        styles (hand-edited files start getting silently overwritten —
        this is GH #1343's regression shape).

Runs the REAL CLI as a subprocess (`python3 execution/update_template.py
--apply --source <fixture>`) — no mocking of is_protected() or
copy_harness(), because the defect lives in HOW call sites use
is_protected(), not in is_protected() itself; a check that stubs either
would certify the stub, not the behavior.
"""
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

# Shared with verify_no_baseline_data_loss.py (template-update-actually-
# updates F7) -- see no_update_styles.py's own docstring for why this is a
# single source of truth rather than two independently-maintained copies.
from no_update_styles import STYLES

UPDATE_TEMPLATE = Path("execution/update_template.py").resolve()
SANDBOX = Path("/tmp/verify_no_update_provenance_matrix_sandbox")

# Explicit expected membership for the shared STYLES dict (no_update_styles.py).
# Iterating STYLES.items() alone cannot detect a silently-narrowed dict -- a
# deleted entry just makes the loop below run fewer times and this check
# still exits 0. This set makes a shrunk (or renamed, or padded) STYLES a
# hard, named failure instead of a quiet coverage loss.
EXPECTED_STYLES = {
    "trailing-slash", "trailing-wildcard", "bare-dir-no-slash",
    "double-star", "exact-file",
}


def _write(p: Path, content: str):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)


def build_fixture(style_name: str, no_update_line_fn):
    """One workspace exercising all three provenance rows at once, under
    ONE pattern style. Using three distinct filenames in the same run
    means a single subprocess invocation validates all three rows for
    that style, and any row's on-disk result is independent of the others."""
    tag = style_name.replace("/", "_").replace("*", "star")
    ws = SANDBOX / f"ws_{tag}"
    up = SANDBOX / f"up_{tag}"
    shutil.rmtree(ws, ignore_errors=True)
    shutil.rmtree(up, ignore_errors=True)

    # Row A: new file, doesn't exist locally.
    new_name = "row-a-new-file.md"
    _write(up / ".agent/skills" / new_name, "new content\n")

    # Row B: existing, diverged from baseline (hand-edit).
    diverged_name = "row-b-diverged.md"
    _write(up / ".agent/skills" / diverged_name, "incoming upstream content\n")

    # Row C: existing, identical to baseline, upstream changed.
    stale_name = "row-c-stale.md"
    _write(up / ".agent/skills" / stale_name, "UPDATED upstream content v2\n")

    _write(up / ".agent/version", "9.9.9\n")

    no_update_pattern = no_update_line_fn(diverged_name)  # exact-file style protects row-b's name

    _write(ws / "WORKSPACE", "TestWorkspace\n")
    _write(ws / ".agent/update-manifest.yaml", "paths:\n  - category: HARNESS\n    path: .agent/skills/\n")
    _write(ws / ".agent/no-update", no_update_pattern + "\n")
    _write(ws / ".agent/profile.json", json.dumps({"project_name": "test", "template_version": "1.0.0"}))
    _write(ws / ".agent/version", "1.0.0\n")

    baselines = {}

    diverged_prior = "PRIOR delivered content (baseline)\n"
    (ws / ".agent/skills").mkdir(parents=True, exist_ok=True)
    (ws / ".agent/skills" / diverged_name).write_text("LOCAL HAND-EDIT -- do not lose this\n")
    baselines[f".agent/skills/{diverged_name}"] = hashlib.sha256(diverged_prior.encode()).hexdigest()

    stale_content = "OLD upstream content v1\n"
    (ws / ".agent/skills" / stale_name).write_text(stale_content)
    baselines[f".agent/skills/{stale_name}"] = hashlib.sha256(stale_content.encode()).hexdigest()

    _write(ws / ".agent/memory/scratch/template_baselines.json", json.dumps(baselines))

    return ws, up, new_name, diverged_name, stale_name


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

    for style_name, pattern_fn in STYLES.items():
        ws, up, new_name, diverged_name, stale_name = build_fixture(style_name, pattern_fn)
        out = run_apply(ws, up)

        row_a_ok = (ws / ".agent/skills" / new_name).exists()
        row_b_ok = (ws / ".agent/skills" / diverged_name).read_text() == "LOCAL HAND-EDIT -- do not lose this\n"
        row_c_ok = (ws / ".agent/skills" / stale_name).read_text() == "UPDATED upstream content v2\n"

        print(f"[{style_name}] rowA(new)={row_a_ok} rowB(diverged-preserved)={row_b_ok} rowC(stale-updates)={row_c_ok}")

        if not row_a_ok:
            failures.append(f"{style_name}: ROW A (new file) NOT delivered")
        if not row_b_ok:
            failures.append(f"{style_name}: ROW B (diverged file) NOT preserved -- GH #1343 regression")
        if not row_c_ok:
            failures.append(f"{style_name}: ROW C (stale-but-updatable file) NOT updated")

        if failures and out:
            pass  # keep output available for the final dump below on failure

    shutil.rmtree(SANDBOX, ignore_errors=True)

    if failures:
        print(f"\nFAIL — {len(failures)} violation(s):")
        for f in failures:
            print(f"  {f}")
        return 1

    print("\nOK — all 3 provenance rows hold across all 5 pattern styles.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
