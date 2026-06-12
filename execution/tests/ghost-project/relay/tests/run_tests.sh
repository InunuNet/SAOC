#!/usr/bin/env bash
# run_tests.sh — Run Relay test suite and report PASS/FAIL N/10
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELAY_DIR="$(dirname "$SCRIPT_DIR")"

cd "$RELAY_DIR"

echo "=== Relay Health Checker Test Suite ==="
echo ""

# Run test suite and capture output
OUTPUT=$(python3 tests/test_relay.py 2>&1)
EXIT_CODE=$?

echo "$OUTPUT"
echo ""

# Extract results line
RESULTS_LINE=$(echo "$OUTPUT" | grep -E "^Results:" | tail -1)
if [[ -z "$RESULTS_LINE" ]]; then
    echo "FAIL: Could not parse test results"
    exit 1
fi

# Parse N/10
PASSED=$(echo "$RESULTS_LINE" | grep -oE "[0-9]+/[0-9]+" | head -1)
N=$(echo "$PASSED" | cut -d/ -f1)
TOTAL=$(echo "$PASSED" | cut -d/ -f2)

if [[ "$N" == "$TOTAL" ]]; then
    echo "PASS $N/$TOTAL"
    exit 0
else
    echo "FAIL $N/$TOTAL"
    exit 1
fi
