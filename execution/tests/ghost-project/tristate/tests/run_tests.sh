#!/usr/bin/env bash
# Tristate test runner — 6 test cases covering all policies and error conditions.
# Usage: bash execution/tests/ghost-project/tristate/tests/run_tests.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRISTATE_DIR="$(dirname "$SCRIPT_DIR")"
FIXTURES="$SCRIPT_DIR/fixtures"
TRISTATE="$TRISTATE_DIR/tristate.py"

pass=0
fail=0

run_test() {
    local name="$1"
    local result="$2"  # "pass" or "fail"
    if [ "$result" = "pass" ]; then
        echo "PASS: $name"
        pass=$((pass + 1))
    else
        echo "FAIL: $name"
        fail=$((fail + 1))
    fi
}

echo "Running Tristate tests..."
echo "  Tristate: $TRISTATE"
echo "  Python:   $(python3 --version)"
echo ""

# ── Test 1: Basic fixture ─────────────────────────────────────────────────────
actual=$(python3 "$TRISTATE" "$FIXTURES/tristate_basic.txt" 2>&1)
expected=$(cat "$FIXTURES/tristate_basic_expected.txt")
# Trim trailing newline from expected for comparison
expected_trimmed="${expected%$'\n'}"
if [ "$actual" = "$expected_trimmed" ]; then
    run_test "basic fixture: strict/lenient propagation" pass
else
    run_test "basic fixture: strict/lenient propagation" fail
    echo "  Expected: $(echo "$expected_trimmed" | head -5)"
    echo "  Actual:   $(echo "$actual" | head -5)"
fi

# ── Test 2: Boundary fixture ──────────────────────────────────────────────────
actual=$(python3 "$TRISTATE" "$FIXTURES/tristate_boundary.txt" 2>&1)
expected=$(cat "$FIXTURES/tristate_boundary_expected.txt")
expected_trimmed="${expected%$'\n'}"
if [ "$actual" = "$expected_trimmed" ]; then
    run_test "boundary fixture: strict/lenient/any all demonstrated" pass
else
    run_test "boundary fixture: strict/lenient/any all demonstrated" fail
    echo "  Expected:"
    echo "$expected_trimmed" | sed 's/^/    /'
    echo "  Actual:"
    echo "$actual" | sed 's/^/    /'
fi

# ── Test 3: Cycle detection ───────────────────────────────────────────────────
cycle_input=$(mktemp /tmp/tristate_cycle_XXXXXX.txt)
cat > "$cycle_input" <<'EOF'
NODES
A ok aval
B ok bval

DEPS
A B strict
B A strict

OUTPUT
OUTPUT A
EOF
python3 "$TRISTATE" "$cycle_input" >/dev/null 2>&1
exit_code=$?
rm -f "$cycle_input"
if [ "$exit_code" = "2" ]; then
    run_test "cycle detection: exit 2" pass
else
    run_test "cycle detection: exit 2" fail
    echo "  Expected exit 2, got $exit_code"
fi

# ── Test 4: Unknown NODE_ID in DEPS ──────────────────────────────────────────
unknown_input=$(mktemp /tmp/tristate_unknown_XXXXXX.txt)
cat > "$unknown_input" <<'EOF'
NODES
A ok aval

DEPS
A GHOST strict

OUTPUT
OUTPUT A
EOF
python3 "$TRISTATE" "$unknown_input" >/dev/null 2>&1
exit_code=$?
rm -f "$unknown_input"
if [ "$exit_code" = "2" ]; then
    run_test "unknown NODE_ID in DEPS: exit 2" pass
else
    run_test "unknown NODE_ID in DEPS: exit 2" fail
    echo "  Expected exit 2, got $exit_code"
fi

# ── Test 5: Mixed policies for same downstream ────────────────────────────────
mixed_input=$(mktemp /tmp/tristate_mixed_XXXXXX.txt)
cat > "$mixed_input" <<'EOF'
NODES
A ok aval
B ok bval
C ok cval

DEPS
C A strict
C B lenient

OUTPUT
OUTPUT C
EOF
python3 "$TRISTATE" "$mixed_input" >/dev/null 2>&1
exit_code=$?
rm -f "$mixed_input"
if [ "$exit_code" = "2" ]; then
    run_test "mixed policies for same downstream: exit 2" pass
else
    run_test "mixed policies for same downstream: exit 2" fail
    echo "  Expected exit 2, got $exit_code"
fi

# ── Test 6: All source nodes (no DEPS) — keep declared status ─────────────────
source_input=$(mktemp /tmp/tristate_source_XXXXXX.txt)
cat > "$source_input" <<'EOF'
NODES
X ok xval
Y empty
Z failed

DEPS

OUTPUT
OUTPUT X
EOF
actual=$(python3 "$TRISTATE" "$source_input" 2>&1)
exit_code=$?
rm -f "$source_input"
expected_source="X OK xval
Y EMPTY
Z FAILED
OUTPUT: xval"
if [ "$exit_code" = "0" ] && [ "$actual" = "$expected_source" ]; then
    run_test "all source nodes: keep declared status, exit 0" pass
else
    run_test "all source nodes: keep declared status, exit 0" fail
    echo "  Expected exit 0 with:"
    echo "$expected_source" | sed 's/^/    /'
    echo "  Got exit $exit_code with:"
    echo "$actual" | sed 's/^/    /'
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
total=$((pass + fail))
if [ "$fail" = "0" ]; then
    echo "PASS $pass/$total"
    exit 0
else
    echo "FAIL $pass/$total passed, $fail failed"
    exit 1
fi
