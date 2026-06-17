#!/usr/bin/env bash

HOOK_SCRIPT="./execution/hooks/require_docs.sh"

run_test() {
  TEST_COMMAND=$1
  EXPECTED_EXIT_CODE=$2
  DESCRIPTION=$3

  echo "--- Running test: $DESCRIPTION ---"
  
  # Manually construct the JSON input, removing jq dependency
  # The hook expects a JSON object with "tool_input" containing "command"
  JSON_INPUT='{"tool_input":{"command":"'"$TEST_COMMAND"'"}}'
  
  # Execute the hook script with the simulated input
  echo "$JSON_INPUT" | "$HOOK_SCRIPT"
  ACTUAL_EXIT_CODE=$?

  if [ "$ACTUAL_EXIT_CODE" -eq "$EXPECTED_EXIT_CODE" ]; then
    echo "SUCCESS: Command '$TEST_COMMAND' (Expected: $EXPECTED_EXIT_CODE, Actual: $ACTUAL_EXIT_CODE)"
  else
    echo "FAILURE: Command '$TEST_COMMAND' (Expected: $EXPECTED_EXIT_CODE, Actual: $ACTUAL_EXIT_CODE)"
    exit 1
  fi
  }

# Test cases for the fixed hook
# These should NOT trigger the hook, so the script should exit 0
run_test "some_other_command gate" 0 "Command containing 'gate' but not 'contract.py gate'"
run_test "mycontract.py gate" 0 "Command with 'contract.py gate' as substring"
run_test "contract.py some_gate" 0 "Command with 'gate' but not after 'contract.py'"
run_test "just some text" 0 "Completely unrelated command"

echo "--- Verifying positive matches (should trigger the hook) ---"

run_positive_test() {
  TEST_COMMAND=$1
  DESCRIPTION=$3

  echo "--- Running positive test: $DESCRIPTION ---"
  # Manually construct the JSON input, removing jq dependency
  JSON_INPUT='{"tool_input":{"command":"'"$TEST_COMMAND"'"}}'
  
  echo "$JSON_INPUT" | "$HOOK_SCRIPT"
  ACTUAL_EXIT_CODE=$?

  if [ "$ACTUAL_EXIT_CODE" -ne 0 ]; then # Expecting non-zero if handoff_check fails (i.e., hook was triggered)
    echo "SUCCESS: Command '$TEST_COMMAND' triggered hook (Expected non-0, Actual: $ACTUAL_EXIT_CODE)"
  else
    echo "FAILURE: Command '$TEST_COMMAND' did NOT trigger hook (Expected non-0, Actual: $ACTUAL_EXIT_CODE)"
    exit 1
  fi
  echo ""
}

# These should trigger the hook
run_positive_test "contract.py gate" "Exact match 'contract.py gate'"
run_positive_test "contract.py gate --phase all" "Prefix match 'contract.py gate' with args"

echo "All tests passed!"
