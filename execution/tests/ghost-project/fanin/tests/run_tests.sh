#!/usr/bin/env bash
# fanin test runner — 6 tests covering correctness, edge cases, and error handling.
# Usage: bash execution/tests/ghost-project/fanin/tests/run_tests.sh
#   (from repo root) or: cd fanin && bash tests/run_tests.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FANIN_DIR="$(dirname "$SCRIPT_DIR")"
FANIN="$FANIN_DIR/fanin.py"
FIXTURES="$SCRIPT_DIR/fixtures"
TMPDIR_LOCAL="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_LOCAL"' EXIT

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1 — $2"; FAIL=$((FAIL + 1)); }

echo "Running fanin tests..."
echo "  fanin: $FANIN"
echo "  Python: $(python3 --version)"
echo ""

# ── Test 1: Basic fixture — declaration order != completion order ─────────────
actual=$(python3 "$FANIN" "$FIXTURES/fanin_basic.txt" 2>/dev/null)
expected=$(cat "$FIXTURES/fanin_basic_expected.txt")
# Strip trailing newline from expected for fair comparison
expected_trimmed=$(printf '%s' "$expected" | sed 's/[[:space:]]*$//')
actual_trimmed=$(printf '%s' "$actual" | sed 's/[[:space:]]*$//')
if [ "$actual_trimmed" = "$expected_trimmed" ]; then
    pass "basic: declaration order != completion order"
else
    fail "basic: declaration order != completion order" "expected: $(echo "$expected_trimmed" | head -2) | got: $(echo "$actual_trimmed" | head -2)"
fi

# ── Test 2: Boundary fixture — tie-breaking, negative ranks ──────────────────
actual=$(python3 "$FANIN" "$FIXTURES/fanin_boundary.txt" 2>/dev/null)
expected=$(cat "$FIXTURES/fanin_boundary_expected.txt")
expected_trimmed=$(printf '%s' "$expected" | sed 's/[[:space:]]*$//')
actual_trimmed=$(printf '%s' "$actual" | sed 's/[[:space:]]*$//')
if [ "$actual_trimmed" = "$expected_trimmed" ]; then
    pass "boundary: tie-breaking, negative ranks"
else
    fail "boundary: tie-breaking, negative ranks" "expected: $expected_trimmed | got: $actual_trimmed"
fi

# ── Test 3: Single task ───────────────────────────────────────────────────────
single="$TMPDIR_LOCAL/single.txt"
printf 'A\t0\tonly\n' > "$single"
actual=$(python3 "$FANIN" "$single" 2>/dev/null)
expected_line1="CONTEXT: only"
expected_line2="COMPLETED_ORDER: A"
actual_line1=$(echo "$actual" | sed -n '1p')
actual_line2=$(echo "$actual" | sed -n '2p')
if [ "$actual_line1" = "$expected_line1" ] && [ "$actual_line2" = "$expected_line2" ]; then
    pass "single task: correct output"
else
    fail "single task: correct output" "got: $actual"
fi

# ── Test 4: Duplicate TASK_ID → exit 2 ───────────────────────────────────────
dup="$TMPDIR_LOCAL/dup.txt"
printf 'A\t1\tfoo\nA\t2\tbar\n' > "$dup"
set +e
python3 "$FANIN" "$dup" > /dev/null 2>&1
exit_code=$?
set -e
if [ "$exit_code" -eq 2 ]; then
    pass "duplicate TASK_ID exits 2"
else
    fail "duplicate TASK_ID exits 2" "got exit code $exit_code"
fi

# ── Test 5: Non-integer DELAY_RANK → exit 2 ──────────────────────────────────
bad_rank="$TMPDIR_LOCAL/bad_rank.txt"
printf 'A\tfast\tfoo\n' > "$bad_rank"
set +e
python3 "$FANIN" "$bad_rank" > /dev/null 2>&1
exit_code=$?
set -e
if [ "$exit_code" -eq 2 ]; then
    pass "non-integer DELAY_RANK exits 2"
else
    fail "non-integer DELAY_RANK exits 2" "got exit code $exit_code"
fi

# ── Test 6: All same DELAY_RANK → completion order = declaration order ────────
same_rank="$TMPDIR_LOCAL/same_rank.txt"
printf 'X\t5\tone\nY\t5\ttwo\nZ\t5\tthree\n' > "$same_rank"
actual=$(python3 "$FANIN" "$same_rank" 2>/dev/null)
actual_line1=$(echo "$actual" | sed -n '1p')
actual_line2=$(echo "$actual" | sed -n '2p')
if [ "$actual_line1" = "CONTEXT: one | two | three" ] && [ "$actual_line2" = "COMPLETED_ORDER: X,Y,Z" ]; then
    pass "all same DELAY_RANK: completion order = declaration order"
else
    fail "all same DELAY_RANK: completion order = declaration order" "got: $actual"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
    echo "PASS $PASS/$TOTAL"
    exit 0
else
    echo "FAIL $FAIL/$TOTAL"
    exit 1
fi
