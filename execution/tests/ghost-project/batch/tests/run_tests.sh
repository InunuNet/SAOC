#!/usr/bin/env bash
# batch test runner — runs all assertions and reports pass/fail.
# Usage: bash execution/tests/ghost-project/batch/tests/run_tests.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BATCH_DIR="$(dirname "$SCRIPT_DIR")"
FIXTURES="$SCRIPT_DIR/fixtures"
BATCH="$BATCH_DIR/batch.py"

PASS=0
FAIL=0
TOTAL=0

pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo "  PASS [$TOTAL] $1"; }
fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo "  FAIL [$TOTAL] $1"; if [ -n "${2:-}" ]; then echo "       $2"; fi; }

echo "Running batch tests..."
echo "  Script:  $BATCH"
echo "  Python:  $(python3 --version)"
echo ""

# ── Helper: fresh temp log + derived stage path ──────────────────────────────
# Each test creates its own logfile via mktemp; stagefile is <log>.stage.json
# so batch.py can find it automatically.

# ── Test 1: Basic fixture ─────────────────────────────────────────────────────
{
    LOG=$(mktemp)
    STAGE="${LOG}.stage.json"
    actual=$(python3 "$BATCH" "$LOG" "$FIXTURES/batch_basic.txt" 2>&1)
    expected=$(cat "$FIXTURES/batch_basic_expected.txt")
    rm -f "$LOG" "$STAGE"
    if [ "$actual" = "$expected" ]; then
        pass "basic fixture: output matches expected"
    else
        fail "basic fixture: output mismatch" \
            "$(diff <(echo "$expected") <(echo "$actual") | head -20)"
    fi
}

# ── Test 2: Boundary fixture ──────────────────────────────────────────────────
{
    LOG=$(mktemp)
    STAGE="${LOG}.stage.json"
    actual=$(python3 "$BATCH" "$LOG" "$FIXTURES/batch_boundary.txt" 2>&1)
    expected=$(cat "$FIXTURES/batch_boundary_expected.txt")
    rm -f "$LOG" "$STAGE"
    if [ "$actual" = "$expected" ]; then
        pass "boundary fixture: output matches expected"
    else
        fail "boundary fixture: output mismatch" \
            "$(diff <(echo "$expected") <(echo "$actual") | head -20)"
    fi
}

# ── Test 3: Atomicity — CRASH then READ does not expose crashed events ─────────
# ADD goes only to stage; READ reads only logfile. Crashed events must NOT appear.
{
    LOG=$(mktemp)
    STAGE="${LOG}.stage.json"
    CMDS=$(mktemp)
    printf 'BEGIN bx\nADD bx secret-event\nCRASH bx\nREAD\n' > "$CMDS"
    actual=$(python3 "$BATCH" "$LOG" "$CMDS" 2>&1)
    rm -f "$LOG" "$STAGE" "$CMDS"
    # After CRASH, READ should print "CRASHED bx" but logfile is empty → READ prints nothing.
    # actual should be exactly "CRASHED bx"
    if [ "$actual" = "CRASHED bx" ]; then
        pass "atomicity: crashed events not visible in READ"
    else
        fail "atomicity: crashed events leaked into logfile" \
            "actual output: $(echo "$actual" | head -5)"
    fi
}

# ── Test 4: RECOVER then READ — rolled-back events still not in logfile ───────
{
    LOG=$(mktemp)
    STAGE="${LOG}.stage.json"
    CMDS=$(mktemp)
    printf 'BEGIN by\nADD by secret2\nCRASH by\nRECOVER\nREAD\n' > "$CMDS"
    actual=$(python3 "$BATCH" "$LOG" "$CMDS" 2>&1)
    rm -f "$LOG" "$STAGE" "$CMDS"
    expected="CRASHED by
ROLLED_BACK by"
    if [ "$actual" = "$expected" ]; then
        pass "recover+read: rolled-back events absent from logfile"
    else
        fail "recover+read: unexpected output after RECOVER+READ" \
            "actual: $(echo "$actual" | head -5)"
    fi
}

# ── Test 5: BEGIN duplicate → exit 2 ─────────────────────────────────────────
{
    LOG=$(mktemp)
    STAGE="${LOG}.stage.json"
    CMDS=$(mktemp)
    printf 'BEGIN dup\nBEGIN dup\n' > "$CMDS"
    set +e
    python3 "$BATCH" "$LOG" "$CMDS" > /dev/null 2>&1
    ec=$?
    set -e
    rm -f "$LOG" "$STAGE" "$CMDS"
    if [ "$ec" -eq 2 ]; then
        pass "BEGIN duplicate → exit 2"
    else
        fail "BEGIN duplicate → exit 2" "got exit code $ec"
    fi
}

# ── Test 6: COMMIT on corrupted (crashed) batch → exit 2 ─────────────────────
{
    LOG=$(mktemp)
    STAGE="${LOG}.stage.json"
    CMDS=$(mktemp)
    printf 'BEGIN bz\nADD bz e1\nCRASH bz\nCOMMIT bz\n' > "$CMDS"
    set +e
    python3 "$BATCH" "$LOG" "$CMDS" > /dev/null 2>&1
    ec=$?
    set -e
    rm -f "$LOG" "$STAGE" "$CMDS"
    if [ "$ec" -eq 2 ]; then
        pass "COMMIT on corrupted batch → exit 2"
    else
        fail "COMMIT on corrupted batch → exit 2" "got exit code $ec"
    fi
}

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
if [ "$FAIL" -eq 0 ]; then
    echo "PASS $PASS/$TOTAL"
    exit 0
else
    echo "FAIL $PASS passed, $FAIL failed out of $TOTAL"
    exit 1
fi
