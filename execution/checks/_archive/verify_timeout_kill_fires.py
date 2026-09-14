#!/usr/bin/env python3
"""verify_timeout_kill_fires.py -- contract-timeout-honored F1 (paired).

DECISION.md F1 paired check: a declared timeout_seconds must not just
reach subprocess.run's kwarg (see verify_timeout_reaches_subprocess.py) --
the kill must actually fire. Real execution, no mocking, against
goldens/fixture_kill_fires.yaml (K1: `sleep 6 && exit 0`,
timeout_seconds: 2). Asserts the real check_cmd() call kills K1 at 2s:
verdict=fail, evidence mentions "timed out after 2s".
"""
import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "execution"))

import contract  # noqa: E402

FIXTURE = REPO_ROOT / ".agent" / "memory" / "project" / "specs" / \
    "contract-timeout-honored" / "goldens" / "fixture_kill_fires.yaml"


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    if not FIXTURE.exists():
        fail(f"fixture not found: {FIXTURE}")

    check_args = argparse.Namespace(
        contract=str(FIXTURE),
        assertion="K1",
        handoff=None,
        timeout_seconds=60,  # CLI default -- K1's own declared 2s must win
    )
    try:
        contract.check_cmd(check_args)
    except SystemExit:
        pass

    c = contract.load_contract(str(FIXTURE))
    rf = contract.result_file(c, "K1")
    if not rf.exists():
        fail(f"no result file written for K1: {rf}")
    result = json.loads(rf.read_text())

    verdict = result.get("verdict")
    evidence = result.get("evidence", "")
    if verdict != "fail":
        fail(f"expected verdict=fail (killed at 2s), got verdict={verdict!r}, evidence={evidence!r}")
    if "timed out after 2s" not in evidence:
        fail(f"expected evidence to mention 'timed out after 2s', got {evidence!r}")

    print(f"PASS: K1 killed at declared 2s -- verdict={verdict}, evidence={evidence!r}")
    sys.exit(0)


if __name__ == "__main__":
    main()
