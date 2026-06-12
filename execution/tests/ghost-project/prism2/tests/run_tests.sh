#!/usr/bin/env bash
# prism2 test runner — 6 tests covering the full precedence contract.
# Usage: bash execution/tests/ghost-project/prism2/tests/run_tests.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRISM2_DIR="$(dirname "$SCRIPT_DIR")"
PRISM2="$PRISM2_DIR/prism2.py"
FIXTURES="$SCRIPT_DIR/fixtures"

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1 — $2"; FAIL=$((FAIL + 1)); }

echo "Running prism2 tests..."
echo "  prism2: $PRISM2"
echo "  Python: $(python3 --version)"
echo ""

# ── Test 1: Basic fixture diff vs expected ────────────────────────────────────
actual=$(python3 "$PRISM2" "$FIXTURES/prism2_basic.txt" 2>/dev/null)
exit_code=$?
expected=$(cat "$FIXTURES/prism2_basic_expected.txt")
# Trim trailing newline for comparison
expected="${expected%$'\n'}"

if [ "$exit_code" -ne 0 ]; then
    fail "T1 basic fixture" "exit code was $exit_code, expected 0"
elif [ "$actual" = "$expected" ]; then
    pass "T1 basic fixture (exit 0, output matches)"
else
    fail "T1 basic fixture" "output mismatch"
    echo "  EXPECTED: $(echo "$expected" | head -5)"
    echo "  ACTUAL:   $(echo "$actual" | head -5)"
fi

# ── Test 2: EMIT with nothing set → exit 2, empty stdout ─────────────────────
actual=$(python3 "$PRISM2" "$FIXTURES/prism2_boundary.txt" 2>/dev/null)
exit_code=$?
if [ "$exit_code" -eq 2 ] && [ -z "$actual" ]; then
    pass "T2 EMIT nothing set (exit 2, empty stdout)"
else
    fail "T2 EMIT nothing set" "exit=$exit_code stdout='$actual'"
fi

# ── Test 3: PIPE stores full prefix — RAW:JSON:{"x":1} ───────────────────────
tmp=$(mktemp)
cat > "$tmp" <<'EOF'
SET_JSON {"x":1}
PIPE
EMIT
EOF
actual=$(python3 "$PRISM2" "$tmp" 2>/dev/null)
exit_code=$?
rm -f "$tmp"
if [ "$exit_code" -eq 0 ] && [ "$actual" = 'RAW:JSON:{"x":1}' ]; then
    pass "T3 PIPE stores full prefix (RAW:JSON:...)"
else
    fail "T3 PIPE stores full prefix" "exit=$exit_code actual='$actual'"
fi

# ── Test 4: RESET clears all — EMIT after RESET → exit 2 ─────────────────────
tmp=$(mktemp)
cat > "$tmp" <<'EOF'
SET_PYDANTIC {"p":1}
SET_JSON {"j":2}
SET_RAW something
RESET
EMIT
EOF
actual=$(python3 "$PRISM2" "$tmp" 2>/dev/null)
exit_code=$?
rm -f "$tmp"
if [ "$exit_code" -eq 2 ] && [ -z "$actual" ]; then
    pass "T4 RESET clears all (exit 2 after RESET+EMIT)"
else
    fail "T4 RESET clears all" "exit=$exit_code actual='$actual'"
fi

# ── Test 5: SET_JSON with spaces in value → exit 2 ───────────────────────────
tmp=$(mktemp)
printf 'SET_JSON {"a": 1}\n' > "$tmp"
actual=$(python3 "$PRISM2" "$tmp" 2>/dev/null)
exit_code=$?
rm -f "$tmp"
if [ "$exit_code" -eq 2 ] && [ -z "$actual" ]; then
    pass "T5 SET_JSON with spaces → exit 2"
else
    fail "T5 SET_JSON with spaces" "exit=$exit_code actual='$actual'"
fi

# ── Test 6: PIPE then PIPE — double nesting RAW:RAW:... ──────────────────────
tmp=$(mktemp)
cat > "$tmp" <<'EOF'
SET_RAW base
PIPE
PIPE
EMIT
EOF
actual=$(python3 "$PRISM2" "$tmp" 2>/dev/null)
exit_code=$?
rm -f "$tmp"
if [ "$exit_code" -eq 0 ] && [ "$actual" = "RAW:RAW:RAW:base" ]; then
    pass "T6 PIPE then PIPE (triple nesting RAW:RAW:RAW:base)"
else
    fail "T6 PIPE then PIPE" "exit=$exit_code actual='$actual'"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
    echo "PASS $PASS/$TOTAL — all tests passed"
    exit 0
else
    echo "FAIL $PASS/$TOTAL passed, $FAIL failed"
    exit 1
fi
