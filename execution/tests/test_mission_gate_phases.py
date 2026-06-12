import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

# Ensure we're in the project root for consistent pathing
if not Path("execution/mission.py").exists():
    print("ERROR: Must run this script from the project root.", file=sys.stderr)
    sys.exit(1)

MISSIONS_DIR = Path(".agent/memory/project/missions")
SPECS_DIR = Path(".agent/memory/project/specs")
CONTRACT_PY = Path("execution/contract.py")
MISSION_PY = Path("execution/mission.py")

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def create_temp_contract(contract_path: Path, dummy_file_paths: list[Path]):
    """Generates a contract with assertions for multiple phases."""
    contract_content = {
        "schema": "athanor.contract/v1",
        "created_at": now_iso(),
        "spec": "test-contract-multi-phase",
        "assertions": []
    }

    # Generate assertions for each phase
    for i, dummy_file in enumerate(dummy_file_paths):
        phase = i + 1
        assertion_id = f"A{phase}"
        contract_content["assertions"].append({
            "id": assertion_id,
            "description": f"Check for existence of {dummy_file.name} (Phase {phase})",
            "verify": {
                "kind": "file_exists",
                "path": str(dummy_file)
            }
        })
    
    # Manually define phases for clarity and to ensure full coverage
    contract_content["phases"] = [
        {"id": 1, "assertions": ["A1"]},
        {"id": 2, "assertions": ["A2"]},
        {"id": 3, "assertions": ["A3"]},
    ]

    with open(contract_path, "w") as f:
        json.dump(contract_content, f, indent=2)
    print(f"Created temporary contract: {contract_path}")

def create_temp_mission(mission_path: Path, contract_path: Path):
    """Generates a mission file referencing the temporary contract."""
    mission_content = {
        "schema": "athanor.mission/v1",
        "slug": "test-mission-gate-phases",
        "goal": "Test multi-phase contract enforcement in mission.py gate",
        "created_at": now_iso(),
        "started_at": None,
        "last_active_at": None,
        "status": "pending",
        "cost_estimate": {
            "features": 1,
            "milestones": 1,
            "total_calls": 3, # 1 feature + 2 (gate+wrap)
        },
        "last_checkpoint": {
            "milestone": None,
            "feature": None,
            "ts": None,
        },
        "features": [
            {
                "id": "F1",
                "title": "Verify multi-phase contract gate",
                "status": "in_progress", # Set to in_progress to allow gate to run
                "contract": str(contract_path),
            }
        ],
        "milestones": [
            {
                "id": "M1",
                "name": "Initial Gate Test",
                "status": "pending",
                "features": ["F1"],
            }
        ],
    }
    
    fm_str = json.dumps(mission_content, indent=2)
    body = "
# Mission: Test Multi-Phase Contract Gate

## Context

This mission is for testing purposes only.

## Notes

"
    
    # Use a basic YAML-like dump for the frontmatter since mission.py expects YAML
    # and we want to avoid extra dependencies for simple test creation.
    # This is a simplification; a full YAML library should be used for complex cases.
    fm_lines = ["---"]
    for k, v in mission_content.items():
        if isinstance(v, dict) or isinstance(v, list):
            fm_lines.append(json.dumps({k:v}, indent=2).strip('{}')) # Simplified
        else:
            fm_lines.append(f"{k}: {json.dumps(v)}")

    # Special handling for lists and nested dicts to make it look more YAML-ish
    fm_lines = []
    fm_lines.append("---")
    fm_lines.append(f"schema: {mission_content['schema']}")
    fm_lines.append(f"slug: {mission_content['slug']}")
    fm_lines.append(f"goal: {mission_content['goal']}")
    fm_lines.append(f"created_at: {mission_content['created_at']}")
    fm_lines.append(f"started_at: {mission_content['started_at']}")
    fm_lines.append(f"last_active_at: {mission_content['last_active_at']}")
    fm_lines.append(f"status: {mission_content['status']}")
    fm_lines.append(f"cost_estimate:")
    for ck, cv in mission_content['cost_estimate'].items():
        fm_lines.append(f"  {ck}: {cv}")
    fm_lines.append(f"last_checkpoint:")
    for ck, cv in mission_content['last_checkpoint'].items():
        fm_lines.append(f"  {ck}: {json.dumps(cv) if isinstance(cv, str) else str(cv)}") # Handle null properly
    fm_lines.append(f"features:")
    for feat in mission_content['features']:
        fm_lines.append(f"  - id: {feat['id']}")
        fm_lines.append(f"    title: {feat['title']}")
        fm_lines.append(f"    status: {feat['status']}")
        fm_lines.append(f"    contract: {feat['contract']}")
    fm_lines.append(f"milestones:")
    for mile in mission_content['milestones']:
        fm_lines.append(f"  - id: {mile['id']}")
        fm_lines.append(f"    name: {mile['name']}")
        fm_lines.append(f"    status: {mile['status']}")
        fm_lines.append(f"    features:")
        for f_id in mile['features']:
            fm_lines.append(f"      - {f_id}")
    
    fm_lines.append("---")
    final_content = "
".join(fm_lines) + body

    with open(mission_path, "w") as f:
        f.write(final_content)
    print(f"Created temporary mission: {mission_path}")

def run_test():
    with tempfile.TemporaryDirectory() as tmpdir_str:
        tmpdir = Path(tmpdir_str)
        print(f"Using temporary directory: {tmpdir}")

        temp_mission_path = tmpdir / "test-mission-gate-phases.md"
        temp_contract_dir = tmpdir / "test-contract"
        temp_contract_dir.mkdir()
        temp_contract_path = temp_contract_dir / "contract.yaml"

        dummy_files = [
            tmpdir / "test_file_phase1.txt",
            tmpdir / "test_file_phase2.txt",
            tmpdir / "test_file_phase3.txt",
        ]

        # 1. Create dummy files
        for f in dummy_files:
            f.touch()
            print(f"Created dummy file: {f}")

        # 2. Create the contract
        create_temp_contract(temp_contract_path, dummy_files)

        # 3. Create the mission
        create_temp_mission(temp_mission_path, temp_contract_path)

        # 4. Run mission.py gate and verify
        print(f"
Running: python3 {MISSION_PY} gate {temp_mission_path} --milestone M1")
        result = subprocess.run(
            [sys.executable, str(MISSION_PY), "gate", str(temp_mission_path), "--milestone", "M1"],
            capture_output=True, text=True
        )

        print("--- mission.py gate stdout ---")
        print(result.stdout)
        print("--- mission.py gate stderr ---")
        print(result.stderr)

        if result.returncode == 0:
            print(f"
✅ Test passed: mission.py gate returned 0.")
            # Additionally verify output contains PASS for all assertions
            if "PASS A1" in result.stdout and "PASS A2" in result.stdout and "PASS A3" in result.stdout:
                print("✅ All assertions (A1, A2, A3) reported as PASSED in output.")
            else:
                print("❌ ERROR: Expected 'PASS A1', 'PASS A2', 'PASS A3' not found in stdout.")
                sys.exit(1)
        else:
            print(f"
❌ Test failed: mission.py gate returned non-zero exit code {result.returncode}.")
            sys.exit(1)

        # Clean up results created by contract.py
        contract_slug = "test-contract-multi-phase"
        contract_results_dir = Path(".agent/memory/scratch/contract-results") / contract_slug
        if contract_results_dir.exists():
            print(f"Cleaning up contract results in {contract_results_dir}")
            for f in contract_results_dir.glob("*.json"):
                f.unlink()
            contract_results_dir.rmdir()


if __name__ == "__main__":
    run_test()
