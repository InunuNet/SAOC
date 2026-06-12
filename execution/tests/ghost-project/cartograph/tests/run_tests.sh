#!/usr/bin/env bash
# run_tests.sh — Run all 11 cartograph assertions
# Reports PASS N/11 or FAIL N/11, exits 0 if all pass.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CARTOGRAPH="$SCRIPT_DIR/../cartograph.py"
FIXTURES="$SCRIPT_DIR/fixtures"
PYTHON="${PYTHON:-python3}"

PASS=0
FAIL=0
TOTAL=11

pass() { echo "PASS [$1/11]: $2"; ((PASS++)) || true; }
fail() { echo "FAIL [$1/11]: $2${3:+ ($3)}"; ((FAIL++)) || true; }

echo "Running cartograph test suite (11 assertions)"
echo "============================================="

# Test 1: Linear deps → correct topo order
actual=$("$PYTHON" "$CARTOGRAPH" resolve "$FIXTURES/linear.json" 2>/dev/null) || true
expected=$(cat "$FIXTURES/expected_linear.txt")
if [ "$actual" = "$expected" ]; then
    pass 1 "Linear deps → correct topo order"
else
    fail 1 "Linear deps → correct topo order" "got: $actual"
fi

# Test 2: Diamond deps → stable lex order
actual=$("$PYTHON" "$CARTOGRAPH" resolve "$FIXTURES/diamond.json" 2>/dev/null) || true
expected=$(cat "$FIXTURES/expected_diamond.txt")
if [ "$actual" = "$expected" ]; then
    pass 2 "Diamond deps → stable lex order"
else
    fail 2 "Diamond deps → stable lex order" "got: $actual"
fi

# Test 3: Cycle detection → exit 2
"$PYTHON" "$CARTOGRAPH" resolve "$FIXTURES/cycle.json" >/dev/null 2>&1; CYCLE_EXIT=$?
if [ "$CYCLE_EXIT" -eq 2 ]; then
    pass 3 "Cycle detection → exit 2"
else
    fail 3 "Cycle detection → exit 2" "got exit $CYCLE_EXIT"
fi

# Test 4: Cycle output canonical lex form on stderr
CYCLE_STDERR=$("$PYTHON" "$CARTOGRAPH" resolve "$FIXTURES/cycle.json" 2>&1 >/dev/null || true)
if [ "$CYCLE_STDERR" = "a -> b -> c -> a" ]; then
    pass 4 "Cycle output canonical lex form"
else
    fail 4 "Cycle output canonical lex form" "got: '$CYCLE_STDERR'"
fi

# Test 5: Self-cycle → exit 2
"$PYTHON" "$CARTOGRAPH" resolve "$FIXTURES/self.json" >/dev/null 2>&1; SELF_EXIT=$?
if [ "$SELF_EXIT" -eq 2 ]; then
    pass 5 "Self-cycle → exit 2"
else
    fail 5 "Self-cycle → exit 2" "got exit $SELF_EXIT"
fi

# Test 6: Missing dep → exit 3
"$PYTHON" "$CARTOGRAPH" resolve "$FIXTURES/missing.json" >/dev/null 2>&1; MISSING_EXIT=$?
if [ "$MISSING_EXIT" -eq 3 ]; then
    pass 6 "Missing dep → exit 3"
else
    fail 6 "Missing dep → exit 3" "got exit $MISSING_EXIT"
fi

# Test 7: Missing dep names culprit in stderr
MISSING_STDERR=$("$PYTHON" "$CARTOGRAPH" resolve "$FIXTURES/missing.json" 2>&1 >/dev/null || true)
if echo "$MISSING_STDERR" | grep -q "libfoo"; then
    pass 7 "Missing dep names culprit"
else
    fail 7 "Missing dep names culprit" "got: '$MISSING_STDERR'"
fi

# Test 8: Schema error beats cycle → exit 5
"$PYTHON" "$CARTOGRAPH" resolve "$FIXTURES/malformed_cycle.json" >/dev/null 2>&1; SCHEMA_EXIT=$?
if [ "$SCHEMA_EXIT" -eq 5 ]; then
    pass 8 "Schema error beats cycle → exit 5"
else
    fail 8 "Schema error beats cycle → exit 5" "got exit $SCHEMA_EXIT"
fi

# Test 9: why returns shortest path
actual=$("$PYTHON" "$CARTOGRAPH" why c < "$FIXTURES/diamond.json" 2>/dev/null) || true
expected=$(cat "$FIXTURES/expected_why.txt")
if [ "$actual" = "$expected" ]; then
    pass 9 "why returns shortest path"
else
    fail 9 "why returns shortest path" "got: $actual"
fi

# Test 10: why unreachable → exit 4
"$PYTHON" "$CARTOGRAPH" why nonexistent_pkg < "$FIXTURES/diamond.json" >/dev/null 2>&1; WHY_EXIT=$?
if [ "$WHY_EXIT" -eq 4 ]; then
    pass 10 "why unreachable → exit 4"
else
    fail 10 "why unreachable → exit 4" "got exit $WHY_EXIT"
fi

# Test 11: Determinism — two runs produce identical output
OUT1=$("$PYTHON" "$CARTOGRAPH" resolve "$FIXTURES/diamond.json" 2>/dev/null) || true
OUT2=$("$PYTHON" "$CARTOGRAPH" resolve "$FIXTURES/diamond.json" 2>/dev/null) || true
if [ "$OUT1" = "$OUT2" ]; then
    pass 11 "Determinism: two runs identical"
else
    fail 11 "Determinism: two runs identical" "outputs differ"
fi

echo "============================================="
if [ "$FAIL" -eq 0 ]; then
    echo "PASS $PASS/$TOTAL"
    exit 0
else
    echo "FAIL $PASS/$TOTAL"
    exit 1
fi
