#!/usr/bin/env python3
"""verify_mission_gate_phase_coverage.py -- assertion-shape-sweep F1 repair.

Replaces mission-py-gate-fix/contract-f1.yaml's original A1/A2, both
text-as-proxy for "gate() iterates every phase a contract declares, not
just phase 1" (the literal #92 bug):
  - A1: `grep -n '"1"' execution/mission.py | grep -v "^Binary" | grep -q
    "phase"` -- does some line contain both the substring `phase` and the
    substring `"1"`? Says nothing about control flow.
  - A2: `grep -q "phase_num\\|max.*phase\\|assertions.*phase"
    execution/mission.py` -- a loose OR over three fragments, present
    anywhere in a 2000+-line file.

This replacement OBSERVES the mechanism: it drives the REAL
`python3 execution/mission.py gate <mission> <milestone>` subcommand (never
retyped/reimplemented) against a fixture mission attached to a fixture
contract that declares TWO phases via per-check `phase:` fields (GH #1317
per-check phase routing, execution/contract.py's normalize_contract). Phase
1 trivially passes; phase 2 deliberately fails. A gate that silently stops
after phase 1 (the #92 shape) would report PASS and never print "Gating
Phase 2" -- this checker asserts the opposite is actually true.

Fixtures are written into tempfile.TemporaryDirectory() only -- never into
the real .agent/memory/project/missions/ or specs/ trees.

Override MISSION_PY_UNDER_TEST (absolute path, default = the real
execution/mission.py) exists only for negative verification against a
deliberately broken temp copy -- never set in the production assertion.
"""
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
GOLDENS = REPO_ROOT / ".agent" / "memory" / "project" / "specs" / "assertion-shape-sweep" / "goldens"
MISSION_PY = Path(os.environ.get("MISSION_PY_UNDER_TEST", str(REPO_ROOT / "execution" / "mission.py")))

FAILURES = []


def fail(name, msg):
    FAILURES.append(f"{name}: {msg}")
    print(f"FAIL [{name}]: {msg}", file=sys.stderr)


def ok(name, msg):
    print(f"OK [{name}]: {msg}")


def _write_fixture(tmpdir: Path, phase1_cmd: str, phase2_cmd: str) -> Path:
    """Write a fixture contract (two phases via per-check phase:) plus a
    fixture mission attached to it, both into tmpdir. Return the mission
    path."""
    contract_text = GOLDENS.joinpath("f1_fixture_contract.yaml").read_text()
    # Substitute each check's command by its own id (not by old command text)
    # -- a naive text-replace on "true"/"false" would collide when phase1_cmd
    # and phase2_cmd are swapped (P1's new value equalling P2's old text).
    contract_text = re.sub(
        r'(id: P1\n(?:.*\n)*?\s*command: )"[^"]*"',
        lambda m: f'{m.group(1)}"{phase1_cmd}"', contract_text,
    )
    contract_text = re.sub(
        r'(id: P2\n(?:.*\n)*?\s*command: )"[^"]*"',
        lambda m: f'{m.group(1)}"{phase2_cmd}"', contract_text,
    )
    contract_path = tmpdir / "f1_fixture_contract.yaml"
    contract_path.write_text(contract_text)

    mission_template = GOLDENS.joinpath("f1_fixture_mission.md.template").read_text()
    mission_text = mission_template.replace("{CONTRACT_PATH}", str(contract_path))
    mission_path = tmpdir / "f1_fixture_mission.md"
    mission_path.write_text(mission_text)
    return mission_path


def _run_gate(mission_path: Path):
    env = os.environ.copy()
    env["PYTHONPATH"] = str(REPO_ROOT) + os.pathsep + env.get("PYTHONPATH", "")
    result = subprocess.run(
        [sys.executable, str(MISSION_PY), "gate", str(mission_path), "--milestone", "M1"],
        cwd=str(REPO_ROOT), capture_output=True, text=True, env=env,
    )
    return result


def case_phase2_fails():
    """Phase 1 passes, phase 2 deliberately fails -- gate must actually
    reach and run phase 2, then fail with exit 2 and gate_result: fail
    persisted on disk."""
    name = "phase2_fails_after_reaching_it"
    with tempfile.TemporaryDirectory() as td:
        mission_path = _write_fixture(Path(td), "true", "false")
        result = _run_gate(mission_path)
        out = result.stdout + result.stderr

        if result.returncode != 2:
            return fail(name, f"expected exit 2 (milestone gate FAILED), got {result.returncode}\n{out}")
        if "Gating Phase 2" not in out:
            return fail(name, f"gate never reached phase 2 -- the exact false-PASS #92 shape\n{out}")

        mission_text = mission_path.read_text()
        if "gate_result: pass" in mission_text:
            return fail(name, "on-disk mission file shows gate_result: pass despite phase 2 failing")
        if "gate_result: fail" not in mission_text:
            return fail(name, f"on-disk mission file never recorded gate_result: fail\n{mission_text}")
        ok(name, "gate ran phase 2, failed with exit 2, and persisted gate_result: fail on disk")


def case_phase1_fails_stops_before_phase2():
    """Phase 1 fails -- gate must stop there (exit 2, never print "Gating
    Phase 2"), proving ordering (not just "phase 2 gets reached
    eventually")."""
    name = "phase1_fails_stops_before_phase2"
    with tempfile.TemporaryDirectory() as td:
        mission_path = _write_fixture(Path(td), "false", "true")
        result = _run_gate(mission_path)
        out = result.stdout + result.stderr

        if result.returncode != 2:
            return fail(name, f"expected exit 2, got {result.returncode}\n{out}")
        if "Gating Phase 2" in out:
            return fail(name, f"gate proceeded to phase 2 despite phase 1 failing -- ordering broken\n{out}")
        ok(name, "gate stopped at the first failing phase, never reaching phase 2")


def main():
    case_phase2_fails()
    case_phase1_fails_stops_before_phase2()

    if FAILURES:
        print(f"\n{len(FAILURES)} failure(s).", file=sys.stderr)
        sys.exit(1)
    print("\nPASS: mission.py gate iterates every phase a contract declares, in order.")
    sys.exit(0)


if __name__ == "__main__":
    main()
