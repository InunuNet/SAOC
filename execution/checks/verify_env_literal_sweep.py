#!/usr/bin/env python3
"""
verify_env_literal_sweep.py — delivered-value-retraction F2: the one-off
sweep for "$VAR"-shaped unexpanded literals in settings env blocks,
generalized beyond the 3 hardcoded ANTHROPIC_DEFAULT_*_MODEL vars.

SCOPE DECISION (see SPEC.md): execution/checks/verify_model_env_boot.py
(mission model-tier-repair F5) ALREADY covers the exact defect class that
caused the Alembic incident -- check_literal_unexpanded() in that file
scans .claude/settings.json and .claude/settings.local.json's "env"
blocks and FAILs if any of MODEL_VARS = (ANTHROPIC_DEFAULT_HAIKU_MODEL,
ANTHROPIC_DEFAULT_SONNET_MODEL, ANTHROPIC_DEFAULT_OPUS_MODEL) holds the
literal self-referencing string "$<VARNAME>". It is wired into
full_boot.sh's boot_report call, so it re-runs on every boot, not just
once. For those 3 specific vars, in those 2 specific files, (b) needs NO
new code -- this script exists only to prove that coverage is real (ROWS
1-3 below) and to close the genuine, narrower remaining gap
verify_model_env_boot.py does NOT cover (ROW 4): it hardcodes exactly
those 3 var NAMES and matches only `"$" + that same var's own name`, so
an unexpanded literal under ANY OTHER key in the same env block (e.g. a
custom ANTHROPIC_DEFAULT_HAIKU_MODEL alias, a project-specific env var,
or any "$SOMETHING"-shaped value that is not one of the 3 known names) is
invisible to it. This script's ROW 4 checks the GENERAL shape --
the shape ^$VARNAME$ (one leading dollar sign, then a bare identifier)
-- across every key in the same two env
blocks, not just the 3 named ones.

Status at authoring time: this is a REGRESSION LOCK, not new RED-to-fix
work (mirrors template-update-actually-updates F15's framing) --
verify_model_env_boot.py's 3-var coverage already exists and is wired
into boot; this script's job is to (a) prove that claim against the real
file/function rather than trust the docstring, and (b) hold the
additional general-shape sweep (ROW 4) as one script future workspaces
can run standalone, since GENERALIZING check_literal_unexpanded() itself
is explicitly out of scope here -- narrower is preferred per SPEC.md, and
widening the boot-time MODEL_VARS check to arbitrary keys risks false
positives on legitimate values that happen to start with "$" for
unrelated reasons in a boot-time gate that must never block startup on a
false positive. A STANDALONE one-off sweep can be run on demand
(subject to human review of any hit) instead.

Usage: verify_env_literal_sweep.py
Exit codes: 0 pass, 1 fail.
"""
import json
import re
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "execution" / "checks"))

UNEXPANDED_SHAPE = re.compile(r"^\$[A-Za-z_][A-Za-z0-9_]*$")


def fail(msg: str) -> int:
    print(f"FAIL: {msg}")
    return 1


def ok(msg: str) -> int:
    print(f"PASS: {msg}")
    return 0


def sweep_env_block(path: Path) -> list[str]:
    """Return ["key=value", ...] for every key in path's top-level "env"
    object whose value matches the generic unexpanded-literal shape,
    regardless of the key's name (unlike verify_model_env_boot.py's
    3-name-hardcoded check)."""
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text())
    except Exception:
        return []
    env = data.get("env") if isinstance(data, dict) else None
    if not isinstance(env, dict):
        return []
    hits = []
    for key, value in env.items():
        if isinstance(value, str) and UNEXPANDED_SHAPE.match(value):
            hits.append(f"{key}={value}")
    return hits


def main() -> int:
    try:
        import verify_model_env_boot as guard  # noqa
    except Exception as e:
        return fail(f"cannot import execution/checks/verify_model_env_boot.py: {e}")

    results = {}

    # ROW 1: the exact reported literal, exact reported var, is caught by
    # the EXISTING boot guard (no new code needed for this exact shape).
    tmp1 = Path(tempfile.mkdtemp(prefix="env-sweep-row1-"))
    try:
        settings = tmp1 / "settings.json"
        settings.write_text(json.dumps({"env": {"ANTHROPIC_DEFAULT_HAIKU_MODEL": "$ANTHROPIC_DEFAULT_HAIKU_MODEL"}}))
        empty = tmp1 / "settings.local.json"
        empty.write_text("{}")
        rc = guard.check_literal_unexpanded(settings, empty)
        results["ROW 1 (existing boot guard catches the reported literal)"] = (rc == 1)
        print(f"[ROW 1] verify_model_env_boot.check_literal_unexpanded() on the exact reported fixture -> rc={rc} "
              f"({'FAIL as expected (caught)' if rc == 1 else 'did NOT catch it -- coverage claim is false'})")
    finally:
        settings.unlink(missing_ok=True)
        empty.unlink(missing_ok=True)
        tmp1.rmdir()

    # ROW 2: a clean env block is not a false positive.
    tmp2 = Path(tempfile.mkdtemp(prefix="env-sweep-row2-"))
    try:
        settings = tmp2 / "settings.json"
        settings.write_text(json.dumps({"env": {"ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5-20251001"}}))
        empty = tmp2 / "settings.local.json"
        empty.write_text("{}")
        rc = guard.check_literal_unexpanded(settings, empty)
        results["ROW 2 (clean env block does not false-positive)"] = (rc == 0)
        print(f"[ROW 2] real model id -> rc={rc} ({'PASS as expected' if rc == 0 else 'FALSE POSITIVE'})")
    finally:
        settings.unlink(missing_ok=True)
        empty.unlink(missing_ok=True)
        tmp2.rmdir()

    # ROW 3: the real, live repo settings files are clean right now.
    live_settings = REPO_ROOT / ".claude" / "settings.json"
    live_local = REPO_ROOT / ".claude" / "settings.local.json"
    rc = guard.check_literal_unexpanded(live_settings, live_local)
    results["ROW 3 (live repo settings clean of the 3 known-var literal)"] = (rc == 0)
    print(f"[ROW 3] live {live_settings} / {live_local} -> rc={rc} "
          f"({'clean' if rc == 0 else 'LIVE LITERAL FOUND -- see boot guard output above'})")

    # ROW 4: the general shape (any key, not just the 3 named vars) is
    # swept by THIS script -- the genuine gap verify_model_env_boot.py
    # does not close, since it only ever compares against "$" + one of
    # the 3 hardcoded var names.
    tmp4 = Path(tempfile.mkdtemp(prefix="env-sweep-row4-"))
    try:
        settings = tmp4 / "settings.json"
        settings.write_text(json.dumps({"env": {"SOME_OTHER_VAR": "$SOME_OTHER_VAR"}}))
        boot_guard_rc = guard.check_literal_unexpanded(settings, tmp4 / "missing.json")
        general_hits = sweep_env_block(settings)
        row4_pass = (boot_guard_rc == 0) and (len(general_hits) == 1) and general_hits[0] == "SOME_OTHER_VAR=$SOME_OTHER_VAR"
        results["ROW 4 (general sweep catches what the 3-var boot guard misses)"] = row4_pass
        print(f"[ROW 4] non-MODEL_VARS key with unexpanded literal -> boot guard rc={boot_guard_rc} "
              f"(0=missed, expected -- it only checks 3 named vars), general sweep hits={general_hits} "
              f"({'general sweep catches it' if row4_pass else 'FAIL'})")

        # ROW 4 live: sweep the real repo files too, for the general shape.
        live_hits = sweep_env_block(live_settings) + sweep_env_block(live_local)
        results["ROW 4 live (real repo settings clean of ANY unexpanded literal)"] = (live_hits == [])
        print(f"[ROW 4 live] general sweep of live settings files -> hits={live_hits} "
              f"({'clean' if not live_hits else 'LIVE GENERAL LITERAL FOUND'})")
    finally:
        settings.unlink(missing_ok=True)
        tmp4.rmdir()

    failed = [name for name, passed in results.items() if not passed]
    print()
    if failed:
        return fail(f"{len(failed)}/{len(results)} row(s) failed: {failed}")
    return ok(f"all {len(results)} rows passed: {list(results.keys())}")


if __name__ == "__main__":
    sys.exit(main())
