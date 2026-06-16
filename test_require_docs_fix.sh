#!/usr/bin/env bash

# This script verifies the fix for GitHub Issue #1274 in require_docs.sh.
# It checks if the hook incorrectly triggers for commands containing "gate"
# but not explicitly starting with "contract.py gate", and also verifies
# that it *does* trigger for legitimate "contract.py gate" commands.

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ALL_PASS=true

# --- Negative Test Case ---
echo "--- Running Negative Test Case ---"
DUMMY_INPUT_NEGATIVE='{"tool_input": {"command": "echo some_command with gate in it"}}'
echo -n "Testing 'echo some_command with gate in it': "
echo "$DUMMY_INPUT_NEGATIVE" | ./execution/hooks/require_docs.sh
if [ $? -eq 0 ]; then
  echo -e "${GREEN}PASS${NC}"
  echo "  (require_docs.sh did NOT trigger for an unrelated command containing 'gate')"
else
  echo -e "${RED}FAIL${NC}"
  echo "  (require_docs.sh incorrectly triggered for an unrelated command containing 'gate')"
  ALL_PASS=false
fi

echo ""

# --- Positive Test Case ---
echo "--- Running Positive Test Case ---"
DUMMY_INPUT_POSITIVE='{"tool_input": {"command": "contract.py gate"}}'
echo -n "Testing 'contract.py gate': "
echo "$DUMMY_INPUT_POSITIVE" | ./execution/hooks/require_docs.sh
# The hook calls handoff_check.py, which will likely exit with 1 if docs are not present,
# but the important part is that the hook *triggers* and calls it.
# If the hook doesn't trigger, it will exit 0. So we expect a non-zero exit code here.
if [ $? -ne 0 ]; then
  echo -e "${GREEN}PASS${NC}"
  echo "  (require_docs.sh correctly triggered for 'contract.py gate')"
else
  echo -e "${RED}FAIL${NC}"
  echo "  (require_docs.sh did NOT trigger for 'contract.py gate' when it should have)"
  ALL_PASS=false
fi

echo ""

if $ALL_PASS; then
  echo -e "${GREEN}All tests passed for require_docs.sh fix.${NC}"
  exit 0
else
  echo -e "${RED}One or more tests FAILED for require_docs.sh fix.${NC}"
  exit 1
fi
