#!/usr/bin/env python3
"""
verify_provenance_protection.py — Golden reference for the fix that
resolves BOTH field reports at once: Alembic's counterexample (new file
delivered into a `.agent/no-update`-covered directory while an existing
hand-edited file was correctly preserved, same run) AND MumblAI's silent
no-op (skills stuck for a month while template_version kept claiming
currency).

ROOT CAUSE, reproduced against the REAL execution/update_template.py via
subprocess (sandboxed fixtures, 2026-08-15 — not theory, not a mock):

  execution/update_template.py's per-file baseline-hash guard
  (_sync_file_with_guard(), backed by TEMPLATE_BASELINES_PATH) ALREADY
  implements the correct 3-row provenance model correctly, in ONE call to
  copy_harness():
    ROW 1 - no local baseline recorded, or local == recorded baseline,
            incoming differs -> UPDATE FREELY (nothing to lose / no local
            edit exists to protect)
    ROW 2 - local diverges from recorded baseline -> SKIP, WARN, name the
            --force-path escape hatch

  But main()'s HARNESS-category dispatch never reaches that logic for a
  directory-style .agent/no-update entry (e.g. ".agent/skills/"): it has
  its own, EARLIER, coarser check --
      if is_protected(path): print("protected: ..."); skip ENTIRE entry
  -- which fires before copy_harness() is ever called for that directory,
  for every file in it, regardless of whether that file has ever diverged
  from its baseline. This throws away the already-correct per-file
  mechanism for the entire directory.

  CONFIRMED IMPACT (fixture below, run against the real CLI):
  ROW 1 currently BREAKS SILENTLY. A file that exists locally, is
  byte-identical to its last recorded baseline (i.e. the operator never
  touched it), sitting in a directory an operator opted to protect from
  DIVERGENCE -- receives a real upstream content update in the source, but
  after `--apply`:
    - the file's content is UNCHANGED (the safe update never lands)
    - the run's own printed summary nonetheless says
      "template_version: 1.0.0 -> 9.9.9" with ZERO mention that the
      .agent/skills/ entry was entirely skipped
  This is the exact "false success" shape: a version claim decoupled from
  actual delivered content, and very likely the actual mechanism behind
  MumblAI staying pinned to stale skill files for a month while every
  boot-time check reported an available/applied update.

THE FIX this golden verifies: main()'s HARNESS branch must ALWAYS call
copy_harness() for directory entries -- it must never skip the entire
entry based on a whole-path is_protected(path) check. Protection is
enforced ONLY inside _sync_file_with_guard(), which is already per-file
and already implements all rows correctly. (Single-FILE .agent/no-update
entries are unaffected; those already route through the same guard via
copy_harness()'s single-file branch.)

This script builds two sandbox workspace+upstream fixture pairs and runs
the REAL CLI (`python3 execution/update_template.py --apply --source ...`)
as a subprocess against each -- not a mocked or partial invocation --
then asserts on-disk post-apply content, not printed messages.
"""
import json
import hashlib
import shutil
import subprocess
import sys
from pathlib import Path

UPDATE_TEMPLATE = Path("execution/update_template.py").resolve()
SANDBOX = Path("/tmp/verify_provenance_protection_sandbox")


def _write(p: Path, content: str):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)


def build_row1_fixture():
    """Existing file, UNCHANGED since last baseline, real upstream update available,
    directory covered by a no-update entry -> must be delivered."""
    ws = SANDBOX / "ws_row1"
    up = SANDBOX / "up_row1"
    shutil.rmtree(ws, ignore_errors=True)
    shutil.rmtree(up, ignore_errors=True)

    _write(up / ".agent/skills/onboard.md", "UPDATED upstream content v2\n")
    _write(up / ".agent/version", "9.9.9\n")

    _write(ws / "WORKSPACE", "TestWorkspace\n")
    _write(ws / ".agent/update-manifest.yaml", "paths:\n  - category: HARNESS\n    path: .agent/skills/\n")
    _write(ws / ".agent/no-update", ".agent/skills/\n")
    _write(ws / ".agent/profile.json", json.dumps({"project_name": "test", "template_version": "1.0.0"}))
    _write(ws / ".agent/version", "1.0.0\n")
    old_content = "OLD upstream content v1\n"
    _write(ws / ".agent/skills/onboard.md", old_content)
    baseline_hash = hashlib.sha256(old_content.encode()).hexdigest()
    _write(
        ws / ".agent/memory/scratch/template_baselines.json",
        json.dumps({".agent/skills/onboard.md": baseline_hash}),
    )
    return ws, up


def build_row2_fixture():
    """Existing file, hand-edited (diverged from baseline) -> must be preserved,
    even though a NEW sibling file in the same protected directory must land."""
    ws = SANDBOX / "ws_row2"
    up = SANDBOX / "up_row2"
    shutil.rmtree(ws, ignore_errors=True)
    shutil.rmtree(up, ignore_errors=True)

    _write(up / ".agent/skills/alembic.md", "incoming upstream content\n")
    _write(up / ".agent/skills/heartbeat-wrap.md", "new skill content\n")
    _write(up / ".agent/version", "9.9.9\n")

    _write(ws / "WORKSPACE", "TestWorkspace\n")
    _write(ws / ".agent/update-manifest.yaml", "paths:\n  - category: HARNESS\n    path: .agent/skills/\n")
    _write(ws / ".agent/no-update", ".agent/skills/\n")
    _write(ws / ".agent/profile.json", json.dumps({"project_name": "test", "template_version": "1.0.0"}))
    _write(ws / ".agent/version", "1.0.0\n")
    prior = "PRIOR delivered content (baseline)\n"
    baseline_hash = hashlib.sha256(prior.encode()).hexdigest()
    _write(ws / ".agent/skills/alembic.md", "LOCAL HAND-EDIT -- do not lose this\n")
    _write(
        ws / ".agent/memory/scratch/template_baselines.json",
        json.dumps({".agent/skills/alembic.md": baseline_hash}),
    )
    return ws, up


def run_apply(ws: Path, up: Path) -> str:
    result = subprocess.run(
        [sys.executable, str(UPDATE_TEMPLATE), "--apply", "--source", str(up)],
        cwd=ws, capture_output=True, text=True, timeout=30,
    )
    return result.stdout + result.stderr


def main() -> int:
    ok = True

    ws1, up1 = build_row1_fixture()
    out1 = run_apply(ws1, up1)
    delivered_row1 = (ws1 / ".agent/skills/onboard.md").read_text() == "UPDATED upstream content v2\n"
    print(f"[row1: unchanged-local, upstream-updated] delivered={delivered_row1}")
    if not delivered_row1:
        print("  FAIL — safe update did not land; see subprocess output below")
        print(out1)
        ok = False

    ws2, up2 = build_row2_fixture()
    out2 = run_apply(ws2, up2)
    preserved_row2 = (ws2 / ".agent/skills/alembic.md").read_text() == "LOCAL HAND-EDIT -- do not lose this\n"
    delivered_new = (ws2 / ".agent/skills/heartbeat-wrap.md").exists()
    print(f"[row2: hand-edited existing, + new sibling] preserved={preserved_row2} new_delivered={delivered_new}")
    if not (preserved_row2 and delivered_new):
        print("  FAIL")
        print(out2)
        ok = False

    shutil.rmtree(SANDBOX, ignore_errors=True)

    if ok:
        print("OK")
        return 0
    print("FAIL")
    return 1


if __name__ == "__main__":
    sys.exit(main())
