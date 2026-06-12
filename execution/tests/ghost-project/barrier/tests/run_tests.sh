#!/usr/bin/env bash
# Barrier test runner — 6 tests covering core behaviour and edge cases.
# Usage: bash execution/tests/ghost-project/barrier/tests/run_tests.sh
# Or:    cd execution/tests/ghost-project/barrier && bash tests/run_tests.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BARRIER_DIR="$(dirname "$SCRIPT_DIR")"
BARRIER="$BARRIER_DIR/barrier.py"
FIXTURES="$SCRIPT_DIR/fixtures"

pass=0
fail=0

run_test() {
    local name="$1"
    shift
    # "$@" is the test block (a function we call)
    if "$@"; then
        echo "PASS: $name"
        ((pass++)) || true
    else
        echo "FAIL: $name"
        ((fail++)) || true
    fi
}

# ── Test 1: Basic — diff actual vs expected ───────────────────────────────────
test_basic() {
    local actual
    actual=$(python3 "$BARRIER" "$FIXTURES/barrier_basic.txt" 2>&1)
    local expected
    expected=$(cat "$FIXTURES/barrier_basic_expected.txt")
    if [ "$actual" = "$expected" ]; then
        return 0
    else
        echo "  expected: $(echo "$expected" | head -5)"
        echo "  actual:   $(echo "$actual" | head -5)"
        return 1
    fi
}

# ── Test 2: Boundary — INCOMPLETE trap ───────────────────────────────────────
test_boundary() {
    local actual
    actual=$(python3 "$BARRIER" "$FIXTURES/barrier_boundary.txt" 2>&1)
    local expected
    expected=$(cat "$FIXTURES/barrier_boundary_expected.txt")
    if [ "$actual" = "$expected" ]; then
        return 0
    else
        echo "  expected: $(printf '%s' "$expected" | head -5)"
        echo "  actual:   $(printf '%s' "$actual" | head -5)"
        return 1
    fi
}

# ── Test 3: Empty file → exit 0, no output ────────────────────────────────────
test_empty_file() {
    local tmp
    tmp=$(mktemp)
    # Write an empty file
    : > "$tmp"
    local actual
    actual=$(python3 "$BARRIER" "$tmp" 2>&1)
    local ec=$?
    rm -f "$tmp"
    if [ $ec -ne 0 ]; then
        echo "  expected exit 0, got $ec"
        return 1
    fi
    if [ -n "$actual" ]; then
        echo "  expected no output, got: $actual"
        return 1
    fi
    return 0
}

# ── Test 4: Single worker same group → complete output (not EMPTY, not INCOMPLETE)
test_single_worker() {
    local tmp
    tmp=$(mktemp)
    printf 'WORKER\tw1\tg\toutput\nBARRIER\tg\n' > "$tmp"
    local actual
    actual=$(python3 "$BARRIER" "$tmp" 2>&1)
    local ec=$?
    rm -f "$tmp"
    if [ $ec -ne 0 ]; then
        echo "  expected exit 0, got $ec"
        return 1
    fi
    local expected="BARRIER g: output"
    if [ "$actual" = "$expected" ]; then
        return 0
    else
        echo "  expected: $expected"
        echo "  actual:   $actual"
        return 1
    fi
}

# ── Test 5: Wrong field count (WORKER with 3 fields) → exit 2 ────────────────
test_wrong_field_count() {
    local tmp
    tmp=$(mktemp)
    # WORKER with only 3 fields (missing output field)
    printf 'WORKER\tw1\tg1\n' > "$tmp"
    python3 "$BARRIER" "$tmp" >/dev/null 2>&1
    local ec=$?
    rm -f "$tmp"
    if [ $ec -eq 2 ]; then
        return 0
    else
        echo "  expected exit 2 for malformed WORKER, got $ec"
        return 1
    fi
}

# ── Test 6: All BARRIERs before all workers → INCOMPLETE / EMPTY ──────────────
test_barriers_before_workers() {
    local tmp
    tmp=$(mktemp)
    # g1 has 2 workers declared later → INCOMPLETE at first BARRIER
    # g2 has 0 workers ever → EMPTY
    printf 'BARRIER\tg1\nBARRIER\tg2\nWORKER\tw1\tg1\talpha\nWORKER\tw2\tg1\tbeta\n' > "$tmp"
    local actual
    actual=$(python3 "$BARRIER" "$tmp" 2>&1)
    local ec=$?
    rm -f "$tmp"
    if [ $ec -ne 0 ]; then
        echo "  expected exit 0, got $ec"
        return 1
    fi
    local expected
    expected="$(printf 'BARRIER g1: INCOMPLETE\nBARRIER g2: EMPTY')"
    if [ "$actual" = "$expected" ]; then
        return 0
    else
        echo "  expected: $expected"
        echo "  actual:   $actual"
        return 1
    fi
}

# ── Run all tests ─────────────────────────────────────────────────────────────
echo "Running Barrier tests..."
echo "  Barrier:  $BARRIER"
echo "  Python:   $(python3 --version)"
echo ""

run_test "basic: diff actual vs expected" test_basic
run_test "boundary: INCOMPLETE trap (two-pass)" test_boundary
run_test "empty file: exit 0, no output" test_empty_file
run_test "single worker: complete output (not EMPTY/INCOMPLETE)" test_single_worker
run_test "wrong field count: exit 2" test_wrong_field_count
run_test "all barriers before workers: INCOMPLETE/EMPTY" test_barriers_before_workers

echo ""
total=$((pass + fail))
if [ $fail -eq 0 ]; then
    echo "PASS $pass/$total"
    exit 0
else
    echo "FAIL $pass/$total passed, $fail failed"
    exit 1
fi
