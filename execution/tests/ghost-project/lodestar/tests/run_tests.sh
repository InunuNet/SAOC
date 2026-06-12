#!/usr/bin/env bash
# Lodestar test runner — reports PASS N/11 or FAIL N/11
# Usage: bash tests/run_tests.sh (from lodestar/ directory)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LODESTAR_DIR="$(dirname "$SCRIPT_DIR")"
TEST_PY="$SCRIPT_DIR/test_lodestar.py"

echo "=== Lodestar Test Suite ==="
echo "Script: $LODESTAR_DIR/lodestar.py"
echo ""

output=$(python3 "$TEST_PY" 2>&1)
exit_code=$?

echo "$output"

# Parse pass/fail counts from output line "Results: N/11 passed"
if echo "$output" | grep -q "Results:"; then
    results_line=$(echo "$output" | grep "Results:")
    passed=$(echo "$results_line" | grep -oE '[0-9]+/[0-9]+' | cut -d/ -f1)
    total=$(echo "$results_line" | grep -oE '[0-9]+/[0-9]+' | cut -d/ -f2)
    failed=$((total - passed))

    echo ""
    if [ "$failed" -eq 0 ]; then
        echo "PASS $passed/$total"
        exit 0
    else
        echo "FAIL $passed/$total"
        exit 1
    fi
else
    echo "FAIL 0/11 (could not parse test output)"
    exit 1
fi
