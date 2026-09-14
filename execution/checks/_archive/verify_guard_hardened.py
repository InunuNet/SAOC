#!/usr/bin/env python3
"""verify_guard_hardened.py -- assertion-shape-audit F1 repair.

Replaces the original text-based checker (bucket-C defect: it grepped
execution/update_template.py's SOURCE for the literal substring
`profile.get("project_name") == "Athanor"` plus a nearby "requires
WORKSPACE"/`workspace_file` marker). That approach:
  - FALSE-NEGATIVE: a comment like "# requires WORKSPACE eventually" near
    the comparison satisfied it with zero functional change.
  - FALSE-POSITIVE: a correct implementation that spells the variable
    `ws_marker` or calls `Path("WORKSPACE").exists()` inline would FAIL
    despite being correct.

This replacement OBSERVES the mechanism: it actually RUNS
execution/update_template.py (real file, real subprocess, real argv/exit
code/stderr) against isolated fixture directories and checks the guard's
ACTUAL decision, never grepping the guard's source text.

Guard truth table under test (execution/update_template.py, the
"Self-update guard" block just before manifest load):
  1. WORKSPACE file present with content "Athanor", --apply (not dry-run),
     no FORCE_UPDATE  -> guard MUST fire (exit 2, template-repo message).
  2. No WORKSPACE file, .agent/profile.json project_name=="Athanor",
     --apply           -> guard MUST NOT fire (project_name alone is not
                           proof -- this is the exact scenario the original
                           vulnerable code got wrong).
  3. WORKSPACE file present but with unrelated content, project_name==
     "Athanor", --apply -> guard MUST NOT fire (content, not mere
                            presence, of WORKSPACE is what matters).
  4. WORKSPACE=="Athanor", --apply, FORCE_UPDATE=1 -> guard MUST NOT fire
     (documented escape hatch for local development).

Override the script under test via GUARD_SCRIPT_UNDER_TEST (absolute path)
for negative verification against a deliberately broken temp copy -- never
used in the production assertion, which always tests the real repo file.
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
GUARD_SCRIPT = Path(os.environ.get(
    "GUARD_SCRIPT_UNDER_TEST",
    str(REPO_ROOT / "execution" / "update_template.py"),
))

FAILURES = []


def fail(name, msg):
    FAILURES.append(f"{name}: {msg}")
    print(f"FAIL [{name}]: {msg}", file=sys.stderr)


def ok(name, msg):
    print(f"OK [{name}]: {msg}")


def make_fixture(tmp_root, *, workspace_content=None, project_name=None):
    """Build an isolated cwd for update_template.py: optional WORKSPACE file,
    optional .agent/profile.json, and an empty --source dir so the script
    reaches the guard without needing a real manifest/template tree."""
    fixture = tmp_root / "fixture"
    fixture.mkdir(parents=True)
    if workspace_content is not None:
        (fixture / "WORKSPACE").write_text(workspace_content)
    agent_dir = fixture / ".agent"
    agent_dir.mkdir()
    if project_name is not None:
        (agent_dir / "profile.json").write_text(
            json.dumps({"project_name": project_name})
        )
    source_dir = tmp_root / "empty_source"
    source_dir.mkdir(exist_ok=True)
    return fixture, source_dir


def run_guard(fixture, source_dir, *, force_update=False):
    env = os.environ.copy()
    if force_update:
        env["FORCE_UPDATE"] = "1"
    else:
        env.pop("FORCE_UPDATE", None)
    return subprocess.run(
        [sys.executable, str(GUARD_SCRIPT), "--apply", "--source", str(source_dir)],
        cwd=str(fixture),
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
    )


GUARD_MESSAGE = "Running inside the Athanor template repo"


def case_workspace_athanor_blocks():
    name = "workspace_athanor_blocks"
    with tempfile.TemporaryDirectory() as td:
        fixture, source_dir = make_fixture(
            Path(td), workspace_content="Athanor", project_name="whatever-downstream"
        )
        r = run_guard(fixture, source_dir)
        if r.returncode != 2 or GUARD_MESSAGE not in r.stderr:
            fail(name, f"expected exit 2 + guard message; got exit={r.returncode} "
                       f"stderr={r.stderr!r}")
            return
        ok(name, "WORKSPACE=='Athanor' correctly blocks --apply")


def case_projectname_alone_does_not_block():
    name = "projectname_alone_does_not_block"
    with tempfile.TemporaryDirectory() as td:
        fixture, source_dir = make_fixture(
            Path(td), workspace_content=None, project_name="Athanor"
        )
        r = run_guard(fixture, source_dir)
        if r.returncode == 2 or GUARD_MESSAGE in r.stderr:
            fail(name, "project_name=='Athanor' with no WORKSPACE file falsely "
                       f"triggered the template-repo guard: exit={r.returncode} "
                       f"stderr={r.stderr!r}")
            return
        ok(name, "project_name=='Athanor' alone (no WORKSPACE) does not block")


def case_workspace_wrong_content_does_not_block():
    name = "workspace_wrong_content_does_not_block"
    with tempfile.TemporaryDirectory() as td:
        fixture, source_dir = make_fixture(
            Path(td), workspace_content="some-downstream-project", project_name="Athanor"
        )
        r = run_guard(fixture, source_dir)
        if r.returncode == 2 or GUARD_MESSAGE in r.stderr:
            fail(name, "a WORKSPACE file present with unrelated content falsely "
                       f"triggered the guard: exit={r.returncode} stderr={r.stderr!r}")
            return
        ok(name, "WORKSPACE present but content != 'Athanor' does not block")


def case_force_update_bypasses():
    name = "force_update_bypasses"
    with tempfile.TemporaryDirectory() as td:
        fixture, source_dir = make_fixture(
            Path(td), workspace_content="Athanor", project_name="Athanor"
        )
        r = run_guard(fixture, source_dir, force_update=True)
        if r.returncode == 2 or GUARD_MESSAGE in r.stderr:
            fail(name, f"FORCE_UPDATE=1 did not bypass the guard: exit={r.returncode} "
                       f"stderr={r.stderr!r}")
            return
        ok(name, "FORCE_UPDATE=1 bypasses the guard as documented")


def main():
    if not GUARD_SCRIPT.exists():
        print(f"FAIL: script under test not found: {GUARD_SCRIPT}", file=sys.stderr)
        return 1

    case_workspace_athanor_blocks()
    case_projectname_alone_does_not_block()
    case_workspace_wrong_content_does_not_block()
    case_force_update_bypasses()

    if FAILURES:
        print(f"\n{len(FAILURES)} case(s) failed.", file=sys.stderr)
        return 1
    print("\nPASS: self-update guard observed behaviorally across 4 fixture cases")
    return 0


if __name__ == "__main__":
    sys.exit(main())
