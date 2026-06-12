#!/usr/bin/env bash
# relay2 test runner — 6 tests
# Usage: bash execution/tests/ghost-project/relay2/tests/run_tests.sh
# (from Athanor root, or from inside the relay2 directory)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELAY2_DIR="$(dirname "$SCRIPT_DIR")"
FIXTURES="$SCRIPT_DIR/fixtures"
PY="$RELAY2_DIR/relay2.py"

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

echo "Running relay2 tests..."
echo "  Script: $PY"
echo "  Python: $(python3 --version)"
echo ""

# ── Test 1: Main fixture — diff actual vs expected, assert exit 0 ──
actual=$(python3 "$PY" "$FIXTURES/handlers.txt" "$FIXTURES/commands.txt" 2>/dev/null)
exit_code=$?
if [ "$exit_code" -ne 0 ]; then
    fail "T1 main fixture: expected exit 0, got $exit_code"
else
    diff_out=$(diff <(echo "$actual") "$FIXTURES/expected.txt" 2>&1)
    if [ -z "$diff_out" ]; then
        pass "T1 main fixture: exit 0 and output matches expected.txt"
    else
        fail "T1 main fixture: output mismatch:"$'\n'"$diff_out"
    fi
fi

# ── Test 2: Boundary — unknown handler → exit 2 AND empty stdout ──
boundary_stdout=$(python3 "$PY" "$FIXTURES/boundary_handlers.txt" "$FIXTURES/boundary_commands.txt" 2>/dev/null)
boundary_exit=$?
if [ "$boundary_exit" -eq 2 ] && [ -z "$boundary_stdout" ]; then
    pass "T2 boundary unknown handler: exit 2 and empty stdout"
else
    fail "T2 boundary unknown handler: got exit=$boundary_exit stdout=${boundary_stdout:-<empty>} (want exit=2, empty stdout)"
fi

# ── Test 3: BROADCAST+fail → LOGGED (not ERROR) — verify line 4 ──
line4=$(python3 "$PY" "$FIXTURES/handlers.txt" "$FIXTURES/commands.txt" 2>/dev/null | sed -n '4p')
if [ "$line4" = "BROADCAST broken LOGGED" ]; then
    pass "T3 BROADCAST+fail outputs LOGGED (not ERROR)"
else
    fail "T3 BROADCAST+fail: expected 'BROADCAST broken LOGGED', got '$line4'"
fi

# ── Test 4: Dispatcher survives DIRECT fail — line 5 is DIRECT healthy OK ──
line5=$(python3 "$PY" "$FIXTURES/handlers.txt" "$FIXTURES/commands.txt" 2>/dev/null | sed -n '5p')
if [ "$line5" = "DIRECT healthy OK" ]; then
    pass "T4 dispatcher continues after DIRECT fail (line 5 = DIRECT healthy OK)"
else
    fail "T4 dispatcher continuity: expected 'DIRECT healthy OK', got '$line5'"
fi

# ── Test 5: Exit 2 on invalid BEHAVIOR value in handlers ──
bad_behavior_stdout=$(python3 "$PY" <(printf 'healthy\tok\nbroken\tcrash\n') "$FIXTURES/commands.txt" 2>/dev/null)
bad_behavior_exit=$?
if [ "$bad_behavior_exit" -eq 2 ] && [ -z "$bad_behavior_stdout" ]; then
    pass "T5 invalid BEHAVIOR value: exit 2 and empty stdout"
else
    fail "T5 invalid BEHAVIOR value: got exit=$bad_behavior_exit stdout=${bad_behavior_stdout:-<empty>} (want exit=2, empty stdout)"
fi

# ── Test 6: Exit 2 on duplicate handler name ──
dup_handler_stdout=$(python3 "$PY" <(printf 'healthy\tok\nhealthy\tfail\n') "$FIXTURES/commands.txt" 2>/dev/null)
dup_handler_exit=$?
if [ "$dup_handler_exit" -eq 2 ] && [ -z "$dup_handler_stdout" ]; then
    pass "T6 duplicate handler name: exit 2 and empty stdout"
else
    fail "T6 duplicate handler name: got exit=$dup_handler_exit stdout=${dup_handler_stdout:-<empty>} (want exit=2, empty stdout)"
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -eq 0 ]; then
    echo "PASS $PASS/6"
    exit 0
else
    echo "FAIL $FAIL/6"
    exit 1
fi
