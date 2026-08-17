#!/usr/bin/env python3
"""verify_check_zero_timeout_not_truthy.py -- contract-timeout-honored F2.

DECISION.md F2: check_cmd() must resolve timeout_seconds with `is not
None`, not truthiness -- `verify.get("timeout_seconds") or <default>`
silently discards a legitimately declared 0. Real execution against
goldens/fixture_zero_timeout.yaml (Z1: `true`, timeout_seconds: 0).
Asserts the real check_cmd() call kills Z1 immediately: verdict=fail,
evidence mentions "timed out after 0s".
"""
import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "execution"))

import contract  # noqa: E402

FIXTURE = REPO_ROOT / ".agent" / "memory" / "project" / "specs" / \
    "contract-timeout-honored" / "goldens" / "fixture_zero_timeout.yaml"


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    if not FIXTURE.exists():
        fail(f"fixture not found: {FIXTURE}")

    check_args = argparse.Namespace(
        contract=str(FIXTURE),
        assertion="Z1",
        handoff=None,
        timeout_seconds=60,  # CLI default -- Z1's declared 0 must win, not this
    )
    try:
        contract.check_cmd(check_args)
    except SystemExit:
        pass

    c = contract.load_contract(str(FIXTURE))
    rf = contract.result_file(c, "Z1")
    if not rf.exists():
        fail(f"no result file written for Z1: {rf}")
    result = json.loads(rf.read_text())

    verdict = result.get("verdict")
    evidence = result.get("evidence", "")
    if verdict != "fail":
        fail(f"expected verdict=fail (0s timeout must kill immediately), "
             f"got verdict={verdict!r}, evidence={evidence!r}")
    if "timed out after 0s" not in evidence:
        fail(f"expected evidence to mention 'timed out after 0s', got {evidence!r}")

    print(f"PASS: Z1's declared timeout_seconds=0 was honored -- verdict={verdict}, "
          f"evidence={evidence!r}")
    sys.exit(0)


if __name__ == "__main__":
    main()
