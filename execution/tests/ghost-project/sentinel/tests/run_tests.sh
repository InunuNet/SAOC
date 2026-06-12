#!/usr/bin/env bash
# Sentinel test runner — runs all 15 assertions and reports pass/fail.
# Usage: cd execution/tests/ghost-project/sentinel && bash tests/run_tests.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SENTINEL_DIR="$(dirname "$SCRIPT_DIR")"

echo "Running Sentinel tests..."
echo "  Sentinel: $SENTINEL_DIR/sentinel.py"
echo "  Python:   $(python3 --version)"
echo ""

cd "$SENTINEL_DIR"

# Capture output and exit code
set +e
output=$(python3 tests/test_sentinel.py 2>&1)
exit_code=$?
set -e

echo "$output"
echo ""

# Extract pass/fail counts from final summary line
summary_line=$(echo "$output" | grep -E '^(PASS|FAIL) [0-9]+/15' | tail -1)

if [ -z "$summary_line" ]; then
    echo "ERROR: could not parse test summary line"
    exit 1
fi

if echo "$summary_line" | grep -q '^PASS'; then
    echo "==> $summary_line"
    exit 0
else
    echo "==> $summary_line"
    exit 1
fi
