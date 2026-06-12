#!/usr/bin/env bash
# Escrow test runner — 5 test cases covering correctness and edge behaviour.
# Usage: bash execution/tests/ghost-project/escrow/tests/run_tests.sh
# Must be run from the Athanor project root, or from inside the escrow directory.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ESCROW_DIR="$(dirname "$SCRIPT_DIR")"
FIXTURES="$SCRIPT_DIR/fixtures"
ESCROW="$ESCROW_DIR/escrow.py"

pass=0
fail=0

run_test() {
    local name="$1"
    local result="$2"   # "pass" or "fail"
    if [ "$result" = "pass" ]; then
        echo "  PASS: $name"
        pass=$((pass + 1))
    else
        echo "  FAIL: $name"
        fail=$((fail + 1))
    fi
}

echo "Running Escrow tests..."
echo "  Escrow:   $ESCROW"
echo "  Python:   $(python3 --version)"
echo "  Fixtures: $FIXTURES"
echo ""

# ── Test 1: Basic fixture ────────────────────────────────────────────────────
actual=$(python3 "$ESCROW" "$FIXTURES/escrow_basic.txt" 2>&1)
exit_code=$?
expected=$(cat "$FIXTURES/escrow_basic_expected.txt")
if [ $exit_code -eq 0 ] && [ "$actual" = "$expected" ]; then
    run_test "basic fixture: correct output and exit 0" "pass"
else
    run_test "basic fixture: correct output and exit 0" "fail"
    if [ $exit_code -ne 0 ]; then
        echo "    exit code: $exit_code (expected 0)"
    fi
    if [ "$actual" != "$expected" ]; then
        echo "    diff (actual vs expected):"
        diff <(echo "$actual") <(echo "$expected") | sed 's/^/      /'
    fi
fi

# ── Test 2: Boundary fixture ─────────────────────────────────────────────────
actual=$(python3 "$ESCROW" "$FIXTURES/escrow_boundary.txt" 2>&1)
exit_code=$?
expected=$(cat "$FIXTURES/escrow_boundary_expected.txt")
if [ $exit_code -eq 0 ] && [ "$actual" = "$expected" ]; then
    run_test "boundary fixture: local clock wins over sender clock" "pass"
else
    run_test "boundary fixture: local clock wins over sender clock" "fail"
    if [ $exit_code -ne 0 ]; then
        echo "    exit code: $exit_code (expected 0)"
    fi
    if [ "$actual" != "$expected" ]; then
        echo "    diff (actual vs expected):"
        diff <(echo "$actual") <(echo "$expected") | sed 's/^/      /'
    fi
fi

# ── Test 3: RECV with no prior SEND → exit 2 ─────────────────────────────────
actual=$(python3 "$ESCROW" /dev/stdin 2>&1 <<'EOF'
A RECV B
EOF
)
exit_code=$?
if [ $exit_code -eq 2 ]; then
    run_test "RECV with no prior SEND exits 2" "pass"
else
    run_test "RECV with no prior SEND exits 2" "fail"
    echo "    exit code: $exit_code (expected 2)"
    echo "    output: $actual"
fi

# ── Test 4: Empty file → exit 0, empty output ────────────────────────────────
empty_file=$(mktemp)
actual=$(python3 "$ESCROW" "$empty_file" 2>&1)
exit_code=$?
rm -f "$empty_file"
if [ $exit_code -eq 0 ] && [ -z "$actual" ]; then
    run_test "empty file: exit 0 and no output" "pass"
else
    run_test "empty file: exit 0 and no output" "fail"
    echo "    exit code: $exit_code (expected 0)"
    echo "    output: '$actual' (expected empty)"
fi

# ── Test 5: Dangling SEND at EOF → exit 0 ────────────────────────────────────
actual=$(python3 "$ESCROW" /dev/stdin 2>&1 <<'EOF'
A INTERNAL
A SEND B
A INTERNAL
EOF
)
exit_code=$?
if [ $exit_code -eq 0 ]; then
    run_test "dangling SEND at EOF: exit 0 (unused SEND is not an error)" "pass"
else
    run_test "dangling SEND at EOF: exit 0 (unused SEND is not an error)" "fail"
    echo "    exit code: $exit_code (expected 0)"
    echo "    output: $actual"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
total=$((pass + fail))
echo ""
if [ $fail -eq 0 ]; then
    echo "PASS $pass/$total"
    exit 0
else
    echo "FAIL $pass/$total passed, $fail failed"
    exit 1
fi
