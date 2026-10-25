#!/usr/bin/env bash
# verify_f2_baseline_loading_failclosed.sh -- proves the triad-coverage gate hook fails CLOSED
# (stock gate exit 2, HOOK ERROR) when the BASELINE-LOADING step cannot produce a real
# classification, not just when the linter subprocess misbehaves (verify_f2_triad_failclosed.sh).
#
# An unreadable baseline must never surface as an uncaught traceback or be mistaken for a
# confirmed finding (exit 1): an infrastructure error and a "confirmed triad-noncompliant"
# verdict must stay distinguishable to the caller.
#
# Three deterministic sub-cases:
#   1. TRIAD_BASELINE_FILE is a directory (IsADirectoryError); read for every linter-FAIL
#      contract whether or not it is baselined.
#   2. TRIAD_BASELINE_HASH_FILE is a directory; reached only when the contract IS listed in
#      TRIAD_BASELINE_FILE, so that sub-case's baseline lists the contract's own key.
#   3. TRIAD_BASELINE_FILE holds bytes that are not valid UTF-8 (UnicodeDecodeError).
#
# Not covered: chmod-based permission-denied fixtures (unreliable as the file owner, and the
# autonomy hooks deny chmod 777). Malformed pin LINES (one field) are not a defect: they are
# skipped silently.
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE="$REPO_ROOT/.agent/memory/project/specs/verification-triad-gate/goldens/fixtures/f2_fixture_noncompliant_ui.yaml"
SANDBOX="$REPO_ROOT/.tmp/sandbox/f2-baseline-loading-failclosed"
ERROR_EXIT_CODE=2
CONTRACT_NAME="c.yaml"

# shellcheck source=../../scripts/gate-hooks/checks/fixture_project.sh
. "$REPO_ROOT/scripts/gate-hooks/checks/fixture_project.sh"

fail=0
trap 'fixture_project_cleanup "$SANDBOX"' EXIT

if [ ! -f "$FIXTURE" ]; then
  echo "FAIL: fixture not found: $FIXTURE"
  exit 1
fi

fixture_project_init "$SANDBOX" || { echo "FAIL: could not build the fixture project"; exit 1; }
CONTRACT_COPY="$SANDBOX/$CONTRACT_NAME"
# The fixture predates stock validate's required `created_at`; prepend it to the scratch copy.
{ printf "created_at: '2026-10-25'\n"; cat "$FIXTURE"; } > "$CONTRACT_COPY"
: > "$SANDBOX/empty-baseline.sha256"

# args: label baseline-file hash-file ; sets $fail, prints the verdict, leaves output in $last_out
check_closed() {
  local label="$1" rc
  last_out="$(TRIAD_BASELINE_FILE="$2" TRIAD_BASELINE_HASH_FILE="$3" \
    python3 "$REPO_ROOT/execution/contract.py" gate "$CONTRACT_COPY" --phase 4 --run-checks 2>&1)"
  rc=$?
  if [ "$rc" -ne "$ERROR_EXIT_CODE" ]; then
    echo "FAIL $label: expected exit $ERROR_EXIT_CODE, got $rc (never 0, never 1's finding"
    echo "meaning). Output:"
    echo "$last_out"
    fail=1
  elif ! printf '%s' "$last_out" | grep -q "TRIAD PREFLIGHT ERROR"; then
    echo "FAIL $label: exit $rc but no TRIAD PREFLIGHT ERROR banner. Output:"
    echo "$last_out"
    fail=1
  elif printf '%s' "$last_out" | grep -q "^Traceback (most recent call last):"; then
    echo "FAIL $label: output contains a raw Python traceback. Output:"
    echo "$last_out"
    fail=1
  else
    echo "ok: $label fails closed, exit $rc, no traceback"
  fi
}

mkdir -p "$SANDBOX/baseline-is-a-dir"
check_closed "sub-case 1 (TRIAD_BASELINE_FILE is a directory)" \
  "$SANDBOX/baseline-is-a-dir" "$SANDBOX/empty-baseline.sha256"

printf '%s\n' "$CONTRACT_NAME" > "$SANDBOX/listed-baseline.txt"
mkdir -p "$SANDBOX/hash-is-a-dir"
check_closed "sub-case 2 (TRIAD_BASELINE_HASH_FILE is a directory, path listed)" \
  "$SANDBOX/listed-baseline.txt" "$SANDBOX/hash-is-a-dir"

printf '%s\n\xff\xfe not valid utf-8\n' "$CONTRACT_NAME" > "$SANDBOX/bad-utf8-baseline.txt"
check_closed "sub-case 3 (TRIAD_BASELINE_FILE has invalid UTF-8 bytes)" \
  "$SANDBOX/bad-utf8-baseline.txt" "$SANDBOX/empty-baseline.sha256"

if [ "$fail" -eq 0 ]; then
  echo "PASS: baseline-loading errors (directory-as-file, invalid UTF-8) fail closed with" \
       "exit $ERROR_EXIT_CODE, no raw traceback"
fi
exit "$fail"
