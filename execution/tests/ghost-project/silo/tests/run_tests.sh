#!/usr/bin/env bash
# Silo test runner — 6 assertions.
# Usage: bash execution/tests/ghost-project/silo/tests/run_tests.sh
#   (from the Athanor root, or from the silo directory)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SILO_DIR="$(dirname "$SCRIPT_DIR")"
FIXTURES="$SILO_DIR/tests/fixtures"
SILO="$SILO_DIR/silo.py"

PASS=0
FAIL=0

pass() { echo "PASS: $1"; ((PASS++)); }
fail() { echo "FAIL: $1"; ((FAIL++)); }

# ── Test 1: Basic fixture — diff actual vs expected, assert exit 0 ────────────

actual=$(python3 "$SILO" "$FIXTURES/silo_basic.txt" 2>/dev/null)
exit_code=$?

if [ "$exit_code" -ne 0 ]; then
    fail "T1 basic fixture: expected exit 0, got $exit_code"
else
    expected=$(cat "$FIXTURES/silo_basic_expected.txt")
    if [ "$actual" = "$expected" ]; then
        pass "T1 basic fixture: output matches and exit 0"
    else
        fail "T1 basic fixture: output mismatch"
        echo "  expected: $(echo "$expected" | head -5)"
        echo "  actual:   $(echo "$actual" | head -5)"
    fi
fi

# ── Test 2: Boundary (duplicate INIT) — exit 2, empty stdout ─────────────────

actual_out=$(python3 "$SILO" "$FIXTURES/silo_boundary.txt" 2>/dev/null)
exit_code=$?

if [ "$exit_code" -ne 2 ]; then
    fail "T2 duplicate INIT: expected exit 2, got $exit_code"
elif [ -n "$actual_out" ]; then
    fail "T2 duplicate INIT: expected empty stdout, got: $actual_out"
else
    pass "T2 duplicate INIT: exit 2 and empty stdout"
fi

# ── Test 3: Different types, same KEY — counters stay isolated ────────────────

tmpfile=$(mktemp /tmp/silo_t3.XXXXXX)
printf 'reviewer\treq-1\tINIT\nsummarizer\treq-1\tINIT\nreviewer\treq-1\tINCREMENT\nreviewer\treq-1\tINCREMENT\nsummarizer\treq-1\tINCREMENT\nreviewer\treq-1\tGET\nsummarizer\treq-1\tGET\n' > "$tmpfile"

actual=$(python3 "$SILO" "$tmpfile" 2>/dev/null)
exit_code=$?
rm -f "$tmpfile"

expected_t3="reviewer req-1 2
summarizer req-1 1"

if [ "$exit_code" -ne 0 ]; then
    fail "T3 type isolation: expected exit 0, got $exit_code"
elif [ "$actual" = "$expected_t3" ]; then
    pass "T3 type isolation: reviewer=2 summarizer=1 correctly isolated"
else
    fail "T3 type isolation: output mismatch"
    echo "  expected: $expected_t3"
    echo "  actual:   $actual"
fi

# ── Test 4: GET on uninitialized → exit 2 ────────────────────────────────────

tmpfile=$(mktemp /tmp/silo_t4.XXXXXX)
printf 'reviewer\treq-99\tGET\n' > "$tmpfile"

actual_out=$(python3 "$SILO" "$tmpfile" 2>/dev/null)
exit_code=$?
rm -f "$tmpfile"

if [ "$exit_code" -ne 2 ]; then
    fail "T4 GET uninitialized: expected exit 2, got $exit_code"
elif [ -n "$actual_out" ]; then
    fail "T4 GET uninitialized: expected empty stdout, got: $actual_out"
else
    pass "T4 GET uninitialized: exit 2 and empty stdout"
fi

# ── Test 5: INCREMENT on uninitialized → exit 2 ──────────────────────────────

tmpfile=$(mktemp /tmp/silo_t5.XXXXXX)
printf 'reviewer\treq-99\tINCREMENT\n' > "$tmpfile"

actual_out=$(python3 "$SILO" "$tmpfile" 2>/dev/null)
exit_code=$?
rm -f "$tmpfile"

if [ "$exit_code" -ne 2 ]; then
    fail "T5 INCREMENT uninitialized: expected exit 2, got $exit_code"
elif [ -n "$actual_out" ]; then
    fail "T5 INCREMENT uninitialized: expected empty stdout, got: $actual_out"
else
    pass "T5 INCREMENT uninitialized: exit 2 and empty stdout"
fi

# ── Test 6: Unknown OPERATION → exit 2 ───────────────────────────────────────

tmpfile=$(mktemp /tmp/silo_t6.XXXXXX)
printf 'reviewer\treq-1\tDELETE\n' > "$tmpfile"

actual_out=$(python3 "$SILO" "$tmpfile" 2>/dev/null)
exit_code=$?
rm -f "$tmpfile"

if [ "$exit_code" -ne 2 ]; then
    fail "T6 unknown operation: expected exit 2, got $exit_code"
elif [ -n "$actual_out" ]; then
    fail "T6 unknown operation: expected empty stdout, got: $actual_out"
else
    pass "T6 unknown operation: exit 2 and empty stdout"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

TOTAL=$((PASS + FAIL))
echo ""
if [ "$FAIL" -eq 0 ]; then
    echo "PASS $PASS/$TOTAL"
    exit 0
else
    echo "FAIL $FAIL/$TOTAL"
    exit 1
fi
