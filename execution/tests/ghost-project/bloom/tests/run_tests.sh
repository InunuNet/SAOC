#!/usr/bin/env bash
# Run all ghost-bloom fixture tests via diff against expected output.
# Exit 0 if all pass, 1 if any fail.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLOOM="${SCRIPT_DIR}/../bloom.py"
FIXTURES="${SCRIPT_DIR}/fixtures"

PASS=0
FAIL=0

run_test() {
    local name="$1"
    local m="$2"
    local k="$3"
    local input="${FIXTURES}/${name}.jsonl"
    local expected="${FIXTURES}/${name}_expected.jsonl"

    if python3 "${BLOOM}" --m "${m}" --k "${k}" < "${input}" | diff - "${expected}" > /dev/null 2>&1; then
        echo "PASS: ${name}"
        PASS=$((PASS + 1))
    else
        echo "FAIL: ${name}"
        python3 "${BLOOM}" --m "${m}" --k "${k}" < "${input}" | diff - "${expected}" || true
        FAIL=$((FAIL + 1))
    fi
}

run_test "basic"       16 2
run_test "idempotent"  16 2
run_test "no_false_neg" 16 2

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"

[ "${FAIL}" -eq 0 ]
