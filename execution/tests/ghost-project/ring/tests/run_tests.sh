#!/usr/bin/env bash
# run_tests.sh — Runs all ghost-ring fixture tests and reports PASS/FAIL.
# Exit 0 if all pass; exit 1 if any fail.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RING="$(cd "${SCRIPT_DIR}/.." && pwd)/ring.py"
FIXTURES="${SCRIPT_DIR}/fixtures"

PASS=0
FAIL=0

run_test() {
    local name="$1"
    local capacity="$2"
    local overflow="$3"
    local input="${FIXTURES}/${4}"
    local expected="${FIXTURES}/${5}"
    local expect_exit="${6:-0}"

    set +e
    actual=$(python3 "${RING}" --capacity "${capacity}" --overflow "${overflow}" < "${input}")
    actual_exit=$?
    set -e

    diff_out=$(diff <(echo "${actual}") "${expected}" 2>&1) || true

    if [[ -n "${diff_out}" ]]; then
        echo "FAIL [${name}] — output mismatch:"
        echo "${diff_out}"
        FAIL=$((FAIL + 1))
        return
    fi

    if [[ "${actual_exit}" -ne "${expect_exit}" ]]; then
        echo "FAIL [${name}] — exit code: got ${actual_exit}, expected ${expect_exit}"
        FAIL=$((FAIL + 1))
        return
    fi

    echo "PASS [${name}]"
    PASS=$((PASS + 1))
}

run_test "overwrite" 3 OVERWRITE overwrite.jsonl overwrite_expected.jsonl 0
run_test "reject"    2 REJECT    reject.jsonl    reject_expected.jsonl    1
run_test "peek"      4 REJECT    peek.jsonl      peek_expected.jsonl      0

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
[[ "${FAIL}" -eq 0 ]]
