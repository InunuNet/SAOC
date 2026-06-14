import subprocess
import sys
import os
from pathlib import Path

def main():
    if len(sys.argv) < 3:
        print("Usage: verify_mission_new_fails_on_duplicate_slug.py <slug> <goal>")
        sys.exit(1)

    slug_to_check = sys.argv[1]
    goal_for_new = sys.argv[2]

    # Temporarily set MISSIONS_DIR to use the golden files location for the check
    # This might require some adjustments if mission.py doesn't respect environment variables
    # For now, let's assume the check is run from a context where goldens are present in the expected place.

    # Run mission.py new and capture output and exit code
    command = [
        sys.executable,
        "execution/mission.py",
        "new",
        goal_for_new,
        "--slug",
        slug_to_check,
    ]
    
    # Pre-clean any potential mission file created by a previous failed test run
    # This is a bit of a hack but ensures a clean state for the check
    # Get today's date prefix for the mission file
    from datetime import datetime, timezone
    date_prefix = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    potential_new_file = Path(".agent/memory/project/missions") / f"{date_prefix}-{slug_to_check}.md"
    if potential_new_file.exists():
        potential_new_file.unlink()

    # Execute the command
    result = subprocess.run(command, capture_output=True, text=True)

    # Check exit code
    if result.returncode != 1:
        print(f"ERROR: Expected mission.py new to exit with code 1, but got {result.returncode}")
        print("STDOUT:", result.stdout)
        print("STDERR:", result.stderr)
        sys.exit(1)

    # Check for the specific error message
    expected_error_message = f"ERROR: mission slug '{slug_to_check}' already exists"
    if expected_error_message not in result.stderr:
        print(f"ERROR: Expected error message '{expected_error_message}' not found in stderr.")
        print("STDOUT:", result.stdout)
        print("STDERR:", result.stderr)
        sys.exit(1)
        
    # Verify that no new mission file was actually created
    # This check is crucial as mission.py new might print an error but still create the file in a faulty implementation
    # The new file would be in the actual MISSIONS_DIR, not the golden directory
    if potential_new_file.exists():
        print(f"ERROR: A new mission file {potential_new_file} was created unexpectedly despite the error.")
        sys.exit(1)


    print(f"SUCCESS: mission.py new correctly failed for duplicate slug '{slug_to_check}'")
    sys.exit(0)

if __name__ == "__main__":
    # Ensure the checks directory exists
    Path("execution/checks").mkdir(parents=True, exist_ok=True)
    main()

