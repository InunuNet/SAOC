#!/usr/bin/env bash
# Layer 2: handoffs.py accepts v1-lite handoff (no left_undone or procedures_followed required)
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh

echo "=== test_handoff_v1_lite_accept.sh ==="

FIXTURE="execution/tests/layer2_fixture/fixtures/handoff_v1_lite_valid.txt"

FIXTURE_CONTENT=$(cat "$FIXTURE")
PAYLOAD=$(python3 -c "
import json, sys
content = sys.stdin.read()
print(json.dumps({'agent_type': 'qa', 'last_assistant_message': content}))
" <<< "$FIXTURE_CONTENT")

OUTPUT=$(echo "$PAYLOAD" | python3 execution/handoffs.py 2>&1)
ACTUAL_EXIT=$?

assert_exit "handoffs.py exits 0 for v1-lite handoff" 0 $ACTUAL_EXIT

# Ensure it was accepted (not rejected)
assert_output_not_contains "v1-lite not rejected for missing left_undone" "validation failed" "$OUTPUT"

summary
