#!/usr/bin/env python3
"""verify_check_rejects_bad_timeout.py -- contract-timeout-honored F5, A1.

DECISION-F5.md: validate_cmd()'s timeout_seconds rule was unreachable from
check_cmd() -- a guard outside the path it guards. Rejected values reached
subprocess.run() unguarded: bool -> timeout=1 (isinstance(True, int) is
True), False -> timeout=0 (instant kill), a string -> uncaught TypeError,
an absurd int -> silently accepted.

Shells out to the real contract.py CLI (no mocking) against
goldens/fixture_check_rejects_bad_timeout.yaml for each bad-shape
assertion (A_BOOL, A_FALSE, A_STR, A_HUGE) and asserts:
  - returncode == 1
  - stderr does NOT contain "Traceback" (rules out A_STR's pre-fix
    uncaught TypeError crash path)
  - the written result file has verdict == "fail" and evidence contains
    "Invalid timeout_seconds" (rules out pre-fix "ran and got killed"
    evidence text for A_BOOL/A_FALSE, and pre-fix "silently accepted"
    for A_HUGE)
Then A_GOOD (a legitimate in-range declaration) must still run normally:
returncode == 0, verdict == "pass" -- the fix must not collaterally
reject valid declarations.
"""
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PY = REPO_ROOT / "execution" / "contract.py"
FIXTURE = REPO_ROOT / ".agent" / "memory" / "project" / "specs" / \
    "contract-timeout-honored" / "goldens" / "fixture_check_rejects_bad_timeout.yaml"

sys.path.insert(0, str(REPO_ROOT / "execution"))
import contract  # noqa: E402

# Wall-clock ceiling for each subprocess call: must be well under the
# pre-fix A_BOOL 3s-sleep-vs-1s-kill window and the CLI's own 60s default,
# so a hang can't masquerade as a pass.
SUBPROCESS_TIMEOUT_S = 10

BAD_TIMEOUT_IDS = ["A_BOOL", "A_FALSE", "A_STR", "A_HUGE"]


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def clear_fixture() -> None:
    subprocess.run(
        [sys.executable, str(CONTRACT_PY), "clear", str(FIXTURE)],
        cwd=str(REPO_ROOT), capture_output=True, text=True,
    )


def run_check(assertion_id: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(CONTRACT_PY), "check", str(FIXTURE),
         "--assertion", assertion_id],
        cwd=str(REPO_ROOT), capture_output=True, text=True,
        timeout=SUBPROCESS_TIMEOUT_S,
    )


def load_result(assertion_id: str) -> dict:
    c = contract.load_contract(str(FIXTURE))
    rf = contract.result_file(c, assertion_id)
    if not rf.exists():
        fail(f"no result file written for {assertion_id}: {rf}")
    return json.loads(rf.read_text())


def main() -> None:
    if not FIXTURE.exists():
        fail(f"fixture not found: {FIXTURE}")

    clear_fixture()

    for aid in BAD_TIMEOUT_IDS:
        proc = run_check(aid)
        if proc.returncode != 1:
            fail(f"{aid}: expected returncode 1 (clean reject), got {proc.returncode} "
                 f"(stdout={proc.stdout!r}, stderr={proc.stderr!r})")
        if "Traceback" in proc.stderr:
            fail(f"{aid}: expected no traceback on stderr (clean FAIL, not an uncaught "
                 f"crash), got stderr={proc.stderr!r}")
        result = load_result(aid)
        verdict = result.get("verdict")
        evidence = result.get("evidence", "")
        if verdict != "fail":
            fail(f"{aid}: expected verdict=fail, got verdict={verdict!r} evidence={evidence!r}")
        if "Invalid timeout_seconds" not in evidence:
            fail(f"{aid}: expected evidence to contain 'Invalid timeout_seconds' "
                 f"(not a timeout-kill or crash evidence shape), got evidence={evidence!r}")
        print(f"  ok {aid}: rejected cleanly (evidence={evidence!r})")

    # Regression: a legitimate, in-range declared timeout must still run normally.
    proc = run_check("A_GOOD")
    if proc.returncode != 0:
        fail(f"A_GOOD: expected returncode 0 (regression: valid declaration must still "
             f"run), got {proc.returncode} (stdout={proc.stdout!r}, stderr={proc.stderr!r})")
    result = load_result("A_GOOD")
    verdict = result.get("verdict")
    if verdict != "pass":
        fail(f"A_GOOD: expected verdict=pass, got verdict={verdict!r}")
    print(f"  ok A_GOOD: ran normally (verdict={verdict})")

    print("PASS: check_cmd rejects bool/False/string/over-max timeout_seconds cleanly; "
          "a legitimate declaration still runs")
    sys.exit(0)


if __name__ == "__main__":
    main()
