#!/usr/bin/env bash
# Merger test runner — runs all assertions and reports pass/fail.
# Usage: bash execution/tests/ghost-project/merger/tests/run_tests.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MERGER_DIR="$(dirname "$SCRIPT_DIR")"
MERGER="$MERGER_DIR/merger.py"
FIXTURES="$SCRIPT_DIR/fixtures"

PASS=0
FAIL=0
TOTAL=0

pass() {
    local name="$1"
    PASS=$((PASS + 1))
    TOTAL=$((TOTAL + 1))
    echo "  PASS [$TOTAL] $name"
}

fail() {
    local name="$1"
    local detail="${2:-}"
    FAIL=$((FAIL + 1))
    TOTAL=$((TOTAL + 1))
    echo "  FAIL [$TOTAL] $name"
    if [ -n "$detail" ]; then
        echo "       $detail"
    fi
}

echo "Running Merger tests..."
echo "  Merger: $MERGER"
echo "  Python: $(python3 --version)"
echo ""

# ── Test 1: Basic fixture — all 3 reducer types + CONFLICT ──────────────────
name="basic fixture: append+overwrite+none+CONFLICT"
actual=$(python3 "$MERGER" "$FIXTURES/merger_basic.txt" 2>/dev/null)
expected=$(cat "$FIXTURES/merger_basic_expected.txt")
# Strip trailing newline for comparison
actual_stripped=$(printf '%s' "$actual")
expected_stripped=$(printf '%s' "$expected")
if [ "$actual_stripped" = "$expected_stripped" ]; then
    pass "$name"
else
    diff_out=$(diff <(echo "$expected_stripped") <(echo "$actual_stripped") 2>&1 || true)
    fail "$name" "$diff_out"
fi

# ── Test 2: Boundary fixture — UNREGISTERED, spaces in VALUE, append accumulation ──
name="boundary fixture: UNREGISTERED + whitespace VALUE + append across steps"
actual=$(python3 "$MERGER" "$FIXTURES/merger_boundary.txt" 2>/dev/null)
expected=$(cat "$FIXTURES/merger_boundary_expected.txt")
actual_stripped=$(printf '%s' "$actual")
expected_stripped=$(printf '%s' "$expected")
if [ "$actual_stripped" = "$expected_stripped" ]; then
    pass "$name"
else
    diff_out=$(diff <(echo "$expected_stripped") <(echo "$actual_stripped") 2>&1 || true)
    fail "$name" "$diff_out"
fi

# ── Test 3: Unknown reducer → exit 2 ────────────────────────────────────────
name="unknown reducer exits 2"
tmpfile=$(mktemp)
printf 'REGISTER k bogus\nGET k\n' > "$tmpfile"
set +e
python3 "$MERGER" "$tmpfile" >/dev/null 2>&1
code=$?
set -e
rm -f "$tmpfile"
if [ "$code" -eq 2 ]; then
    pass "$name"
else
    fail "$name" "expected exit 2, got $code"
fi

# ── Test 4: Sequential none-reducer writes (different APPLYs) → no conflict ─
name="sequential none-reducer single writes across APPLYs: no conflict"
tmpfile=$(mktemp)
printf 'REGISTER x none\nUPDATE x first\nAPPLY\nGET x\nSTEP\nUPDATE x second\nAPPLY\nGET x\n' > "$tmpfile"
set +e
actual=$(python3 "$MERGER" "$tmpfile" 2>/dev/null)
code=$?
set -e
rm -f "$tmpfile"
expected_seq="x: first
x: second"
actual_stripped=$(printf '%s' "$actual")
expected_stripped=$(printf '%s' "$expected_seq")
if [ "$code" -eq 0 ] && [ "$actual_stripped" = "$expected_stripped" ]; then
    pass "$name"
else
    fail "$name" "exit=$code output=$(echo "$actual" | head -5)"
fi

# ── Test 5: append with single pending and no prior → no leading | ───────────
name="append single pending no prior: no leading pipe"
tmpfile=$(mktemp)
printf 'REGISTER m append\nUPDATE m hello\nAPPLY\nGET m\n' > "$tmpfile"
set +e
actual=$(python3 "$MERGER" "$tmpfile" 2>/dev/null)
code=$?
set -e
rm -f "$tmpfile"
expected_m="m: hello"
actual_stripped=$(printf '%s' "$actual")
if [ "$code" -eq 0 ] && [ "$actual_stripped" = "$expected_m" ]; then
    pass "$name"
else
    fail "$name" "exit=$code output=$actual"
fi

# ── Test 6: Two consecutive APPLYs with no UPDATE → second APPLY is silent ──
name="consecutive APPLYs with no UPDATE: second is silent no-op"
tmpfile=$(mktemp)
printf 'REGISTER n none\nUPDATE n val\nAPPLY\nAPPLY\nGET n\n' > "$tmpfile"
set +e
actual=$(python3 "$MERGER" "$tmpfile" 2>/dev/null)
code=$?
set -e
rm -f "$tmpfile"
expected_n="n: val"
actual_stripped=$(printf '%s' "$actual")
if [ "$code" -eq 0 ] && [ "$actual_stripped" = "$expected_n" ]; then
    pass "$name"
else
    fail "$name" "exit=$code output=$actual"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "Results: $PASS passed, $FAIL failed out of $TOTAL tests"

if [ "$FAIL" -eq 0 ]; then
    echo "PASS $PASS/$TOTAL"
    exit 0
else
    echo "FAIL $PASS/$TOTAL"
    exit 1
fi
