#!/usr/bin/env bash

# This script verifies the fix for GitHub Issue #1274 in require_docs.sh.
# It checks if the hook incorrectly triggers for commands containing "gate"
# but not explicitly starting with "contract.py gate".

# Create a dummy JSON input for the hook
DUMMY_INPUT='{"tool_input": {"command": "echo some_command with gate in it"}}'

# Run the hook with the dummy input and capture its exit code
echo "$DUMMY_INPUT" | ./execution/hooks/require_docs.sh

# Check the exit code
# If the fix is correct, the hook should exit with 0 (not trigger)
# If the fix is NOT correct, the hook would incorrectly trigger and potentially exit with a non-zero code if it tried to run handoff_check.py
if [ $? -eq 0 ]; then
  echo "Verification successful: require_docs.sh did NOT trigger for an unrelated command containing 'gate'."
  exit 0
else
  echo "Verification FAILED: require_docs.sh incorrectly triggered for an unrelated command containing 'gate'."
  exit 1
fi
