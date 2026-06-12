#!/usr/bin/env bash
# Grid test runner — 15 test cases covering cheapest-path, reachable, bridges.
# Reports per-test PASS/FAIL plus final summary.

set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

GRID="execution/tests/ghost-project/grid/grid.py"
FIXTURES="execution/tests/ghost-project/grid/tests/fixtures"
PYTHON="${PYTHON:-python3}"

PASS=0
FAIL=0

# Hard precondition: grid.py must exist. Otherwise every test is a false signal.
if [ ! -f "$GRID" ]; then
  echo "  FAIL precondition: $GRID does not exist"
  echo "======================================="
  echo "FAIL 0/15"
  exit 1
fi

run_test() {
  local name="$1" expected="$2"; shift 2
  actual=$("$@" 2>/dev/null)
  if [ "$actual" = "$expected" ]; then
    echo "  PASS $name"; PASS=$((PASS+1))
  else
    echo "  FAIL $name"
    echo "    expected: $expected"
    echo "    actual:   $actual"
    FAIL=$((FAIL+1))
  fi
}

run_test_exit() {
  local name="$1" expected_exit="$2"; shift 2
  "$@" >/dev/null 2>&1; actual_exit=$?
  if [ "$actual_exit" = "$expected_exit" ]; then
    echo "  PASS $name"; PASS=$((PASS+1))
  else
    echo "  FAIL $name (exit $actual_exit, expected $expected_exit)"
    FAIL=$((FAIL+1))
  fi
}

run_test_file() {
  local name="$1" expected_file="$2"; shift 2
  actual=$("$@" 2>/dev/null)
  expected=$(cat "$expected_file")
  if [ "$actual" = "$expected" ]; then
    echo "  PASS $name"; PASS=$((PASS+1))
  else
    echo "  FAIL $name"
    echo "    expected: $expected"
    echo "    actual:   $actual"
    FAIL=$((FAIL+1))
  fi
}

echo "Running grid test suite (15 assertions)"
echo "======================================="

# --- cheapest-path tests ---
run_test "T01 cheapest-path simple 3x3 (0,0)->(2,2)" "4" \
  "$PYTHON" "$GRID" cheapest-path --map "$FIXTURES/map_simple_3x3.txt" --from 0,0 --to 2,2

run_test "T02 cheapest-path weighted (0,0)->(0,2)" "6" \
  "$PYTHON" "$GRID" cheapest-path --map "$FIXTURES/map_weighted.txt" --from 0,0 --to 0,2

run_test "T03 cheapest-path blocked → UNREACHABLE" "UNREACHABLE" \
  "$PYTHON" "$GRID" cheapest-path --map "$FIXTURES/map_blocked.txt" --from 0,0 --to 0,2

run_test "T04 cheapest-path from==to → 0" "0" \
  "$PYTHON" "$GRID" cheapest-path --map "$FIXTURES/map_weighted.txt" --from 0,0 --to 0,0

run_test "T05 cheapest-path S→E markers cost-1" "2" \
  "$PYTHON" "$GRID" cheapest-path --map "$FIXTURES/map_se_markers.txt" --from 0,0 --to 0,2

run_test_exit "T06 cheapest-path --from on wall → exit 2" "2" \
  "$PYTHON" "$GRID" cheapest-path --map "$FIXTURES/map_wall_start.txt" --from 0,0 --to 1,2

# --- reachable tests ---
run_test "T07 reachable open 3x3 = 9" "9" \
  "$PYTHON" "$GRID" reachable --map "$FIXTURES/map_simple_3x3.txt" --from 0,0

run_test "T08 reachable with walls (left column)" "3" \
  "$PYTHON" "$GRID" reachable --map "$FIXTURES/map_partial.txt" --from 0,0

run_test "T09 reachable single cell = 1" "1" \
  "$PYTHON" "$GRID" reachable --map "$FIXTURES/map_single.txt" --from 0,0

run_test_exit "T10 reachable --from on wall → exit 2" "2" \
  "$PYTHON" "$GRID" reachable --map "$FIXTURES/map_wall_start.txt" --from 0,0

# --- bridges tests ---
run_test_file "T11 bridges chain (0,1)(0,2)(0,3)" "$FIXTURES/expected_bridges_chain.txt" \
  "$PYTHON" "$GRID" bridges --map "$FIXTURES/map_chain.txt"

run_test "T12 bridges 2x2 square → NONE" "NONE" \
  "$PYTHON" "$GRID" bridges --map "$FIXTURES/map_square_2x2.txt"

run_test "T13 bridges single cell → NONE" "NONE" \
  "$PYTHON" "$GRID" bridges --map "$FIXTURES/map_single.txt"

run_test "T14 bridges all-walls → NONE" "NONE" \
  "$PYTHON" "$GRID" bridges --map "$FIXTURES/map_walls_only.txt"

run_test_file "T15 bridges disconnected (row 1 cells)" "$FIXTURES/expected_bridges_disconnected.txt" \
  "$PYTHON" "$GRID" bridges --map "$FIXTURES/map_disconnected.txt"

echo "======================================="
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  echo "PASS $PASS/$TOTAL"
  exit 0
else
  echo "FAIL $PASS/$TOTAL"
  exit 1
fi
