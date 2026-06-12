#!/usr/bin/env bash
# queue2 test runner
# Usage: bash execution/tests/ghost-project/queue2/tests/run_tests.sh (from Athanor root)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUEUE2_DIR="$(dirname "$SCRIPT_DIR")"
FIXTURES="$SCRIPT_DIR/fixtures"
PY="python3"

PASS=0
FAIL=0
TOTAL=6

pass() { PASS=$((PASS + 1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  FAIL: $1"; }

echo "Running queue2 tests..."
echo "  queue2: $QUEUE2_DIR/queue2.py"
echo "  Python: $($PY --version)"
echo ""

# ── Test 1: Basic fixture ─────────────────────────────────────────────────────
{
  STATE=$(mktemp /tmp/queue2_test_1_XXXXXX)
  actual=$($PY "$QUEUE2_DIR/queue2.py" "$STATE" "$FIXTURES/queue2_basic.txt" 2>&1)
  expected=$(cat "$FIXTURES/queue2_basic_expected.txt")
  rm -f "$STATE"
  if [ "$actual" = "$expected" ]; then
    pass "Basic fixture output matches expected"
  else
    fail "Basic fixture — output mismatch"
    echo "    Expected: $(echo "$expected" | head -5)"
    echo "    Actual:   $(echo "$actual" | head -5)"
  fi
}

# ── Test 2: Boundary fixture ──────────────────────────────────────────────────
{
  STATE=$(mktemp /tmp/queue2_test_2_XXXXXX)
  actual=$($PY "$QUEUE2_DIR/queue2.py" "$STATE" "$FIXTURES/queue2_boundary.txt" 2>&1)
  expected=$(cat "$FIXTURES/queue2_boundary_expected.txt")
  rm -f "$STATE"
  if [ "$actual" = "$expected" ]; then
    pass "Boundary fixture output matches expected"
  else
    fail "Boundary fixture — output mismatch"
    echo "    Expected: |$(echo "$expected" | head -8)|"
    echo "    Actual:   |$(echo "$actual" | head -8)|"
  fi
}

# ── Test 3: State persistence across separate invocations ─────────────────────
{
  STATE=$(mktemp /tmp/queue2_test_3_XXXXXX)
  # First invocation: enqueue two items
  CMDS1=$(mktemp /tmp/queue2_cmds_3a_XXXXXX)
  printf 'ENQUEUE p1 payload-one\nENQUEUE p2 payload-two\n' > "$CMDS1"
  $PY "$QUEUE2_DIR/queue2.py" "$STATE" "$CMDS1"

  # Second invocation (same statefile): check STATUS
  CMDS2=$(mktemp /tmp/queue2_cmds_3b_XXXXXX)
  printf 'STATUS\n' > "$CMDS2"
  status_out=$($PY "$QUEUE2_DIR/queue2.py" "$STATE" "$CMDS2" 2>&1)

  rm -f "$STATE" "$CMDS1" "$CMDS2"

  if [ "$status_out" = "PENDING: 2, IN_FLIGHT: 0, DONE: 0" ]; then
    pass "State persists across separate invocations"
  else
    fail "State persistence — expected 'PENDING: 2, IN_FLIGHT: 0, DONE: 0', got: '$status_out'"
  fi
}

# ── Test 4: RECOVER after FAIL puts item in DONE ──────────────────────────────
{
  STATE=$(mktemp /tmp/queue2_test_4_XXXXXX)
  CMDS=$(mktemp /tmp/queue2_cmds_4_XXXXXX)
  printf 'ENQUEUE q1 some-data\nFAIL\nRECOVER\nSTATUS\n' > "$CMDS"
  output=$($PY "$QUEUE2_DIR/queue2.py" "$STATE" "$CMDS" 2>&1)
  rm -f "$STATE" "$CMDS"

  # Expect: FAILED q1 / RECOVERED q1 / PENDING: 0, IN_FLIGHT: 0, DONE: 1
  if echo "$output" | grep -q "RECOVERED q1" && echo "$output" | grep -q "PENDING: 0, IN_FLIGHT: 0, DONE: 1"; then
    pass "RECOVER after FAIL moves item to DONE"
  else
    fail "RECOVER after FAIL — item not in DONE"
    echo "    Output: $output"
  fi
}

# ── Test 5: Multiple FAILs → multiple in_flight → single RECOVER emits all ───
{
  STATE=$(mktemp /tmp/queue2_test_5_XXXXXX)
  CMDS=$(mktemp /tmp/queue2_cmds_5_XXXXXX)
  printf 'ENQUEUE m1 data1\nENQUEUE m2 data2\nENQUEUE m3 data3\nFAIL\nFAIL\nFAIL\nRECOVER\nSTATUS\n' > "$CMDS"
  output=$($PY "$QUEUE2_DIR/queue2.py" "$STATE" "$CMDS" 2>&1)
  rm -f "$STATE" "$CMDS"

  if echo "$output" | grep -q "RECOVERED m1" && \
     echo "$output" | grep -q "RECOVERED m2" && \
     echo "$output" | grep -q "RECOVERED m3" && \
     echo "$output" | grep -q "PENDING: 0, IN_FLIGHT: 0, DONE: 3"; then
    pass "Multiple FAILs: single RECOVER emits all items"
  else
    fail "Multiple FAILs: RECOVER did not emit all items"
    echo "    Output: $output"
  fi
}

# ── Test 6: Missing/unknown command → exit 2 ──────────────────────────────────
{
  STATE=$(mktemp /tmp/queue2_test_6_XXXXXX)
  CMDS=$(mktemp /tmp/queue2_cmds_6_XXXXXX)
  printf 'BOGUS_COMMAND\n' > "$CMDS"
  set +e
  $PY "$QUEUE2_DIR/queue2.py" "$STATE" "$CMDS" > /dev/null 2>&1
  exit_code=$?
  set -e
  rm -f "$STATE" "$CMDS"

  if [ "$exit_code" -eq 2 ]; then
    pass "Unknown command exits with code 2"
  else
    fail "Unknown command — expected exit 2, got: $exit_code"
  fi
}

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "PASS $PASS/$TOTAL — all tests passed"
  exit 0
else
  echo "FAIL $PASS/$TOTAL passed, $FAIL failed"
  exit 1
fi
