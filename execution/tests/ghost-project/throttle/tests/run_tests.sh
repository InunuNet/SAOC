#!/usr/bin/env bash
# Run all golden-fixture tests for throttle.py.
# Exit 0 if all pass, 1 if any fail.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
THROTTLE="${SCRIPT_DIR}/../throttle.py"
FIXTURES="${SCRIPT_DIR}/fixtures"

PASS=0
FAIL=0

run_test() {
    local name="$1"
    local window="$2"
    local limit="$3"
    local input_file="$4"
    local expected_file="$5"

    if python3 "${THROTTLE}" --window "${window}" --limit "${limit}" \
            < "${input_file}" | diff - "${expected_file}" > /dev/null 2>&1; then
        echo "PASS: ${name}"
        PASS=$((PASS + 1))
    else
        echo "FAIL: ${name}"
        FAIL=$((FAIL + 1))
    fi
}

run_test "basic (--window 60 --limit 2)" \
    60 2 \
    "${FIXTURES}/basic.jsonl" \
    "${FIXTURES}/basic_expected.jsonl"

run_test "deny (--window 10 --limit 3)" \
    10 3 \
    "${FIXTURES}/deny.jsonl" \
    "${FIXTURES}/deny_expected.jsonl"

run_test "boundary (--window 60 --limit 1)" \
    60 1 \
    "${FIXTURES}/boundary.jsonl" \
    "${FIXTURES}/boundary_expected.jsonl"

# Empty input test: must exit 0 and produce no output.
empty_output="$(python3 "${THROTTLE}" --window 60 --limit 2 \
    < "${FIXTURES}/empty.jsonl" 2>/dev/null)"
if [ -z "${empty_output}" ]; then
    echo "PASS: empty input (no output)"
    PASS=$((PASS + 1))
else
    echo "FAIL: empty input (unexpected output)"
    FAIL=$((FAIL + 1))
fi

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"

if [ "${FAIL}" -gt 0 ]; then
    exit 1
fi

exit 0
