#!/usr/bin/env python3
"""Regression check for mission.py's _existing_contract_for_feature CWD anchoring.

Loads mission.py by absolute path (so the import itself is CWD-independent),
then calls _existing_contract_for_feature() while the process CWD is set to
an unrelated temp directory. Before the fix this returns None (the specs
path resolves relative to the temp CWD); after the fix it must resolve the
real contract on disk regardless of CWD.

Usage: python3 verify_contract_cwd_anchor.py
Exits 0 and prints PASS on success, exits 1 and prints FAIL on failure.
"""
import importlib.util
import os
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MISSION_PY = REPO_ROOT / "execution" / "mission.py"
SLUG = "mission-contract-lookup-cwd-anchor"
FEATURE_ID = "F1"
EXPECTED_CONTRACT = REPO_ROOT / ".agent/memory/project/specs" / SLUG / "contract-f1.yaml"


def load_mission_module():
    spec = importlib.util.spec_from_file_location("mission_under_test", str(MISSION_PY))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main():
    if not EXPECTED_CONTRACT.exists():
        print(f"FAIL: expected contract fixture missing: {EXPECTED_CONTRACT}")
        return 1

    mission = load_mission_module()
    fm = {"slug": SLUG}

    original_cwd = os.getcwd()
    tmpdir = tempfile.mkdtemp(prefix="cwd-anchor-check-")
    try:
        os.chdir(tmpdir)
        result_from_tmp = mission._existing_contract_for_feature(fm, FEATURE_ID)
    finally:
        os.chdir(original_cwd)

    if result_from_tmp is None:
        print(
            "FAIL: _existing_contract_for_feature returned None when invoked "
            f"from a non-repo-root CWD ({tmpdir}); expected {EXPECTED_CONTRACT}"
        )
        return 1

    if Path(result_from_tmp).resolve() != EXPECTED_CONTRACT.resolve():
        print(
            f"FAIL: resolved contract path mismatch.\n  got:      {result_from_tmp}\n"
            f"  expected: {EXPECTED_CONTRACT}"
        )
        return 1

    # Same-CWD (repo-root) invocation must keep working identically.
    os.chdir(REPO_ROOT)
    try:
        result_from_root = mission._existing_contract_for_feature(fm, FEATURE_ID)
    finally:
        os.chdir(original_cwd)

    if result_from_root is None or Path(result_from_root).resolve() != EXPECTED_CONTRACT.resolve():
        print(
            f"FAIL: repo-root invocation regressed. got: {result_from_root!r}, "
            f"expected: {EXPECTED_CONTRACT}"
        )
        return 1

    print("PASS: _existing_contract_for_feature resolves the contract independent of CWD")
    return 0


if __name__ == "__main__":
    sys.exit(main())
