#!/usr/bin/env bash
# Dispatch test runner — 6 tests.
# Usage: bash execution/tests/ghost-project/dispatch/tests/run_tests.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISPATCH_DIR="$(dirname "$SCRIPT_DIR")"
FIXTURES="$SCRIPT_DIR/fixtures"
DISPATCH="$DISPATCH_DIR/dispatch.py"

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

# ── Test 1: basic fixture — dedup + non-dedup in same output ─────────────────
actual=$(python3 "$DISPATCH" "$FIXTURES/dispatch_basic.txt" 2>&1)
expected=$(cat "$FIXTURES/dispatch_basic_expected.txt")
# Strip trailing newline from expected for comparison
expected_trimmed="${expected%$'\n'}"
if [ "$actual" = "$expected_trimmed" ]; then
    pass "basic fixture: dedup ROUTE × 2 → 1 task, SEND × 3 → 3 tasks"
else
    fail "basic fixture: expected $(echo "$expected_trimmed" | wc -l) lines, got $(echo "$actual" | wc -l)"
    echo "  EXPECTED: $(echo "$expected_trimmed" | head -5)"
    echo "  ACTUAL:   $(echo "$actual" | head -5)"
fi

# ── Test 2: boundary fixture — empty source, mixed ordering ──────────────────
actual=$(python3 "$DISPATCH" "$FIXTURES/dispatch_boundary.txt" 2>&1)
expected=$(cat "$FIXTURES/dispatch_boundary_expected.txt")
expected_trimmed="${expected%$'\n'}"
if [ "$actual" = "$expected_trimmed" ]; then
    pass "boundary fixture: RESOLVE y has no declarations → no output, mixed order preserved"
else
    fail "boundary fixture: output mismatch"
    echo "  EXPECTED: |$expected_trimmed|"
    echo "  ACTUAL:   |$actual|"
fi

# ── Test 3: 100 identical ROUTEs → 1 task on RESOLVE ─────────────────────────
tmpfile=$(mktemp)
for i in $(seq 1 100); do
    printf 'ROUTE\tsrc\tdst\n'
done >> "$tmpfile"
printf 'RESOLVE\tsrc\n' >> "$tmpfile"
actual=$(python3 "$DISPATCH" "$tmpfile" 2>&1)
count=$(echo "$actual" | grep -c '^TASK' || true)
rm -f "$tmpfile"
if [ "$count" -eq 1 ]; then
    pass "100 identical ROUTE → 1 task"
else
    fail "100 identical ROUTE → expected 1 task, got $count"
fi

# ── Test 4: 5 identical SEND same payload → 5 tasks on RESOLVE ───────────────
tmpfile=$(mktemp)
for i in $(seq 1 5); do
    printf 'SEND\tsrc\tdst\tpayload\n'
done >> "$tmpfile"
printf 'RESOLVE\tsrc\n' >> "$tmpfile"
actual=$(python3 "$DISPATCH" "$tmpfile" 2>&1)
count=$(echo "$actual" | grep -c '^TASK' || true)
rm -f "$tmpfile"
if [ "$count" -eq 5 ]; then
    pass "5 identical SEND same payload → 5 tasks"
else
    fail "5 identical SEND same payload → expected 5 tasks, got $count"
fi

# ── Test 5: ROUTE with 2 fields → exit 2 ─────────────────────────────────────
tmpfile=$(mktemp)
printf 'ROUTE\tonlyone\n' >> "$tmpfile"
python3 "$DISPATCH" "$tmpfile" > /dev/null 2>&1
exit_code=$?
rm -f "$tmpfile"
if [ "$exit_code" -eq 2 ]; then
    pass "ROUTE with 2 fields → exit 2"
else
    fail "ROUTE with 2 fields → expected exit 2, got $exit_code"
fi

# ── Test 6: SEND with 3 fields → exit 2 ──────────────────────────────────────
tmpfile=$(mktemp)
printf 'SEND\tsrc\tdst\n' >> "$tmpfile"
python3 "$DISPATCH" "$tmpfile" > /dev/null 2>&1
exit_code=$?
rm -f "$tmpfile"
if [ "$exit_code" -eq 2 ]; then
    pass "SEND with 3 fields → exit 2"
else
    fail "SEND with 3 fields → expected exit 2, got $exit_code"
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
