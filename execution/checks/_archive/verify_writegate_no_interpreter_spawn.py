#!/usr/bin/env python3
"""verify_writegate_no_interpreter_spawn.py -- assertion-shape-audit F3 repair.

Replaces hotfix-1300-writegate/contract-f1.yaml A1's word-ban assertion:
  `! grep -q "python3" execution/hooks/require_contract_for_write.sh`

The intent (per the hook's own header comment, "Uses bash/jq only — avoids
interpreter startup cost per hooks.md rule") is a PERFORMANCE property: this
hook fires on every Write/Edit tool call, so it must never fork a fresh
python/python3 interpreter per invocation. Banning the literal substring
"python3":
  - FALSE-POSITIVE: a maintainer's explanatory comment that merely mentions
    "python3" (e.g. documenting why the hook avoids it, exactly like the
    hook's own real header) breaks the gate.
  - FALSE-NEGATIVE: `PY=python3; "$PY" ...`, `python "$SCRIPT"` (no "3"),
    or a wrapper binary all reintroduce interpreter startup while the
    literal substring "python3" stays absent.

This replacement OBSERVES the mechanism instead: it shadows PATH with fake
`python`, `python3`, `python3.*`, `perl`, `ruby`, and `node` executables
that each drop a sentinel file and exit, then runs the REAL hook (real
subprocess, real stdin JSON, real exit code) across representative
scenarios (safe-zone path, no active mission, active mission blocked,
active mission with contract, terminal-status mission). Assertion: no
sentinel file is ever created, across ANY scenario or hook exit code --
i.e. the hook never actually execs an interpreter, regardless of what
words appear in its source or comments.

Override the hook under test via HOOK_SCRIPT_UNDER_TEST (absolute path)
for negative verification against a deliberately broken temp copy -- never
used in the production assertion, which always tests the real repo file.
"""
import json
import os
import stat
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOK_SCRIPT = Path(os.environ.get(
    "HOOK_SCRIPT_UNDER_TEST",
    str(REPO_ROOT / "execution" / "hooks" / "require_contract_for_write.sh"),
))

INTERPRETER_NAMES = ["python", "python3", "python3.11", "python3.12", "python3.13",
                      "python3.14", "perl", "ruby", "node"]

FAILURES = []


def fail(name, msg):
    FAILURES.append(f"{name}: {msg}")
    print(f"FAIL [{name}]: {msg}", file=sys.stderr)


def ok(name, msg):
    print(f"OK [{name}]: {msg}")


def make_sentinel_path_dir(tmp_root: Path, sentinel: Path) -> Path:
    bin_dir = tmp_root / "fakebin"
    bin_dir.mkdir(exist_ok=True)
    for name in INTERPRETER_NAMES:
        script = bin_dir / name
        script.write_text(
            "#!/bin/sh\n"
            f'echo "spawned" >> "{sentinel}"\n'
            "exit 1\n"
        )
        script.chmod(script.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    return bin_dir


def run_hook(fixture_root, file_path, *, shadowed_path, timeout=15):
    env = os.environ.copy()
    env["PATH"] = f"{shadowed_path}:{env.get('PATH', '')}"
    payload = json.dumps({"tool_input": {"file_path": file_path}})
    return subprocess.run(
        ["bash", str(HOOK_SCRIPT)],
        input=payload,
        cwd=str(fixture_root),
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def build_mission_fixture(root: Path, *, status: str, with_contract: bool, slug="fixture-mission"):
    missions = root / ".agent" / "memory" / "project" / "missions"
    missions.mkdir(parents=True, exist_ok=True)
    mission_path = missions / f"2026-08-17-{slug}.md"
    mission_path.write_text(f"---\nstatus: {status}\n---\n# fixture mission\n")
    active_json = missions / "active.json"
    active_json.write_text(json.dumps({"mission": str(mission_path), "checkpoint": None}))
    if with_contract:
        spec_dir = root / ".agent" / "memory" / "project" / "specs" / slug
        spec_dir.mkdir(parents=True, exist_ok=True)
        (spec_dir / "contract.yaml").write_text("schema: athanor.contract/v1\n")
    return mission_path


def scenario(name, fixture_builder, file_path, expect_exit):
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        sentinel = root / "SENTINEL_INTERPRETER_SPAWNED"
        bin_dir = make_sentinel_path_dir(root, sentinel)
        if fixture_builder is not None:
            fixture_builder(root)
        r = run_hook(root, file_path, shadowed_path=str(bin_dir))
        if sentinel.exists():
            fail(name, f"an interpreter (python/perl/ruby/node) was actually spawned "
                       f"-- sentinel contents: {sentinel.read_text()!r} "
                       f"(hook exit={r.returncode})")
            return
        if expect_exit is not None and r.returncode != expect_exit:
            fail(name, f"expected hook exit {expect_exit}, got {r.returncode} "
                       f"(stdout={r.stdout!r} stderr={r.stderr!r}) -- fixture may be "
                       "miscalibrated; interpreter-spawn check itself did pass")
            return
        ok(name, f"no interpreter spawned (hook exit={r.returncode}, as expected)")


def main():
    if not HOOK_SCRIPT.exists():
        print(f"FAIL: hook under test not found: {HOOK_SCRIPT}", file=sys.stderr)
        return 1

    scenario("safe_zone_tmp_path", None, "/tmp/whatever.txt", 0)
    scenario("no_active_mission", None, "some/repo/path.py", 0)
    scenario(
        "active_mission_no_contract_blocks",
        lambda root: build_mission_fixture(root, status="in_progress", with_contract=False),
        "some/repo/path.py",
        2,
    )
    scenario(
        "active_mission_with_contract_allows",
        lambda root: build_mission_fixture(root, status="in_progress", with_contract=True),
        "some/repo/path.py",
        0,
    )
    scenario(
        "terminal_status_mission_fails_open",
        lambda root: build_mission_fixture(root, status="complete", with_contract=False),
        "some/repo/path.py",
        0,
    )

    if FAILURES:
        print(f"\n{len(FAILURES)} case(s) failed.", file=sys.stderr)
        return 1
    print("\nPASS: require_contract_for_write.sh never spawns an interpreter, "
          "across 5 fixture scenarios")
    return 0


if __name__ == "__main__":
    sys.exit(main())
