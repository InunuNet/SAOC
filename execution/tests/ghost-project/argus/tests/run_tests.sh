#!/usr/bin/env bash
# Argus test runner — reports PASS N/10 or FAIL N/10
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARGUS_DIR="$(dirname "$SCRIPT_DIR")"

echo "Running Argus test suite..."
echo "  argus.py: $ARGUS_DIR/argus.py"
echo "  tests:    $SCRIPT_DIR/test_argus.py"
echo ""

cd "$ARGUS_DIR"

# Run tests and capture output
OUTPUT=$(python3 "$SCRIPT_DIR/test_argus.py" 2>&1)
EXIT_CODE=$?

echo "$OUTPUT"

# Count pass/fail from output
PASS_COUNT=$(echo "$OUTPUT" | grep -c '^\[OK\]' || true)
FAIL_COUNT=$(echo "$OUTPUT" | grep -c '^\[FAIL\]' || true)
TOTAL=$((PASS_COUNT + FAIL_COUNT))

echo ""
if [ "$EXIT_CODE" -eq 0 ]; then
    echo "PASS ${PASS_COUNT}/${TOTAL}"
    exit 0
else
    echo "FAIL ${PASS_COUNT}/${TOTAL}"
    exit 1
fi
