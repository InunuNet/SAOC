#!/usr/bin/env bash
# Ledger test runner — runs all 7 assertions and reports pass/fail.
# Usage: bash execution/tests/ghost-project/ledger/tests/run_tests.sh
#    or: cd execution/tests/ghost-project/ledger && bash tests/run_tests.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LEDGER_DIR="$(dirname "$SCRIPT_DIR")"
LEDGER="$LEDGER_DIR/ledger.py"
FIXTURES="$SCRIPT_DIR/fixtures"

PASS=0
FAIL=0
TOTAL=7

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

echo "Running Ledger tests..."
echo "  Ledger:  $LEDGER"
echo "  Python:  $(python3 --version)"
echo ""

# ── Test 1: basic fixture ─────────────────────────────────────────────────────
actual=$(python3 "$LEDGER" "$FIXTURES/ledger_basic.txt" 2>/dev/null)
expected=$(cat "$FIXTURES/ledger_basic_expected.txt")
# Strip trailing newline from expected for fair comparison
expected="${expected%$'\n'}"
if [ "$actual" = "$expected" ]; then
    pass "basic fixture matches expected output"
else
    fail "basic fixture output mismatch"
    echo "    expected: $(echo "$expected" | head -5)"
    echo "    actual:   $(echo "$actual"   | head -5)"
fi

# ── Test 2: boundary fixture (TX_2 UNBALANCED) ───────────────────────────────
actual=$(python3 "$LEDGER" "$FIXTURES/ledger_boundary.txt" 2>/dev/null)
expected=$(cat "$FIXTURES/ledger_boundary_expected.txt")
expected="${expected%$'\n'}"
if [ "$actual" = "$expected" ]; then
    pass "boundary fixture matches expected output (TX_2 UNBALANCED)"
else
    fail "boundary fixture output mismatch"
    echo "    expected: $expected"
    echo "    actual:   $actual"
fi

# ── Test 3: empty file → OPENING BALANCED + FINAL BALANCED, exit 0 ───────────
empty_file=$(mktemp)
# mktemp creates a 0-byte file — but our spec says empty lines are malformed.
# An empty file (0 bytes) has no lines at all, which is valid.
actual=$(python3 "$LEDGER" "$empty_file" 2>/dev/null)
exit_code=$?
rm -f "$empty_file"
expected_empty="OPENING BALANCED
FINAL BALANCED"
if [ $exit_code -eq 0 ] && [ "$actual" = "$expected_empty" ]; then
    pass "empty file → exit 0, OPENING BALANCED + FINAL BALANCED"
else
    fail "empty file: exit=$exit_code, output='$actual'"
fi

# ── Test 4: OPEN after TX → exit 2 ───────────────────────────────────────────
open_after_tx=$(mktemp)
printf "OPEN\tASSET_CASH\t1000\nASSET_CASH\t100\tLIAB_LOAN\t100\nOPEN\tEQ_OWNER\t500\n" > "$open_after_tx"
python3 "$LEDGER" "$open_after_tx" >/dev/null 2>&1
exit_code=$?
rm -f "$open_after_tx"
if [ $exit_code -eq 2 ]; then
    pass "OPEN after TX → exit 2"
else
    fail "OPEN after TX: expected exit 2, got $exit_code"
fi

# ── Test 5: float amount → exit 2 ────────────────────────────────────────────
float_file=$(mktemp)
printf "OPEN\tASSET_CASH\t100.5\n" > "$float_file"
python3 "$LEDGER" "$float_file" >/dev/null 2>&1
exit_code=$?
rm -f "$float_file"
if [ $exit_code -eq 2 ]; then
    pass "float amount (100.5) → exit 2"
else
    fail "float amount: expected exit 2, got $exit_code"
fi

# ── Test 6: unknown prefix → exit 2 ──────────────────────────────────────────
prefix_file=$(mktemp)
printf "OPEN\tASSET_CASH\t1000\nREV_SALES\t200\tASSET_CASH\t200\n" > "$prefix_file"
python3 "$LEDGER" "$prefix_file" >/dev/null 2>&1
exit_code=$?
rm -f "$prefix_file"
if [ $exit_code -eq 2 ]; then
    pass "unknown prefix (REV_SALES) → exit 2"
else
    fail "unknown prefix: expected exit 2, got $exit_code"
fi

# ── Test 7: negative amount in transaction → exit 2 ──────────────────────────
neg_file=$(mktemp)
printf "OPEN\tASSET_CASH\t1000\nASSET_CASH\t-100\tLIAB_LOAN\t100\n" > "$neg_file"
python3 "$LEDGER" "$neg_file" >/dev/null 2>&1
exit_code=$?
rm -f "$neg_file"
if [ $exit_code -eq 2 ]; then
    pass "negative amount in transaction → exit 2"
else
    fail "negative amount: expected exit 2, got $exit_code"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
if [ $FAIL -eq 0 ]; then
    echo "PASS $PASS/$TOTAL"
    exit 0
else
    echo "FAIL $PASS/$TOTAL ($FAIL failed)"
    exit 1
fi
