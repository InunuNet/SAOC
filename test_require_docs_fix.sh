#!/usr/bin/env bash

# Test script for require_docs.sh hook fix

HOOK_SCRIPT="execution/hooks/require_docs.sh"

echo "--- Testing require_docs.sh fix ---"

# Test case 1: Command that should NOT trigger the hook (substring match only)
echo "Test 1: 'echo contract.py gate' (should NOT trigger)"
INPUT_JSON='{"tool_code":"Bash","tool_name":"Bash","tool_input":{"command":"echo contract.py gate"}}'
echo "$INPUT_JSON" | "$HOOK_SCRIPT"
RESULT=$?
if [ "$RESULT" -eq 0 ]; then
  echo "PASS: Hook did NOT trigger for 'echo contract.py gate'"
else
  echo "FAIL: Hook triggered for 'echo contract.py gate' (exit code $RESULT)"
  exit 1
fi

echo ""

# Test case 2: Command that SHOULD trigger the hook (exact prefix match)
echo "Test 2: 'python3 execution/contract.py gate' (should trigger)"
INPUT_JSON='{"tool_code":"Bash","tool_name":"Bash","tool_input":{"command":"python3 execution/contract.py gate"}}'
echo "$INPUT_JSON" | "$HOOK_SCRIPT"
RESULT=$?
if [ "$RESULT" -ne 0 ]; then
  echo "PASS: Hook DID trigger for 'python3 execution/contract.py gate' (exit code $RESULT)"
else
  echo "FAIL: Hook did NOT trigger for 'python3 execution/contract.py gate' (exit code $RESULT)"
  exit 1
fi

echo ""

# Test case 3: Command that SHOULD trigger the hook with arguments
echo "Test 3: 'python3 execution/contract.py gate --phase all' (should trigger)"
INPUT_JSON='{"tool_code":"Bash","tool_name":"Bash","tool_input":{"command":"python3 execution/contract.py gate --phase all"}}'
echo "$INPUT_JSON" | "$HOOK_SCRIPT"
RESULT=$?
if [ "$RESULT" -ne 0 ]; then
  echo "PASS: Hook DID trigger for 'python3 execution/contract.py gate --phase all' (exit code $RESULT)"
else
  echo "FAIL: Hook did NOT trigger for 'python3 execution/contract.py gate --phase all' (exit code $RESULT)"
  exit 1
fi

echo ""

echo "All tests passed for require_docs.sh fix."
