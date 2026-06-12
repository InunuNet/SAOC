#!/usr/bin/env bash
# Transcript test runner — runs all 6 assertions and reports pass/fail.
# Usage: bash execution/tests/ghost-project/transcript/tests/run_tests.sh
#   (from the Athanor project root)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRANSCRIPT_DIR="$(dirname "$SCRIPT_DIR")"
FIXTURES_DIR="$SCRIPT_DIR/fixtures"
TOOL="$TRANSCRIPT_DIR/transcript.py"

pass=0
fail=0

run_test() {
    local name="$1"
    local result="$2"  # "pass" or "fail"
    if [ "$result" = "pass" ]; then
        echo "  PASS: $name"
        pass=$((pass + 1))
    else
        echo "  FAIL: $name"
        fail=$((fail + 1))
    fi
}

echo "Running Transcript tests..."
echo "  Tool:   $TOOL"
echo "  Python: $(python3 --version)"
echo ""

# ── Test 1: Basic — MISSING_OBSERVATION + ID_MISMATCH ────────────────────────
actual=$(python3 "$TOOL" "$FIXTURES_DIR/transcript_basic.jsonl" 2>/dev/null)
expected=$(cat "$FIXTURES_DIR/transcript_basic_expected.txt")
if [ "$actual" = "$expected" ]; then
    run_test "basic (MISSING_OBSERVATION + ID_MISMATCH)" "pass"
else
    run_test "basic (MISSING_OBSERVATION + ID_MISMATCH)" "fail"
    echo "    expected: $(echo "$expected" | head -5)"
    echo "    actual:   $(echo "$actual" | head -5)"
fi

# ── Test 2: Boundary — ORDER_VIOLATION + DUPLICATE_OBSERVATION ───────────────
actual=$(python3 "$TOOL" "$FIXTURES_DIR/transcript_boundary.jsonl" 2>/dev/null)
expected=$(cat "$FIXTURES_DIR/transcript_boundary_expected.txt")
if [ "$actual" = "$expected" ]; then
    run_test "boundary (ORDER_VIOLATION + DUPLICATE_OBSERVATION)" "pass"
else
    run_test "boundary (ORDER_VIOLATION + DUPLICATE_OBSERVATION)" "fail"
    echo "    expected: $(echo "$expected" | head -5)"
    echo "    actual:   $(echo "$actual" | head -5)"
fi

# ── Test 3: All-message file → VALID, exit 0 ─────────────────────────────────
all_msg_file=$(mktemp)
cat > "$all_msg_file" <<'EOF'
{"event": "message", "role": "user", "text": "hello"}
{"event": "message", "role": "assistant", "text": "world"}
EOF
actual=$(python3 "$TOOL" "$all_msg_file" 2>/dev/null)
exit_code=$?
rm -f "$all_msg_file"
if [ "$actual" = "VALID" ] && [ "$exit_code" -eq 0 ]; then
    run_test "all-message file → VALID, exit 0" "pass"
else
    run_test "all-message file → VALID, exit 0" "fail"
    echo "    actual output: $actual"
    echo "    exit code: $exit_code"
fi

# ── Test 4: Malformed JSON line → exit 2 ─────────────────────────────────────
malformed_file=$(mktemp)
cat > "$malformed_file" <<'EOF'
{"event": "message", "role": "user", "text": "ok"}
{not valid json
EOF
python3 "$TOOL" "$malformed_file" >/dev/null 2>&1
exit_code=$?
rm -f "$malformed_file"
if [ "$exit_code" -eq 2 ]; then
    run_test "malformed JSON → exit 2" "pass"
else
    run_test "malformed JSON → exit 2" "fail"
    echo "    expected exit 2, got: $exit_code"
fi

# ── Test 5: Action missing 'group' field → exit 2 ────────────────────────────
missing_field_file=$(mktemp)
cat > "$missing_field_file" <<'EOF'
{"event": "action", "id": "tc1", "tool": "bash"}
EOF
python3 "$TOOL" "$missing_field_file" >/dev/null 2>&1
exit_code=$?
rm -f "$missing_field_file"
if [ "$exit_code" -eq 2 ]; then
    run_test "action missing 'group' field → exit 2" "pass"
else
    run_test "action missing 'group' field → exit 2" "fail"
    echo "    expected exit 2, got: $exit_code"
fi

# ── Test 6: Single action, no observation → MISSING_OBSERVATION, INVALID ─────
single_action_file=$(mktemp)
cat > "$single_action_file" <<'EOF'
{"event": "action", "id": "solo", "tool": "bash", "group": "g1"}
EOF
actual=$(python3 "$TOOL" "$single_action_file" 2>/dev/null)
exit_code=$?
rm -f "$single_action_file"
# Must contain VIOLATION 1 MISSING_OBSERVATION and INVALID: 1 violations, exit 0
if echo "$actual" | grep -q "VIOLATION 1 MISSING_OBSERVATION:" && \
   echo "$actual" | grep -q "INVALID: 1 violations" && \
   [ "$exit_code" -eq 0 ]; then
    run_test "single action no observation → MISSING_OBSERVATION + INVALID: 1, exit 0" "pass"
else
    run_test "single action no observation → MISSING_OBSERVATION + INVALID: 1, exit 0" "fail"
    echo "    actual output: $actual"
    echo "    exit code: $exit_code"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
total=$((pass + fail))
echo ""
if [ "$fail" -eq 0 ]; then
    echo "PASS $pass/$total"
    exit 0
else
    echo "FAIL $pass/$total"
    exit 1
fi
