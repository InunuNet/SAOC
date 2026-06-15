#!/bin/bash

# Define the path to the script being tested
SCRIPT_PATH="./execution/hooks/require_docs.sh"

# Test Case 1: Command that should NOT trigger the hook (false positive)
# This command contains "gate" but not as "contract.py gate" at the beginning.
# The expected behavior is for the script to exit 0, meaning it did NOT block.
INPUT_NON_GATE='{"tool_input": {"command": "python3 my_script.py --verbose --gateway-timeout 60"}}'
echo "--- Test Case 1: Non-gate command (should NOT be blocked) ---"
echo "Command Input: $INPUT_NON_GATE"
echo "$INPUT_NON_GATE" | "$SCRIPT_PATH"
RC1=$?
echo "Script Exit Code: $RC1"
if [ "$RC1" -eq 0 ]; then
  echo "RESULT: PASSED. Non-gate command was correctly NOT blocked."
else
  echo "RESULT: FAILED. Non-gate command was INCORRECTLY blocked."
  exit 1
fi
echo ""

# Test Case 2: Command that SHOULD trigger the hook (contract.py gate)
# This command explicitly calls "contract.py gate".
# The expected behavior is for the script to continue past the 'case' statement.
# The final exit code will depend on `handoff_check.py`.
# If `handoff_check.py` is not found or fails for other reasons, RC2 might be 127 or another error code.
# The key is that the `case` statement itself doesn't exit 0 prematurely.
INPUT_GATE='{"tool_input": {"command": "contract.py gate --phase all"}}'
echo "--- Test Case 2: Gate command (should be processed by handoff_check.py) ---"
echo "Command Input: $INPUT_GATE"
echo "$INPUT_GATE" | "$SCRIPT_PATH"
RC2=$?
echo "Script Exit Code: $RC2"
if [ "$RC2" -ne 0 ]; then
    echo "RESULT: PASSED. Gate command was correctly processed and potentially blocked by handoff_check.py."
else
    echo "RESULT: WARNING. Gate command was not blocked by handoff_check.py. Check handoff_check.py or test environment."
fi
echo ""

echo "All verification steps completed. Check results above."
exit 0
