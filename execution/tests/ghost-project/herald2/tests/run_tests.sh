#!/usr/bin/env bash
# herald2 test runner — 5 tests
# Usage: bash execution/tests/ghost-project/herald2/tests/run_tests.sh
#   (run from repo root, or from anywhere — paths are resolved relative to this script)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HERALD2_DIR="$(dirname "$SCRIPT_DIR")"
HERALD2="$HERALD2_DIR/herald2.py"
FIXTURES="$SCRIPT_DIR/fixtures"

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

echo "Running herald2 tests..."
echo "  herald2: $HERALD2"
echo "  Python:  $(python3 --version)"
echo ""

# ── Test 1: Main fixture — diff actual vs expected ────────────────────────────
actual=$(python3 "$HERALD2" "$FIXTURES/handlers.txt" "$FIXTURES/messages.txt" 2>/dev/null)
expected=$(cat "$FIXTURES/expected.txt")
# Strip trailing newline from expected for fair comparison
expected="${expected%$'\n'}"
if [ "$actual" = "$expected" ]; then
    pass "T1: main fixture output matches expected.txt"
else
    fail "T1: main fixture output mismatch"
    echo "  EXPECTED:"
    echo "$expected" | cat -A
    echo "  ACTUAL:"
    echo "$actual" | cat -A
fi

# ── Test 2: Boundary (empty handlers) — all UNHANDLED ─────────────────────────
actual=$(python3 "$HERALD2" "$FIXTURES/boundary_handlers.txt" "$FIXTURES/boundary_messages.txt" 2>/dev/null)
boundary_expected=$(cat "$FIXTURES/boundary_expected.txt")
boundary_expected="${boundary_expected%$'\n'}"
if [ "$actual" = "$boundary_expected" ]; then
    pass "T2: empty handlers → all UNHANDLED"
else
    fail "T2: empty handlers output mismatch"
    echo "  EXPECTED: $boundary_expected"
    echo "  ACTUAL:   $actual"
fi

# ── Test 3: Single-match — verify correct handler fires ───────────────────────
# "Latency spike on api-gateway" should match only mike_metrics (keyword=latency)
single_out=$(python3 "$HERALD2" "$FIXTURES/handlers.txt" "$FIXTURES/messages.txt" 2>/dev/null | grep "^2	")
if [ "$single_out" = "2	mike_metrics	EMIT_METRIC" ]; then
    pass "T3: single-match message fires correct handler (mike_metrics)"
else
    fail "T3: single-match handler wrong"
    echo "  ACTUAL: $single_out"
fi

# ── Test 4: Exit 2 on handler line with 2 fields (missing action) ─────────────
bad_handlers_2fields=$(mktemp)
printf "alpha_alerter\terror\n" > "$bad_handlers_2fields"
set +e
python3 "$HERALD2" "$bad_handlers_2fields" "$FIXTURES/messages.txt" >/dev/null 2>&1
exit_code=$?
set -e
rm -f "$bad_handlers_2fields"
if [ "$exit_code" -eq 2 ]; then
    pass "T4: exit 2 on handler line with 2 fields (missing action)"
else
    fail "T4: expected exit 2 on malformed handler (2 fields), got $exit_code"
fi

# ── Test 5: Exit 2 on handler line with empty keyword ─────────────────────────
bad_handlers_empty_kw=$(mktemp)
printf "alpha_alerter\t\tPAGE_ONCALL\n" > "$bad_handlers_empty_kw"
set +e
python3 "$HERALD2" "$bad_handlers_empty_kw" "$FIXTURES/messages.txt" >/dev/null 2>&1
exit_code=$?
set -e
rm -f "$bad_handlers_empty_kw"
if [ "$exit_code" -eq 2 ]; then
    pass "T5: exit 2 on handler line with empty keyword"
else
    fail "T5: expected exit 2 on empty keyword, got $exit_code"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
    echo "PASS $PASS/$TOTAL — all herald2 tests passed"
    exit 0
else
    echo "FAIL $PASS/$TOTAL — $FAIL test(s) failed"
    exit 1
fi
