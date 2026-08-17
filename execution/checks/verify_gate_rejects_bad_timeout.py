#!/usr/bin/env python3
"""verify_gate_rejects_bad_timeout.py -- contract-timeout-honored F5, A2.

DECISION-F5.md: the check_cmd() guard against bad timeout_seconds must
also protect gate --run-checks, since _gate_single_phase() calls
check_cmd() in-process per assertion. Pre-fix, an over-max declared
timeout is silently accepted, the fast command finishes instantly, and
the phase gate PASSES -- the wrong outcome.

Shells out to the real contract.py CLI (no mocking) against
goldens/fixture_gate_rejects_bad_timeout.yaml (G_HUGE: timeout_seconds
999999999999) and asserts:
  - returncode == 2 (phase gate fails)
  - stdout contains both "G_HUGE" and "FAIL"

This is the cleanest proof that the fix's effect propagates through
_gate_single_phase's in-process delegation to check_cmd, not just
direct `check` invocations.
"""
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PY = REPO_ROOT / "execution" / "contract.py"
FIXTURE = REPO_ROOT / ".agent" / "memory" / "project" / "specs" / \
    "contract-timeout-honored" / "goldens" / "fixture_gate_rejects_bad_timeout.yaml"

# Wall-clock ceiling: G_HUGE's command finishes instantly either way, so
# this only guards against an unexpected hang.
SUBPROCESS_TIMEOUT_S = 10


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def clear_fixture() -> None:
    subprocess.run(
        [sys.executable, str(CONTRACT_PY), "clear", str(FIXTURE)],
        cwd=str(REPO_ROOT), capture_output=True, text=True,
    )


def main() -> None:
    if not FIXTURE.exists():
        fail(f"fixture not found: {FIXTURE}")

    clear_fixture()

    proc = subprocess.run(
        [sys.executable, str(CONTRACT_PY), "gate", str(FIXTURE),
         "--phase", "1", "--run-checks"],
        cwd=str(REPO_ROOT), capture_output=True, text=True,
        timeout=SUBPROCESS_TIMEOUT_S,
    )

    if proc.returncode != 2:
        fail(f"expected returncode 2 (phase gate fails on rejected timeout_seconds), "
             f"got {proc.returncode} (stdout={proc.stdout!r}, stderr={proc.stderr!r})")
    if "G_HUGE" not in proc.stdout:
        fail(f"expected stdout to mention G_HUGE, got stdout={proc.stdout!r}")
    if "FAIL" not in proc.stdout:
        fail(f"expected stdout to mention FAIL, got stdout={proc.stdout!r}")

    print(f"PASS: gate --run-checks rejects over-max timeout_seconds through the "
          f"check_cmd delegation path (returncode={proc.returncode})")
    sys.exit(0)


if __name__ == "__main__":
    main()
