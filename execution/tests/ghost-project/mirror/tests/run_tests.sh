#!/usr/bin/env bash
# Mirror test runner — 6 tests covering self-publish suppression and edge cases.
# Usage: bash execution/tests/ghost-project/mirror/tests/run_tests.sh
# Or:    cd execution/tests/ghost-project/mirror && bash tests/run_tests.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIRROR_DIR="$(dirname "$SCRIPT_DIR")"
MIRROR="$MIRROR_DIR/mirror.py"
FIXTURES="$SCRIPT_DIR/fixtures"
SCRATCH="$(mktemp -d)"

PASS=0
FAIL=0

pass() { echo "  PASS: $1"; ((PASS++)); }
fail() { echo "  FAIL: $1"; ((FAIL++)); }

echo "Running Mirror tests..."
echo "  Mirror:  $MIRROR"
echo "  Python:  $(python3 --version)"
echo ""

# ── Test 1: Basic fixture — self-publish suppressed ──────────────────────────
echo "Test 1: Basic fixture (self-publish suppressed)"
actual=$(python3 "$MIRROR" "$FIXTURES/mirror_basic.txt" 2>&1)
expected=$(cat "$FIXTURES/mirror_basic_expected.txt")
# Strip trailing newline for comparison
if [ "$(printf '%s' "$actual")" = "$(printf '%s' "$expected")" ]; then
    pass "alice gets [], bob gets [hello-world]"
else
    fail "output mismatch"
    echo "    expected: $expected"
    echo "    actual:   $actual"
fi

# ── Test 2: Boundary fixture — multi-agent ordering, non-subscriber INBOX ────
echo "Test 2: Boundary fixture (multi-agent ordering, non-subscriber INBOX)"
actual=$(python3 "$MIRROR" "$FIXTURES/mirror_boundary.txt" 2>&1)
expected=$(cat "$FIXTURES/mirror_boundary_expected.txt")
if [ "$(printf '%s' "$actual")" = "$(printf '%s' "$expected")" ]; then
    pass "alice=[m2,m3] bob=[m1,m3] carol=[m1,m2] dave=[]"
else
    fail "output mismatch"
    echo "    expected: $expected"
    echo "    actual:   $actual"
fi

# ── Test 3: Publish to topic with no subscribers → no error, no delivery ─────
echo "Test 3: Publish to topic with no subscribers"
tmp_file="$SCRATCH/no_subscribers.txt"
printf 'PUBLISH\talice\temptytopic\thello\nINBOX\talice\n' > "$tmp_file"
set +e
actual=$(python3 "$MIRROR" "$tmp_file" 2>&1)
exit_code=$?
set -e
if [ $exit_code -eq 0 ] && [ "$actual" = "alice RECEIVED: []" ]; then
    pass "no error, alice inbox empty (alice not subscribed, no one gets it)"
else
    fail "exit=$exit_code output=$actual"
fi

# ── Test 4: Publisher not subscribed to topic → others still receive ──────────
echo "Test 4: Publisher not subscribed — subscribers still receive"
tmp_file="$SCRATCH/pub_not_subbed.txt"
printf 'SUBSCRIBE\tbob\tnews\nPUBLISH\talice\tnews\thi\nINBOX\tbob\n' > "$tmp_file"
actual=$(python3 "$MIRROR" "$tmp_file" 2>&1)
if [ "$actual" = "bob RECEIVED: [hi]" ]; then
    pass "bob receives even though alice (publisher) is not subscribed"
else
    fail "expected 'bob RECEIVED: [hi]', got: $actual"
fi

# ── Test 5: Duplicate SUBSCRIBE → single delivery (not double) ────────────────
echo "Test 5: Duplicate SUBSCRIBE → single delivery"
tmp_file="$SCRATCH/duplicate_sub.txt"
printf 'SUBSCRIBE\tbob\tnews\nSUBSCRIBE\tbob\tnews\nPUBLISH\talice\tnews\tping\nINBOX\tbob\n' > "$tmp_file"
actual=$(python3 "$MIRROR" "$tmp_file" 2>&1)
if [ "$actual" = "bob RECEIVED: [ping]" ]; then
    pass "bob receives exactly once despite double subscription"
else
    fail "expected 'bob RECEIVED: [ping]', got: $actual"
fi

# ── Test 6: Self-only topic — only publisher subscribed → inbox stays [] ──────
echo "Test 6: Self-only topic (publisher is only subscriber → inbox stays [])"
tmp_file="$SCRATCH/self_only.txt"
printf 'SUBSCRIBE\talice\tpriv\nPUBLISH\talice\tpriv\tsecret\nINBOX\talice\n' > "$tmp_file"
actual=$(python3 "$MIRROR" "$tmp_file" 2>&1)
if [ "$actual" = "alice RECEIVED: []" ]; then
    pass "alice inbox empty — self-publish suppressed even as sole subscriber"
else
    fail "expected 'alice RECEIVED: []', got: $actual"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
TOTAL=$((PASS + FAIL))
if [ $FAIL -eq 0 ]; then
    echo "PASS $PASS/$TOTAL"
    exit 0
else
    echo "FAIL $PASS/$TOTAL passed, $FAIL failed"
    exit 1
fi
