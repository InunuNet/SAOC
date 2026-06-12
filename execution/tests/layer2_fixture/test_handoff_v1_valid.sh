#!/usr/bin/env bash
# Layer 2: handoffs.py accepts valid v1 handoff and writes to scratch/handoffs/
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh

echo "=== test_handoff_v1_valid.sh ==="

FIXTURE="execution/tests/layer2_fixture/fixtures/handoff_v1_valid.txt"
HANDOFFS_DIR=".agent/memory/scratch/handoffs"

mkdir -p "$HANDOFFS_DIR"
BEFORE=$(ls "$HANDOFFS_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')

# Wrap fixture content in the JSON payload handoffs.py expects
FIXTURE_CONTENT=$(cat "$FIXTURE")
PAYLOAD=$(python3 -c "
import json, sys
content = sys.stdin.read()
print(json.dumps({'agent_type': 'dev', 'last_assistant_message': content}))
" <<< "$FIXTURE_CONTENT")

OUTPUT=$(echo "$PAYLOAD" | python3 execution/handoffs.py 2>&1)
ACTUAL_EXIT=$?

assert_exit "handoffs.py exits 0 for valid v1 handoff" 0 $ACTUAL_EXIT

AFTER=$(ls "$HANDOFFS_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
if [ "$AFTER" -gt "$BEFORE" ]; then
  echo "  PASS handoff file written to $HANDOFFS_DIR (before: $BEFORE, after: $AFTER)"
  ((PASS++))
else
  echo "  FAIL no handoff file written (before: $BEFORE, after: $AFTER)"
  echo "  Output: $OUTPUT"
  ((FAIL++)); ERRORS+=("handoff file not written")
fi

summary
