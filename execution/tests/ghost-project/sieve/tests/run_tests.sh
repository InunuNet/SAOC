#!/usr/bin/env bash
# sieve test runner — runs all assertions and reports pass/fail.
# Usage: bash execution/tests/ghost-project/sieve/tests/run_tests.sh
#   (from project root)
# Or:   bash tests/run_tests.sh
#   (from inside sieve/)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIEVE_DIR="$(dirname "$SCRIPT_DIR")"

echo "Running sieve tests..."
echo "  sieve:  $SIEVE_DIR/sieve.py"
echo "  Python: $(python3 --version)"
echo ""

cd "$SIEVE_DIR"

PASS=0
FAIL=0
TOTAL=0

pass() {
    echo "  PASS: $1"
    PASS=$((PASS + 1))
    TOTAL=$((TOTAL + 1))
}

fail() {
    echo "  FAIL: $1"
    echo "        $2"
    FAIL=$((FAIL + 1))
    TOTAL=$((TOTAL + 1))
}

# ── Step 1: Create fixtures ───────────────────────────────────────────────────
echo "Step 1: Generating fixture files..."
if python3 tests/fixtures/create_fixtures.py; then
    echo "  Fixtures created OK"
else
    echo "  ERROR: create_fixtures.py failed"
    exit 1
fi
echo ""

# Helper: read expected file, strip trailing newline (portable — no GNU head -c -1)
read_expected() {
    python3 -c "
import sys
with open(sys.argv[1], encoding='utf-8') as f:
    content = f.read()
# Strip exactly one trailing newline if present
if content.endswith('\n'):
    content = content[:-1]
print(content, end='')
" "$1"
}

# ── Test 1: Basic NFC ─────────────────────────────────────────────────────────
echo "Test 1: basic input, --normalize nfc"
actual=$(python3 sieve.py --normalize nfc tests/fixtures/sieve_basic.txt)
expected=$(read_expected tests/fixtures/sieve_basic_nfc_expected.txt)
if [ "$actual" = "$expected" ]; then
    pass "basic NFC output matches expected"
else
    fail "basic NFC output mismatch" "$(diff <(printf '%s' "$expected") <(printf '%s' "$actual") | head -20)"
fi

# ── Test 2: Basic none ────────────────────────────────────────────────────────
echo "Test 2: basic input, --normalize none"
actual=$(python3 sieve.py --normalize none tests/fixtures/sieve_basic.txt)
expected=$(read_expected tests/fixtures/sieve_basic_none_expected.txt)
if [ "$actual" = "$expected" ]; then
    pass "basic none output matches expected"
else
    fail "basic none output mismatch" "$(diff <(printf '%s' "$expected") <(printf '%s' "$actual") | head -20)"
fi

# ── Test 3: Boundary NFC ─────────────────────────────────────────────────────
echo "Test 3: boundary input (CRLF), --normalize nfc"
actual=$(python3 sieve.py --normalize nfc tests/fixtures/sieve_boundary.txt)
expected=$(read_expected tests/fixtures/sieve_boundary_nfc_expected.txt)
if [ "$actual" = "$expected" ]; then
    pass "boundary NFC output matches expected"
else
    fail "boundary NFC output mismatch" "$(diff <(printf '%s' "$expected") <(printf '%s' "$actual") | head -20)"
fi

# ── Test 4: Boundary none ─────────────────────────────────────────────────────
echo "Test 4: boundary input (CRLF), --normalize none"
actual=$(python3 sieve.py --normalize none tests/fixtures/sieve_boundary.txt)
expected=$(read_expected tests/fixtures/sieve_boundary_none_expected.txt)
if [ "$actual" = "$expected" ]; then
    pass "boundary none output matches expected"
else
    fail "boundary none output mismatch" "$(diff <(printf '%s' "$expected") <(printf '%s' "$actual") | head -20)"
fi

# ── Test 5: Exit 2 on invalid UTF-8 ──────────────────────────────────────────
echo "Test 5: exit 2 on invalid UTF-8"
TMPFILE=$(mktemp /tmp/sieve_invalid_XXXXXX.txt)
python3 -c "
import sys
with open(sys.argv[1], 'wb') as f:
    f.write(b'\\xff\\xfe invalid utf-8 bytes\\n')
" "$TMPFILE"
set +e
python3 sieve.py --normalize none "$TMPFILE" >/dev/null 2>&1
exit_code=$?
set -e
rm -f "$TMPFILE"
if [ "$exit_code" -eq 2 ]; then
    pass "exit 2 on invalid UTF-8 decode error"
else
    fail "expected exit 2 on invalid UTF-8, got $exit_code" ""
fi

# ── Test 6: Exit 2 on missing file ───────────────────────────────────────────
echo "Test 6: exit 2 on missing file"
set +e
python3 sieve.py --normalize none /nonexistent/path/to/file.txt >/dev/null 2>&1
exit_code=$?
set -e
if [ "$exit_code" -eq 2 ]; then
    pass "exit 2 on missing file"
else
    fail "expected exit 2 on missing file, got $exit_code" ""
fi

# ── Test 7: Exit 0 on success ────────────────────────────────────────────────
echo "Test 7: exit 0 on success"
set +e
python3 sieve.py --normalize nfc tests/fixtures/sieve_basic.txt >/dev/null 2>&1
exit_code=$?
set -e
if [ "$exit_code" -eq 0 ]; then
    pass "exit 0 on successful processing"
else
    fail "expected exit 0 on success, got $exit_code" ""
fi

# ── Test 8: NFD normalization on basic ───────────────────────────────────────
echo "Test 8: NFD normalization smoke test"
# Just verify it runs and line 2 (NFC café) becomes NFD form (5 chars)
actual_line2=$(python3 sieve.py --normalize nfd tests/fixtures/sieve_basic.txt | sed -n '2p')
# NFD of café has 5 codepoints
char_count=$(echo "$actual_line2" | cut -f3)
if [ "$char_count" = "5" ]; then
    pass "NFD normalization expands NFC café to 5 codepoints"
else
    fail "expected NFD café to have 5 codepoints, got $char_count" ""
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
if [ "$FAIL" -eq 0 ]; then
    echo "PASS $PASS/$TOTAL — all tests passed"
    exit 0
else
    echo "FAIL $PASS passed, $FAIL failed out of $TOTAL"
    exit 1
fi
