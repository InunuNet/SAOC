#!/usr/bin/env bash
# grove test runner — 6 tests, exits 0 if all pass, 1 if any fail.
# Usage: bash execution/tests/ghost-project/grove/tests/run_tests.sh
#   (run from any directory)

set -uo pipefail

# Cleanup any leftover temp files from aborted runs
_grove_cleanup() { rm -f /tmp/grove_test_* 2>/dev/null || true; }
trap _grove_cleanup EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GROVE_DIR="$(dirname "$SCRIPT_DIR")"
GROVE="$GROVE_DIR/grove.py"
FIXTURES="$SCRIPT_DIR/fixtures"

pass=0
fail=0

ok() {
    echo "  PASS  $1"
    ((pass++))
}

fail_test() {
    echo "  FAIL  $1"
    echo "        $2"
    ((fail++))
}

echo "Running Grove tests..."
echo "  Grove:  $GROVE"
echo "  Python: $(python3 --version)"
echo ""

# ── Test 1: Basic fixture ─────────────────────────────────────────────────────
actual=$(python3 "$GROVE" "$FIXTURES/grove_basic.txt" 2>&1)
expected=$(cat "$FIXTURES/grove_basic_expected.txt")
# Strip trailing newline from expected for clean diff
if [ "$actual" = "$(printf '%s' "$expected" | sed 's/[[:space:]]*$//')" ] || \
   diff <(echo "$actual") <(echo "$expected") > /dev/null 2>&1; then
    ok "basic fixture: 5 lines match expected order"
else
    fail_test "basic fixture: output mismatch" "got: $(echo "$actual" | head -1)"
    diff <(echo "$actual") <(echo "$expected") || true
fi

# ── Test 2: Boundary fixture (FIFO, not alphabetical) ────────────────────────
actual=$(python3 "$GROVE" "$FIXTURES/grove_boundary.txt" 2>&1)
expected=$(cat "$FIXTURES/grove_boundary_expected.txt")
if diff <(echo "$actual") <(echo "$expected") > /dev/null 2>&1; then
    ok "boundary fixture: FIFO tiebreak over alphabetical"
else
    fail_test "boundary fixture: FIFO tiebreak failed" "got: $(echo "$actual")"
    diff <(echo "$actual") <(echo "$expected") || true
fi

# ── Test 3: REMAINING count ──────────────────────────────────────────────────
# Push 3, pop 1 — expect REMAINING 2 on the last line
remaining_input=$(printf 'PUSH\t4\tone\nPUSH\t2\ttwo\nPUSH\t9\tthree\nPOP\n')
actual=$(echo "$remaining_input" | python3 -c "
import sys, heapq
lines = sys.stdin.read().splitlines()
heap = []
seq = 0
out = []
for line in lines:
    parts = line.split('\t')
    if parts[0] == 'PUSH':
        heapq.heappush(heap, (int(parts[1]), seq, parts[2]))
        seq += 1
    elif parts[0] == 'POP':
        p, s, item = heapq.heappop(heap)
        out.append(f'POPPED {item} {p}')
if heap:
    out.append(f'REMAINING {len(heap)}')
print('\n'.join(out))
" 2>&1)
# Use grove.py via temp file
tmpfile=$(mktemp /tmp/grove_test_remainingXXXXXX)
printf 'PUSH\t4\tone\nPUSH\t2\ttwo\nPUSH\t9\tthree\nPOP\n' > "$tmpfile"
actual=$(python3 "$GROVE" "$tmpfile" 2>&1)
rm -f "$tmpfile"
last_line=$(echo "$actual" | tail -1)
if [ "$last_line" = "REMAINING 2" ]; then
    ok "REMAINING: 3 pushed, 1 popped → REMAINING 2"
else
    fail_test "REMAINING: expected 'REMAINING 2'" "got: $last_line"
fi

# ── Test 4: POP from empty queue → exit 2 ────────────────────────────────────
tmpfile=$(mktemp /tmp/grove_test_emptyXXXXXX)
printf 'POP\n' > "$tmpfile"
set +e
python3 "$GROVE" "$tmpfile" > /dev/null 2>&1
exit_code=$?
set -e
rm -f "$tmpfile"
if [ "$exit_code" -eq 2 ]; then
    ok "POP empty queue → exit 2"
else
    fail_test "POP empty queue → expected exit 2" "got exit $exit_code"
fi

# ── Test 5: Non-integer priority → exit 2 ────────────────────────────────────
tmpfile=$(mktemp /tmp/grove_test_badprioXXXXXX)
printf 'PUSH\tfive\tapple\n' > "$tmpfile"
set +e
python3 "$GROVE" "$tmpfile" > /dev/null 2>&1
exit_code=$?
set -e
rm -f "$tmpfile"
if [ "$exit_code" -eq 2 ]; then
    ok "non-integer priority → exit 2"
else
    fail_test "non-integer priority → expected exit 2" "got exit $exit_code"
fi

# ── Test 6: Negative priorities ─────────────────────────────────────────────
tmpfile=$(mktemp /tmp/grove_test_negprioXXXXXX)
printf 'PUSH\t5\tpositive\nPUSH\t-100\tnegative\nPOP\n' > "$tmpfile"
actual=$(python3 "$GROVE" "$tmpfile" 2>&1)
rm -f "$tmpfile"
first_line=$(echo "$actual" | head -1)
if [ "$first_line" = "POPPED negative -100" ]; then
    ok "negative priority -100 pops before priority 5"
else
    fail_test "negative priority: expected 'POPPED negative -100'" "got: $first_line"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
total=$((pass + fail))
if [ "$fail" -eq 0 ]; then
    echo "PASS $pass/$total"
    exit 0
else
    echo "FAIL $pass/$total passed, $fail failed"
    exit 1
fi
