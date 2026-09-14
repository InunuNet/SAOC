#!/usr/bin/env python3
"""
verify_retraction_restart_warning.py — P2 env-var-retraction-cannot-self-heal
(.agent/memory/project/data/p2-env-var-retraction-cannot-self-heal-a.md).

CONFIRMED PREMISE: apply_retractions() (execution/update_template.py) edits
ONLY the on-disk .claude/settings.json. It cannot un-export a variable a
running process has already pulled into its own environment (no external
process can un-export a var from another process's/shell's environment).
Retraction is therefore launch-time-only: it protects the NEXT session, not
the CURRENT one, and previously did so silently -- a fired retraction read
identically whether or not the live session was actually still poisoned.

FIX UNDER TEST: apply_retractions() now checks, at the moment a retraction
FIRES, whether the retracted var is present in THIS process's own os.environ
(the same environment update_template.py inherits when run as a subprocess
of the very Claude Code session it is patching). If so, it prints a loud
"RESTART REQUIRED" line. If the var is not currently set (the common/correct
case -- e.g. a fresh workspace that never launched with the bad var), no
warning fires, so the normal case is not spammed.

ROW A (warning fires): os.environ carries the retracted var at retraction
  time -> stdout must contain a RESTART REQUIRED line naming the var.
ROW B (no warning, var unset): os.environ does NOT carry the retracted var
  -> stdout must NOT contain a RESTART REQUIRED line. Proves the check does
  not fire unconditionally on every retraction.
ROW C (no warning, non-env key_path): a retraction on a key_path that is not
  under "env." must never consult os.environ / print a RESTART line, even if
  a coincidentally-named var is set -- proves the check is gated to actual
  env retractions, not a blanket string match on the leaf key name.

Usage: verify_retraction_restart_warning.py
Exit codes: 0 pass, 1 fail.
"""
import contextlib
import io
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "execution"))

BAD_LITERAL = "$ANTHROPIC_DEFAULT_HAIKU_MODEL"
ENV_VAR_NAME = "ANTHROPIC_DEFAULT_HAIKU_MODEL"

RETRACTION_ENTRY = {
    "path": ".claude/settings.json",
    "key_path": "env.ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "bad_value": BAD_LITERAL,
    "action": "remove",
    "reason": "test fixture",
    "issue": "p2-env-var-retraction-cannot-self-heal-a",
}

NON_ENV_ENTRY = {
    "path": ".claude/settings.json",
    "key_path": "someOtherBlock.ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "bad_value": BAD_LITERAL,
    "action": "remove",
    "reason": "test fixture -- not an env.* key_path",
    "issue": "p2-env-var-retraction-cannot-self-heal-a-rowC",
}


def _make_fixture(tmp_root: Path, key_top: str) -> Path:
    settings_dir = tmp_root / ".claude"
    settings_dir.mkdir(parents=True, exist_ok=True)
    settings_path = settings_dir / "settings.json"
    settings_path.write_text(json.dumps({key_top: {"ANTHROPIC_DEFAULT_HAIKU_MODEL": BAD_LITERAL}}, indent=2) + "\n")
    return settings_path


def fail(msg: str) -> int:
    print(f"FAIL: {msg}")
    return 1


def ok(msg: str) -> int:
    print(f"PASS: {msg}")
    return 0


def _run_capturing(manifest, project_root):
    import update_template
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        update_template.apply_retractions(manifest, project_root=project_root, backup_dir=None, dry_run=False)
    return buf.getvalue()


def main() -> int:
    try:
        import update_template  # noqa: F401
    except Exception as e:
        return fail(f"cannot import execution/update_template.py at all: {e}")

    results = {}
    saved_env = dict(os.environ)

    # ROW A: var IS set in this process's environment at retraction time.
    tmp_a = Path(tempfile.mkdtemp(prefix="restart-warning-rowA-"))
    try:
        _make_fixture(tmp_a, "env")
        os.environ[ENV_VAR_NAME] = BAD_LITERAL
        out = _run_capturing({"retractions": [RETRACTION_ENTRY]}, tmp_a)
        row_a_pass = "RESTART REQUIRED" in out and ENV_VAR_NAME in out
        results["ROW A (warning fires when var still live)"] = row_a_pass
        print(f"[ROW A] {'RESTART REQUIRED line present' if row_a_pass else 'MISSING warning'} -- captured output:\n{out}")
    finally:
        os.environ.clear()
        os.environ.update(saved_env)
        shutil.rmtree(tmp_a, ignore_errors=True)

    # ROW B: var is NOT set in this process's environment -> no spam.
    tmp_b = Path(tempfile.mkdtemp(prefix="restart-warning-rowB-"))
    try:
        _make_fixture(tmp_b, "env")
        os.environ.pop(ENV_VAR_NAME, None)
        out = _run_capturing({"retractions": [RETRACTION_ENTRY]}, tmp_b)
        row_b_pass = "RESTART REQUIRED" not in out
        results["ROW B (no warning when var not live)"] = row_b_pass
        print(f"[ROW B] {'no warning, as expected' if row_b_pass else 'SPURIOUS warning'} -- captured output:\n{out}")
    finally:
        os.environ.clear()
        os.environ.update(saved_env)
        shutil.rmtree(tmp_b, ignore_errors=True)

    # ROW C: retraction on a non-"env."-prefixed key_path must never check
    # os.environ, even if a coincidentally-named var happens to be set.
    tmp_c = Path(tempfile.mkdtemp(prefix="restart-warning-rowC-"))
    try:
        _make_fixture(tmp_c, "someOtherBlock")
        os.environ[ENV_VAR_NAME] = BAD_LITERAL
        out = _run_capturing({"retractions": [NON_ENV_ENTRY]}, tmp_c)
        row_c_pass = "RESTART REQUIRED" not in out
        results["ROW C (non-env.* key_path never triggers warning)"] = row_c_pass
        print(f"[ROW C] {'no warning, as expected' if row_c_pass else 'SPURIOUS warning on non-env key_path'} -- captured output:\n{out}")
    finally:
        os.environ.clear()
        os.environ.update(saved_env)
        shutil.rmtree(tmp_c, ignore_errors=True)

    failed = [name for name, passed in results.items() if not passed]
    print()
    if failed:
        return fail(f"{len(failed)}/{len(results)} row(s) failed: {failed}")
    return ok(f"all {len(results)} rows passed: {list(results.keys())}")


if __name__ == "__main__":
    sys.exit(main())
