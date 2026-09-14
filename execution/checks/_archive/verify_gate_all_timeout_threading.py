#!/usr/bin/env python3
"""verify_gate_all_timeout_threading.py -- contract-timeout-honored F3.

DECISION.md F3: gate_cmd()'s --phase all branch builds a fresh
argparse.Namespace per phase that must carry the CLI's --timeout-seconds
through to _gate_single_phase() / check_cmd() -- previously it omitted the
attribute entirely, so getattr(..., 60) always won regardless of the CLI
flag.

Shells out to the real contract.py CLI (no mocking) twice against
goldens/fixture_gate_all_threading.yaml (G1: `sleep 5 && exit 0`, no
per-check timeout_seconds declared):

  1. gate --phase all --run-checks --timeout-seconds 2
     -> must exit 2 (G1 killed at 2s, gate fails).
  2. gate --phase max --run-checks --timeout-seconds 2
     -> must also exit 2, as a live differential proving the branch SAOC
        reports as already-correct is still correct after the F1-F4 edits
        land (no accidental regression from the F3 edit touching shared
        code).
"""
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PY = REPO_ROOT / "execution" / "contract.py"
FIXTURE = REPO_ROOT / ".agent" / "memory" / "project" / "specs" / \
    "contract-timeout-honored" / "goldens" / "fixture_gate_all_threading.yaml"


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def run_gate(phase: str) -> int:
    # Clear any stale result from a previous run of this check so
    # --run-checks is forced to actually re-execute G1 under the timeout
    # being tested, not read a cached pass/fail from an earlier phase.
    subprocess.run(
        [sys.executable, str(CONTRACT_PY), "clear", str(FIXTURE)],
        cwd=str(REPO_ROOT), capture_output=True, text=True,
    )
    proc = subprocess.run(
        [sys.executable, str(CONTRACT_PY), "gate", str(FIXTURE),
         "--phase", phase, "--run-checks", "--timeout-seconds", "2"],
        cwd=str(REPO_ROOT), capture_output=True, text=True, timeout=30,
    )
    return proc.returncode


def main() -> None:
    if not FIXTURE.exists():
        fail(f"fixture not found: {FIXTURE}")

    rc_all = run_gate("all")
    if rc_all != 2:
        fail(f"gate --phase all --timeout-seconds 2 against G1 (sleeps 5s, no "
             f"per-check timeout) expected exit 2 (killed at 2s), got {rc_all}")

    rc_max = run_gate("max")
    if rc_max != 2:
        fail(f"gate --phase max --timeout-seconds 2 against the same fixture "
             f"expected exit 2 (regression: this branch was already correct), "
             f"got {rc_max}")

    print(f"PASS: --phase all threads --timeout-seconds (exit {rc_all}); "
          f"--phase max regression holds (exit {rc_max})")
    sys.exit(0)


if __name__ == "__main__":
    main()
