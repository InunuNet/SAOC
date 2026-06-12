#!/usr/bin/env bash
# Scope test runner — runs all assertions and reports pass/fail.
# Usage: bash execution/tests/ghost-project/scope/tests/run_tests.sh
#   (from the Athanor root, OR from inside the scope directory)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCOPE_DIR="$(dirname "$SCRIPT_DIR")"
FIXTURES="$SCRIPT_DIR/fixtures"
SCOPE_PY="$SCOPE_DIR/scope.py"

PASS=0
FAIL=0
TOTAL=7

pass() { echo "PASS $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL $1 — $2"; FAIL=$((FAIL + 1)); }

echo "Running Scope tests..."
echo "  scope.py: $SCOPE_PY"
echo "  Python:   $(python3 --version)"
echo ""

# ── Test 1: basic fixture (all 3 CROSS branches + DROPPED+unset discriminator) ─
t1_actual=$(python3 "$SCOPE_PY" "$FIXTURES/scope_basic.txt" 2>&1)
t1_exit=$?
t1_expected=$(cat "$FIXTURES/scope_basic_expected.txt")
if [ $t1_exit -eq 0 ] && [ "$t1_actual" = "$t1_expected" ]; then
    pass "1: basic fixture (CROSSED / DROPPED / ISOLATED)"
else
    fail "1: basic fixture (CROSSED / DROPPED / ISOLATED)" "exit=$t1_exit
--- expected ---
$t1_expected
--- actual ---
$t1_actual"
fi

# ── Test 2: boundary fixture (append accumulation across multiple updates) ─────
t2_actual=$(python3 "$SCOPE_PY" "$FIXTURES/scope_boundary.txt" 2>&1)
t2_exit=$?
t2_expected=$(cat "$FIXTURES/scope_boundary_expected.txt")
if [ $t2_exit -eq 0 ] && [ "$t2_actual" = "$t2_expected" ]; then
    pass "2: boundary fixture (append accumulation)"
else
    fail "2: boundary fixture (append accumulation)" "exit=$t2_exit
--- expected ---
$t2_expected
--- actual ---
$t2_actual"
fi

# ── Test 3: duplicate REGISTER (same KEY, SCOPE) → exit 2 ────────────────────
t3_input=$(mktemp /tmp/scope_test3_XXXX.txt)
printf 'REGISTER\tfoo\tinner\toverwrite\nREGISTER\tfoo\tinner\tappend\n' > "$t3_input"
python3 "$SCOPE_PY" "$t3_input" >/dev/null 2>&1
t3_exit=$?
rm -f "$t3_input"
if [ $t3_exit -eq 2 ]; then
    pass "3: duplicate REGISTER → exit 2"
else
    fail "3: duplicate REGISTER → exit 2" "got exit=$t3_exit"
fi

# ── Test 4: INNER_UPDATE with unregistered key → exit 2 ──────────────────────
t4_input=$(mktemp /tmp/scope_test4_XXXX.txt)
printf 'INNER_UPDATE\tghost\tvalue\n' > "$t4_input"
python3 "$SCOPE_PY" "$t4_input" >/dev/null 2>&1
t4_exit=$?
rm -f "$t4_input"
if [ $t4_exit -eq 2 ]; then
    pass "4: INNER_UPDATE unregistered key → exit 2"
else
    fail "4: INNER_UPDATE unregistered key → exit 2" "got exit=$t4_exit"
fi

# ── Test 5: OUTER_UPDATE through unregistered reducer → exit 2 ───────────────
t5_input=$(mktemp /tmp/scope_test5_XXXX.txt)
printf 'REGISTER\tcost\touter\tunregistered\nOUTER_UPDATE\tcost\t99\n' > "$t5_input"
python3 "$SCOPE_PY" "$t5_input" >/dev/null 2>&1
t5_exit=$?
rm -f "$t5_input"
if [ $t5_exit -eq 2 ]; then
    pass "5: OUTER_UPDATE through unregistered reducer → exit 2"
else
    fail "5: OUTER_UPDATE through unregistered reducer → exit 2" "got exit=$t5_exit"
fi

# ── Test 6: GET_OUTER for inner-only key → exit 2 (no leakage) ───────────────
t6_input=$(mktemp /tmp/scope_test6_XXXX.txt)
printf 'REGISTER\tprivate\tinner\toverwrite\nGET_OUTER\tprivate\n' > "$t6_input"
python3 "$SCOPE_PY" "$t6_input" >/dev/null 2>&1
t6_exit=$?
rm -f "$t6_input"
if [ $t6_exit -eq 2 ]; then
    pass "6: GET_OUTER for inner-only key → exit 2 (no leakage)"
else
    fail "6: GET_OUTER for inner-only key → exit 2 (no leakage)" "got exit=$t6_exit"
fi

# ── Test 7: empty CROSS (no pending updates) → no output, exit 0 ─────────────
t7_input=$(mktemp /tmp/scope_test7_XXXX.txt)
printf 'REGISTER\tx\tinner\toverwrite\nCROSS\n' > "$t7_input"
t7_actual=$(python3 "$SCOPE_PY" "$t7_input" 2>&1)
t7_exit=$?
rm -f "$t7_input"
if [ $t7_exit -eq 0 ] && [ -z "$t7_actual" ]; then
    pass "7: empty CROSS → no output, exit 0"
else
    fail "7: empty CROSS → no output, exit 0" "exit=$t7_exit output=${t7_actual:-<empty>}"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
if [ $FAIL -eq 0 ]; then
    echo "PASS $PASS/$TOTAL — all tests passed"
    exit 0
else
    echo "FAIL $PASS/$TOTAL passed, $FAIL/$TOTAL failed"
    exit 1
fi
