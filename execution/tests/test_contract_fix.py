#!/usr/bin/env python3
"""
test_contract_fix.py — Test for the mission.py gate command's --phase all logic.
Run from project root: python3 execution/tests/test_contract_fix.py
"""
import json
import os
import subprocess
import sys
import tempfile
import shutil
from pathlib import Path

CONTRACT_CLI = ["python3", "execution/contract.py"]
MISSIONS_DIR = Path(".agent/memory/project/missions")
TEMP_CONTRACTS_DIR = Path(".agent/memory/scratch/test_contracts")

PASS = 0
FAIL = 0

def ok(label: str, passed: bool, detail: str = ""):
    global PASS, FAIL
    if passed:
        PASS += 1
        print(f"  PASS  {label}")
    else:
        FAIL += 1
        print(f"  FAIL  {label}" + (f" — {detail}" if detail else ""))

def assert_exit(label: str, result, expected: int):
    ok(label, result.returncode == expected,
       f"exit={result.returncode} expected={expected}\\nstdout: {result.stdout[:500]}\\nstderr: {result.stderr[:500]}")

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, cwd=Path(__file__).parent.parent.parent)

def create_contract_file(contract_data: dict, filename: str) -> Path:
    TEMP_CONTRACTS_DIR.mkdir(parents=True, exist_ok=True)
    contract_path = TEMP_CONTRACTS_DIR / filename
    with open(contract_path, "w") as f:
        json.dump(contract_data, f, indent=2) # Use json for simplicity, contract.py handles both
    return contract_path

def main():
    global PASS, FAIL
    print("=== test_contract_fix.py ===")
    print()

    # Clean up any previous test artifacts
    if TEMP_CONTRACTS_DIR.exists():
        shutil.rmtree(TEMP_CONTRACTS_DIR)
    if MISSIONS_DIR.exists():
        shutil.rmtree(MISSIONS_DIR)
    MISSIONS_DIR.mkdir(parents=True, exist_ok=True)


    # Test 1: Contract with explicit phases - ensure all are gated
    print("\nTest 1: Contract with explicit multiple phases")
    multi_phase_contract = {
        "schema": "athanor.contract/v1",
        "slug": "multi-phase-test",
        "goal": "Test multiple phases",
        "created_at": "2023-01-01T00:00:00Z",
        "assertions": [
            {"id": "A1", "description": "Check file exists", "verify": {"kind": "file_exists", "path": "README.md"}},
            {"id": "A2", "description": "Check something else", "verify": {"kind": "shell", "cmd": "exit 0"}},
            {"id": "A3", "description": "Check non-existent file", "verify": {"kind": "file_exists", "path": "NON_EXISTENT_FILE.md"}},
        ],
        "phases": [
            {"id": 1, "assertions": ["A1"]},
            {"id": 2, "assertions": ["A2", "A3"]},
        ]
    }
    contract_path_mp = create_contract_file(multi_phase_contract, "multi_phase.json")
    
    # Pre-run checks for A1 and A2, A3 to create result files for gate
    r_a1 = run(CONTRACT_CLI + ["check", str(contract_path_mp), "--assertion", "A1"])
    assert_exit("A1 check exits 0 (pass)", r_a1, 0)
    r_a2 = run(CONTRACT_CLI + ["check", str(contract_path_mp), "--assertion", "A2"])
    assert_exit("A2 check exits 0 (pass)", r_a2, 0)
    r_a3 = run(CONTRACT_CLI + ["check", str(contract_path_mp), "--assertion", "A3"])
    assert_exit("A3 check exits 1 (fail)", r_a3, 1)

    # Now run gate --phase all
    r_gate_mp_all = run(CONTRACT_CLI + ["gate", str(contract_path_mp), "--phase", "all"])
    assert_exit("gate --phase all for multi-phase contract exits 2 (fail due to A3)", r_gate_mp_all, 2)
    ok("gate --phase all output shows multiple phases gated", "Gating Phase 1" in r_gate_mp_all.stdout and "Gating Phase 2" in r_gate_mp_all.stdout)
    ok("gate --phase all output shows overall fail", "FAIL Phase 2" in r_gate_mp_all.stdout and "FAIL: Phase 2 failed. Stopping all-phase gate." in r_gate_mp_all.stdout)


    # Test 2: Contract in @architect single-phase format - ensure all assertions are gated
    print("\nTest 2: Contract in @architect single-phase format (no explicit phases block)")
    architect_contract = {
        "schema": "athanor.contract/v1",
        "slug": "architect-single-phase-test",
        "goal": "Test architect single phase format",
        "created_at": "2023-01-01T00:00:00Z",
        "assertions": {
            "phase": 1,
            "checks": [
                {"id": "AR1", "description": "Check README exists", "command": "grep -q 'README' README.md"},
                {"id": "AR2", "description": "Check non-existent file", "command": "test -f NON_EXISTENT_FILE_2.md"},
            ]
        }
    }
    contract_path_arch = create_contract_file(architect_contract, "architect_contract.json")

    # Run gate --phase all, with --run-checks to trigger execution
    # This should now group AR1 and AR2 into a single implicit phase and gate it.
    r_gate_arch_all = run(CONTRACT_CLI + ["gate", str(contract_path_arch), "--phase", "all", "--run-checks"])
    assert_exit("gate --phase all for architect contract exits 2 (fail due to AR2)", r_gate_arch_all, 2)
    ok("gate --phase all output shows single implicit phase", "INFO: No explicit multi-phase definition found. Gating all assertions as a single phase." in r_gate_arch_all.stdout)
    ok("gate --phase all output shows AR1 passing", "PASS AR1" in r_gate_arch_all.stdout)
    ok("gate --phase all output shows AR2 failing", "FAIL AR2" in r_gate_arch_all.stdout)
    ok("gate --phase all output shows overall fail", "FAIL Phase all_assertions gate FAILED" in r_gate_arch_all.stdout)


    # Test 3: Contract with no assertions
    print("\nTest 3: Contract with no assertions")
    empty_contract = {
        "schema": "athanor.contract/v1",
        "slug": "empty-test",
        "goal": "Test empty contract",
        "created_at": "2023-01-01T00:00:00Z",
        "assertions": []
    }
    contract_path_empty = create_contract_file(empty_contract, "empty_contract.json")
    r_gate_empty_all = run(CONTRACT_CLI + ["gate", str(contract_path_empty), "--phase", "all", "--run-checks"])
    assert_exit("gate --phase all for empty contract exits 0 (no assertions)", r_gate_empty_all, 0)
    ok("gate --phase all output mentions no assertions", "No assertions found in contract to gate." in r_gate_empty_all.stdout)

    print()
    print("========================================")
    print(f"Results: {PASS}/{PASS+FAIL} passed")
    if FAIL > 0:
        sys.exit(1)

if __name__ == "__main__":
    main()
