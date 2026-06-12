#!/usr/bin/env bash
# Resume test runner — 6 assertions
# Usage: bash execution/tests/ghost-project/resume/tests/run_tests.sh
# Or: cd execution/tests/ghost-project/resume && bash tests/run_tests.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESUME_DIR="$(dirname "$SCRIPT_DIR")"
FIXTURES="$SCRIPT_DIR/fixtures"

PASS=0
FAIL=0
TOTAL=6

run_test() {
    local name="$1"
    local expected_exit="$2"
    local actual_exit="$3"
    local diff_result="$4"

    if [ "$actual_exit" -eq "$expected_exit" ] && [ -z "$diff_result" ]; then
        echo "PASS: $name"
        PASS=$((PASS + 1))
    else
        echo "FAIL: $name"
        if [ "$actual_exit" -ne "$expected_exit" ]; then
            echo "  Exit: expected $expected_exit, got $actual_exit"
        fi
        if [ -n "$diff_result" ]; then
            echo "  Diff (expected vs actual):"
            echo "$diff_result" | sed 's/^/    /'
        fi
        FAIL=$((FAIL + 1))
    fi
}

echo "Running Resume tests..."
echo "  resume.py: $RESUME_DIR/resume.py"
echo "  Python:    $(python3 --version)"
echo ""

# ── Test 1: Basic re-execution ────────────────────────────────────────────────
{
    set +e
    actual=$(python3 "$RESUME_DIR/resume.py" \
        "$FIXTURES/resume_basic.node.txt" \
        "$FIXTURES/resume_basic.run.txt" 2>&1)
    actual_exit=$?
    set -e
    diff_out=$(diff <(cat "$FIXTURES/resume_basic_expected.txt") <(echo "$actual") 2>&1 || true)
    run_test "basic: full re-execution with positional binding" 0 "$actual_exit" "$diff_out"
}

# ── Test 2: Boundary — effects before and after interrupt ─────────────────────
{
    set +e
    actual=$(python3 "$RESUME_DIR/resume.py" \
        "$FIXTURES/resume_boundary.node.txt" \
        "$FIXTURES/resume_boundary.run.txt" 2>&1)
    actual_exit=$?
    set -e
    diff_out=$(diff <(cat "$FIXTURES/resume_boundary_expected.txt") <(echo "$actual") 2>&1 || true)
    run_test "boundary: pre-effects fire again on resume" 0 "$actual_exit" "$diff_out"
}

# ── Test 3: RESUME before RUN → exit 2 ───────────────────────────────────────
{
    node_tmp=$(mktemp /tmp/resume_test_XXXXXX.node.txt)
    run_tmp=$(mktemp /tmp/resume_test_XXXXXX.run.txt)
    printf 'INTERRUPT\tsome_question\n' > "$node_tmp"
    printf 'RESUME\tx\n' > "$run_tmp"
    set +e
    python3 "$RESUME_DIR/resume.py" "$node_tmp" "$run_tmp" > /dev/null 2>&1
    actual_exit=$?
    set -e
    rm -f "$node_tmp" "$run_tmp"
    run_test "resume-before-run: exits 2" 2 "$actual_exit" ""
}

# ── Test 4: Value count mismatch — too few ────────────────────────────────────
{
    node_tmp=$(mktemp /tmp/resume_test_XXXXXX.node.txt)
    run_tmp=$(mktemp /tmp/resume_test_XXXXXX.run.txt)
    printf 'INTERRUPT\tq1\nINTERRUPT\tq2\n' > "$node_tmp"
    printf 'RUN\nRESUME\tone\n' > "$run_tmp"
    set +e
    python3 "$RESUME_DIR/resume.py" "$node_tmp" "$run_tmp" > /dev/null 2>&1
    actual_exit=$?
    set -e
    rm -f "$node_tmp" "$run_tmp"
    run_test "value-count-mismatch: 2 interrupts, 1 value → exit 2" 2 "$actual_exit" ""
}

# ── Test 5: Extra values — too many ───────────────────────────────────────────
{
    node_tmp=$(mktemp /tmp/resume_test_XXXXXX.node.txt)
    run_tmp=$(mktemp /tmp/resume_test_XXXXXX.run.txt)
    printf 'INTERRUPT\tonly_q\n' > "$node_tmp"
    printf 'RUN\nRESUME\ta,b,c\n' > "$run_tmp"
    set +e
    python3 "$RESUME_DIR/resume.py" "$node_tmp" "$run_tmp" > /dev/null 2>&1
    actual_exit=$?
    set -e
    rm -f "$node_tmp" "$run_tmp"
    run_test "extra-values: 1 interrupt, 3 values → exit 2" 2 "$actual_exit" ""
}

# ── Test 6: Positional swap — order matters ───────────────────────────────────
{
    swap_run_tmp=$(mktemp /tmp/resume_test_XXXXXX.run.txt)
    printf 'RUN\nRESUME\tbeta,alpha\n' > "$swap_run_tmp"
    expected_swap="EFFECT counter_inc_A
INTERRUPTED: first_question
EFFECT counter_inc_A
ANSWERED: first_question=beta
EFFECT counter_inc_B
ANSWERED: second_question=alpha
COMPLETED: beta,alpha"
    set +e
    actual=$(python3 "$RESUME_DIR/resume.py" \
        "$FIXTURES/resume_basic.node.txt" \
        "$swap_run_tmp" 2>&1)
    actual_exit=$?
    set -e
    rm -f "$swap_run_tmp"
    diff_out=$(diff <(echo "$expected_swap") <(echo "$actual") 2>&1 || true)
    run_test "positional-swap: beta,alpha → first_question=beta, second_question=alpha" 0 "$actual_exit" "$diff_out"
}

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
if [ "$FAIL" -eq 0 ]; then
    echo "PASS $PASS/$TOTAL"
    exit 0
else
    echo "FAIL $PASS/$TOTAL passed, $FAIL/$TOTAL failed"
    exit 1
fi
