#!/usr/bin/env python3
"""verify_gate_rejects_bad_timeout.py -- contract-timeout-honored F5, A2.

DECISION-F5.md: the check_cmd() guard against bad timeout_seconds must
also protect gate --run-checks, since _gate_single_phase() calls
check_cmd() in-process per assertion. Pre-fix, an over-max declared
timeout is silently accepted, the fast command finishes instantly, and
the phase gate PASSES -- the wrong outcome.

delivery-integrity F7 moved the goalposts here in a good way: gate_cmd now
runs contract.py's own `validate` as a precondition before gating starts at
all (nothing may gate an invalid contract). An over-max timeout_seconds is a
validate-time error, so the rejection now happens at that earlier gate --
returncode 1, "gate refuses to run" on stderr -- instead of surviving into
_gate_single_phase's per-assertion check_cmd delegation and failing there
with returncode 2. That delegation path is still real (a bad-but-schema-
legal timeout would still be caught there); this fixture just no longer
reaches it, because it is caught sooner.

Shells out to the real contract.py CLI (no mocking) against
goldens/fixture_gate_rejects_bad_timeout.yaml (G_HUGE: timeout_seconds
999999999999) and asserts:
  - returncode == 1 (gate refuses to run at all -- invalid contract)
  - combined stdout+stderr names both the offending assertion id (G_HUGE)
    and the actual reason (timeout_seconds exceeds max), not just any
    non-zero exit -- so this still fails if gate ever accepted a bad
    timeout, or rejected the fixture for an unrelated reason.
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

    combined = proc.stdout + proc.stderr

    if proc.returncode != 1:
        fail(f"expected returncode 1 (gate refuses to run on an invalid contract), "
             f"got {proc.returncode} (stdout={proc.stdout!r}, stderr={proc.stderr!r})")
    if "G_HUGE" not in combined:
        fail(f"expected output to name the offending assertion G_HUGE, "
             f"got stdout={proc.stdout!r} stderr={proc.stderr!r}")
    if "timeout_seconds exceeds max" not in combined:
        fail(f"expected output to name the actual reason (timeout_seconds exceeds max), "
             f"got stdout={proc.stdout!r} stderr={proc.stderr!r}")

    print(f"PASS: gate --run-checks refuses to run an over-max timeout_seconds contract "
          f"at all, via the validate precondition (returncode={proc.returncode})")
    sys.exit(0)


if __name__ == "__main__":
    main()
