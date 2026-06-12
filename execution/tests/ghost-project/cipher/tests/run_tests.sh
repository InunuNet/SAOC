#!/usr/bin/env bash
# Cipher test runner — validates token bucket rate limiter behaviour.
# Usage: cd execution/tests/ghost-project/cipher && bash tests/run_tests.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIPHER_DIR="$(dirname "$SCRIPT_DIR")"
CIPHER="$CIPHER_DIR/cipher.py"
FIXTURES="$SCRIPT_DIR/fixtures"

echo "Running Cipher tests..."
echo "  Cipher: $CIPHER"
echo "  Python: $(python3 --version)"
echo ""

PASS=0
FAIL=0

run_test() {
    local name="$1"
    local expected_exit="${2}"
    shift 2
    local actual_output
    local actual_exit
    set +e
    actual_output=$(python3 "$CIPHER" "$@" 2>/dev/null)
    actual_exit=$?
    set -e

    if [ "$actual_exit" -ne "$expected_exit" ]; then
        echo "FAIL [$name]: expected exit $expected_exit, got $actual_exit"
        FAIL=$((FAIL + 1))
        return
    fi
    echo "PASS [$name]: exit $actual_exit"
    PASS=$((PASS + 1))
}

run_diff_test() {
    local name="$1"
    local expected_file="$2"
    shift 2
    local actual_output
    local actual_exit
    set +e
    actual_output=$(python3 "$CIPHER" "$@" 2>/dev/null)
    actual_exit=$?
    set -e

    if [ "$actual_exit" -ne 0 ]; then
        echo "FAIL [$name]: expected exit 0, got $actual_exit"
        FAIL=$((FAIL + 1))
        return
    fi

    local diff_result
    diff_result=$(diff <(echo "$actual_output") "$expected_file" 2>&1)
    if [ -n "$diff_result" ]; then
        echo "FAIL [$name]: output mismatch:"
        echo "$diff_result" | sed 's/^/    /'
        FAIL=$((FAIL + 1))
    else
        echo "PASS [$name]"
        PASS=$((PASS + 1))
    fi
}

# ── Test 1: cipher_basic ─────────────────────────────────────────────────────
run_diff_test "cipher_basic" \
    "$FIXTURES/cipher_basic_expected.txt" \
    --capacity 10 --rate 5 --events "$FIXTURES/cipher_basic.txt"

# ── Test 2: cipher_boundary ──────────────────────────────────────────────────
run_diff_test "cipher_boundary" \
    "$FIXTURES/cipher_boundary_expected.txt" \
    --capacity 5 --rate 10 --events "$FIXTURES/cipher_boundary.txt"

# ── Test 3: non-monotonic timestamps → exit 2 ────────────────────────────────
MONO_FILE="$(mktemp /tmp/cipher_test_XXXXXX.txt)"
printf '0\t5\n100\t1\n50\t1\n' > "$MONO_FILE"
run_test "non_monotonic_timestamps_exit2" 2 \
    --capacity 10 --rate 5 --events "$MONO_FILE"
rm -f "$MONO_FILE"

# ── Test 4: negative capacity → exit 2 ───────────────────────────────────────
VALID_FILE="$(mktemp /tmp/cipher_test_XXXXXX.txt)"
printf '0\t1\n' > "$VALID_FILE"
run_test "negative_capacity_exit2" 2 \
    --capacity -1 --rate 5 --events "$VALID_FILE"
rm -f "$VALID_FILE"

# ── Test 5: req > capacity always DENY even with full bucket ─────────────────
# capacity=3, rate=0 → bucket starts at 3, never refills
# event: t=0, req=5 → 3 < 5, DENY
OVER_FILE="$(mktemp /tmp/cipher_test_XXXXXX.txt)"
printf '0\t5\n' > "$OVER_FILE"
OVER_OUT=$(python3 "$CIPHER" --capacity 3 --rate 0 --events "$OVER_FILE" 2>/dev/null)
OVER_EXIT=$?
rm -f "$OVER_FILE"
if [ "$OVER_EXIT" -eq 0 ] && [ "$OVER_OUT" = "DENY 5" ]; then
    echo "PASS [req_exceeds_capacity_always_deny]"
    PASS=$((PASS + 1))
else
    echo "FAIL [req_exceeds_capacity_always_deny]: exit=$OVER_EXIT output='$OVER_OUT'"
    FAIL=$((FAIL + 1))
fi

# ── Summary ──────────────────────────────────────────────────────────────────
TOTAL=$((PASS + FAIL))
echo ""
if [ "$FAIL" -eq 0 ]; then
    echo "PASS $PASS/$TOTAL"
    exit 0
else
    echo "FAIL $PASS/$TOTAL passed, $FAIL failed"
    exit 1
fi
