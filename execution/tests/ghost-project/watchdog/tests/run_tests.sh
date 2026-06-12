#!/usr/bin/env bash
# watchdog test runner
# Usage: bash execution/tests/ghost-project/watchdog/tests/run_tests.sh
#        (or: cd execution/tests/ghost-project/watchdog && bash tests/run_tests.sh)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WATCHDOG_DIR="$(dirname "$SCRIPT_DIR")"
WATCHDOG="$WATCHDOG_DIR/watchdog.py"
FIXTURES="$SCRIPT_DIR/fixtures"
SCRATCH="$(mktemp -d)"

pass=0
fail=0

check() {
    local name="$1"
    local actual="$2"
    local expected="$3"
    if [ "$actual" = "$expected" ]; then
        echo "PASS: $name"
        pass=$((pass + 1))
    else
        echo "FAIL: $name"
        echo "  expected: $(echo "$expected" | head -5)"
        echo "  actual:   $(echo "$actual"   | head -5)"
        fail=$((fail + 1))
    fi
}

check_exit() {
    local name="$1"
    local actual_exit="$2"
    local expected_exit="$3"
    if [ "$actual_exit" -eq "$expected_exit" ]; then
        echo "PASS: $name (exit $actual_exit)"
        pass=$((pass + 1))
    else
        echo "FAIL: $name (expected exit $expected_exit, got $actual_exit)"
        fail=$((fail + 1))
    fi
}

echo "Running watchdog tests..."
echo "  watchdog: $WATCHDOG"
echo "  Python:   $(python3 --version)"
echo ""

# ── Test 1: Main fixture — catches TOTAL 10 naive impl ─────────────────────
actual=$(python3 "$WATCHDOG" "$FIXTURES/tasks.txt" 2>&1)
expected=$(cat "$FIXTURES/expected.txt")
check "main fixture (FIFO, TOTAL 12)" "$actual" "$expected"

# ── Test 2: Boundary — single leaf ─────────────────────────────────────────
actual=$(python3 "$WATCHDOG" "$FIXTURES/boundary_tasks.txt" 2>&1)
expected=$(cat "$FIXTURES/boundary_expected.txt")
check "boundary: single leaf task" "$actual" "$expected"

# ── Test 3: Three-level chain ───────────────────────────────────────────────
chain_file="$SCRATCH/chain.txt"
printf 'root mid\nmid leaf\n' > "$chain_file"
actual=$(python3 "$WATCHDOG" "$chain_file" 2>&1)
expected="$(printf 'PROCESSED root\nPROCESSED mid\nPROCESSED leaf\nTOTAL 3')"
check "three-level chain: all 3 processed" "$actual" "$expected"

# ── Test 4: Exit 2 on duplicate line-leader ─────────────────────────────────
dup_file="$SCRATCH/dup.txt"
printf 'root A\nA x\nA y\n' > "$dup_file"
set +e
python3 "$WATCHDOG" "$dup_file" > /dev/null 2>&1
dup_exit=$?
set -e
check_exit "exit 2 on duplicate TASK_ID line-leader" "$dup_exit" 2

# ── Test 5: Exit 2 on empty file ───────────────────────────────────────────
empty_file="$SCRATCH/empty.txt"
> "$empty_file"
set +e
python3 "$WATCHDOG" "$empty_file" > /dev/null 2>&1
empty_exit=$?
set -e
check_exit "exit 2 on empty file" "$empty_exit" 2

# ── Cleanup ─────────────────────────────────────────────────────────────────
rm -rf "$SCRATCH"

total=$((pass + fail))
echo ""
if [ "$fail" -eq 0 ]; then
    echo "PASS $pass/$total"
    exit 0
else
    echo "FAIL $fail/$total"
    exit 1
fi
