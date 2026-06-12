#!/usr/bin/env bash
# chainlink test runner — 6 test cases.
# Usage: bash execution/tests/ghost-project/chainlink/tests/run_tests.sh
#        (from the Athanor repo root, or any path)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHAINLINK_DIR="$(dirname "$SCRIPT_DIR")"
FIXTURES="$SCRIPT_DIR/fixtures"
PY="$CHAINLINK_DIR/chainlink.py"

PASS=0
FAIL=0

run_test() {
    local name="$1"
    local result="$2"   # "pass" or "fail"
    if [ "$result" = "pass" ]; then
        echo "  PASS: $name"
        PASS=$((PASS + 1))
    else
        echo "  FAIL: $name"
        FAIL=$((FAIL + 1))
    fi
}

echo "Running chainlink tests..."
echo "  chainlink: $PY"
echo "  Python:    $(python3 --version)"
echo ""

# ── Test 1: Basic fixture (proves restart-from-original — SUCCESS shows PFX|hello, not PFX|PFX|...) ──
actual=$(python3 "$PY" "$FIXTURES/chainlink_basic_guardrails.txt" "$FIXTURES/chainlink_basic_input.txt" 2>&1)
expected=$(cat "$FIXTURES/chainlink_basic_expected.txt")
# Strip trailing newline from both for clean comparison
if [ "$(printf '%s' "$actual")" = "$(printf '%s' "$expected")" ]; then
    run_test "basic fixture (restart-from-original)" "pass"
else
    run_test "basic fixture (restart-from-original)" "fail"
    echo "    --- expected ---"
    printf '%s\n' "$expected"
    echo "    --- actual ---"
    printf '%s\n' "$actual"
fi

# ── Test 2: Boundary fixture (exhaustion path, counter_validate 5 > MAX_ATTEMPTS=4) ──
actual=$(python3 "$PY" "$FIXTURES/chainlink_boundary_guardrails.txt" "$FIXTURES/chainlink_boundary_input.txt" 2>&1)
expected=$(cat "$FIXTURES/chainlink_boundary_expected.txt")
if [ "$(printf '%s' "$actual")" = "$(printf '%s' "$expected")" ]; then
    run_test "boundary fixture (exhaustion path)" "pass"
else
    run_test "boundary fixture (exhaustion path)" "fail"
    echo "    --- expected ---"
    printf '%s\n' "$expected"
    echo "    --- actual ---"
    printf '%s\n' "$actual"
fi

# ── Test 3: First-attempt success (validate only, input contains substring) ──
# Create temp files
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

printf 'G1\tvalidate\thello\n' > "$tmp_dir/g.txt"
printf 'hello world\n' > "$tmp_dir/i.txt"

actual=$(python3 "$PY" "$tmp_dir/g.txt" "$tmp_dir/i.txt" 2>&1)
exit_code=$?

has_fail=$(echo "$actual" | grep -c "FAIL" || true)
has_success=$(echo "$actual" | grep -c "^SUCCESS:" || true)
attempts_line=$(echo "$actual" | grep "^ATTEMPTS:" | head -1)

if [ "$exit_code" -eq 0 ] && [ "$has_fail" -eq 0 ] && [ "$has_success" -eq 1 ] && [ "$attempts_line" = "ATTEMPTS: 1" ]; then
    run_test "first-attempt success (no FAIL lines, ATTEMPTS: 1)" "pass"
else
    run_test "first-attempt success (no FAIL lines, ATTEMPTS: 1)" "fail"
    echo "    exit_code=$exit_code has_fail=$has_fail has_success=$has_success attempts='$attempts_line'"
    echo "    output: $actual"
fi

# ── Test 4: Duplicate GUARDRAIL_ID → exit 2 ──
printf 'G1\tvalidate\tfoo\nG1\ttransform\tBAR\n' > "$tmp_dir/dup.txt"
printf 'foo\n' > "$tmp_dir/i2.txt"

set +e
python3 "$PY" "$tmp_dir/dup.txt" "$tmp_dir/i2.txt" > /dev/null 2>&1
dup_exit=$?
set -e

if [ "$dup_exit" -eq 2 ]; then
    run_test "duplicate GUARDRAIL_ID → exit 2" "pass"
else
    run_test "duplicate GUARDRAIL_ID → exit 2" "fail"
    echo "    got exit $dup_exit, expected 2"
fi

# ── Test 5: Unknown TYPE → exit 2 ──
printf 'G1\tunknown_type\tfoo\n' > "$tmp_dir/bad_type.txt"

set +e
python3 "$PY" "$tmp_dir/bad_type.txt" "$tmp_dir/i2.txt" > /dev/null 2>&1
type_exit=$?
set -e

if [ "$type_exit" -eq 2 ]; then
    run_test "unknown TYPE → exit 2" "pass"
else
    run_test "unknown TYPE → exit 2" "fail"
    echo "    got exit $type_exit, expected 2"
fi

# ── Test 6: Empty guardrails file → exit 2 ──
printf '' > "$tmp_dir/empty.txt"

set +e
python3 "$PY" "$tmp_dir/empty.txt" "$tmp_dir/i2.txt" > /dev/null 2>&1
empty_exit=$?
set -e

if [ "$empty_exit" -eq 2 ]; then
    run_test "empty guardrails file → exit 2" "pass"
else
    run_test "empty guardrails file → exit 2" "fail"
    echo "    got exit $empty_exit, expected 2"
fi

# ── Summary ──
total=$((PASS + FAIL))
echo ""
if [ "$FAIL" -eq 0 ]; then
    echo "PASS $PASS/$total"
    exit 0
else
    echo "FAIL $FAIL/$total"
    exit 1
fi
