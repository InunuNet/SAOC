#!/usr/bin/env bash
# ledger2 test runner
# Usage: bash execution/tests/ghost-project/ledger2/tests/run_tests.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LEDGER2_DIR="$(dirname "$SCRIPT_DIR")"
FIXTURES="$SCRIPT_DIR/fixtures"
LEDGER="$LEDGER2_DIR/ledger2.py"

pass=0
fail=0

check() {
    local name="$1"
    local result="$2"
    if [ "$result" = "PASS" ]; then
        echo "  PASS: $name"
        pass=$((pass + 1))
    else
        echo "  FAIL: $name"
        fail=$((fail + 1))
    fi
}

echo "Running ledger2 tests..."
echo "  Script: $LEDGER"
echo "  Python: $(python3 --version)"
echo ""

# -------------------------------------------------------------------
# Test 1: Basic fixture — diff actual vs expected
# -------------------------------------------------------------------
actual=$(python3 "$LEDGER" "$FIXTURES/ledger2_basic.txt" 2>/dev/null)
expected=$(cat "$FIXTURES/ledger2_basic_expected.txt")
# Strip trailing newline from expected for consistent comparison
expected="${expected%$'\n'}"
if [ "$actual" = "$expected" ]; then
    check "basic fixture output matches expected" "PASS"
else
    check "basic fixture output matches expected" "FAIL"
    echo "    --- expected ---"
    echo "$expected" | head -20
    echo "    --- actual ---"
    echo "$actual" | head -20
fi

# -------------------------------------------------------------------
# Test 2: Boundary fixture — diff actual vs expected
# -------------------------------------------------------------------
actual=$(python3 "$LEDGER" "$FIXTURES/ledger2_boundary.txt" 2>/dev/null)
expected=$(cat "$FIXTURES/ledger2_boundary_expected.txt")
expected="${expected%$'\n'}"
if [ "$actual" = "$expected" ]; then
    check "boundary fixture output matches expected" "PASS"
else
    check "boundary fixture output matches expected" "FAIL"
    echo "    --- expected ---"
    echo "$expected" | head -20
    echo "    --- actual ---"
    echo "$actual" | head -20
fi

# -------------------------------------------------------------------
# Test 3: COUNT_REAL_USER ≠ COUNT_MODEL_INPUT on basic fixture
#          Proves the two axes are independent
# -------------------------------------------------------------------
count_real_user=$(python3 "$LEDGER" "$FIXTURES/ledger2_basic.txt" 2>/dev/null | head -1)
count_model_input=$(python3 "$LEDGER" "$FIXTURES/ledger2_basic.txt" 2>/dev/null | sed -n '2p')
if [ "$count_real_user" != "$count_model_input" ]; then
    check "COUNT_REAL_USER != COUNT_MODEL_INPUT (independent axes)" "PASS"
else
    check "COUNT_REAL_USER != COUNT_MODEL_INPUT (independent axes)" "FAIL"
    echo "    Both returned: $count_real_user (expected different values)"
fi

# -------------------------------------------------------------------
# Test 4: AUDIT_AUTHOR 0 → exit 2
# -------------------------------------------------------------------
tmpfile=$(mktemp /tmp/ledger2_test.XXXXXX)
printf 'user\tprompt\thello\n\nAUDIT_AUTHOR 0\n' > "$tmpfile"
set +e
python3 "$LEDGER" "$tmpfile" 2>/dev/null
code=$?
set -e
rm -f "$tmpfile"
if [ "$code" = "2" ]; then
    check "AUDIT_AUTHOR 0 exits with code 2" "PASS"
else
    check "AUDIT_AUTHOR 0 exits with code 2" "FAIL"
    echo "    Got exit code: $code"
fi

# -------------------------------------------------------------------
# Test 5: AUDIT_AUTHOR out of range → exit 2
# -------------------------------------------------------------------
tmpfile=$(mktemp /tmp/ledger2_test.XXXXXX)
printf 'user\tprompt\thello\n\nAUDIT_AUTHOR 99\n' > "$tmpfile"
set +e
python3 "$LEDGER" "$tmpfile" 2>/dev/null
code=$?
set -e
rm -f "$tmpfile"
if [ "$code" = "2" ]; then
    check "AUDIT_AUTHOR 99 (out of range) exits with code 2" "PASS"
else
    check "AUDIT_AUTHOR 99 (out of range) exits with code 2" "FAIL"
    echo "    Got exit code: $code"
fi

# -------------------------------------------------------------------
# Test 6: Unknown ORIGIN → exit 2
# -------------------------------------------------------------------
tmpfile=$(mktemp /tmp/ledger2_test.XXXXXX)
printf 'robot\tprompt\thello\n\nCOUNT_REAL_USER\n' > "$tmpfile"
set +e
python3 "$LEDGER" "$tmpfile" 2>/dev/null
code=$?
set -e
rm -f "$tmpfile"
if [ "$code" = "2" ]; then
    check "Unknown ORIGIN 'robot' exits with code 2" "PASS"
else
    check "Unknown ORIGIN 'robot' exits with code 2" "FAIL"
    echo "    Got exit code: $code"
fi

# -------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------
total=$((pass + fail))
echo ""
if [ "$fail" = "0" ]; then
    echo "PASS $pass/$total"
    exit 0
else
    echo "FAIL $pass/$total passed, $fail failed"
    exit 1
fi
