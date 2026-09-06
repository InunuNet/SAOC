#!/usr/bin/env bash
# verify_f2_baseline_loading_failclosed.sh -- proves the F2 triad preflight fails
# CLOSED (blocks the gate with TRIAD_PREFLIGHT_ERROR_EXIT_CODE=7) when the
# BASELINE-LOADING step itself cannot produce a real classification, not just
# when the linter subprocess (verify_f2_triad_failclosed.sh, A6) misbehaves.
#
# Defect this covers (found by the third Codex GPT-5.5 pass, reproduced by
# @lead 2026-09-06): _load_triad_baseline_paths() and
# _load_triad_baseline_hashes() (execution/contract.py, called from
# _triad_contract_is_grandfathered() around contract.py:947-951) call
# Path.read_text() with NO try/except at all. Point TRIAD_BASELINE_FILE or
# TRIAD_BASELINE_HASH_FILE at a path that can't be read as UTF-8 text and the
# gate dies with a raw, uncaught traceback and exit 1 -- never reaching
# TRIAD_PREFLIGHT_ERROR_EXIT_CODE (7), which decision 1 promises for exactly
# this class of infrastructure error, and which A8 asserts is kept distinct
# from every other exit code for exactly this reason (so a caller can always
# tell "confirmed triad-noncompliant" apart from "preflight infra broke").
# Exit 1 (Python's generic uncaught-exception code) conflates a real
# infrastructure error with dozens of unrelated failure paths -- an
# unhandled traceback is not a fail-closed block, it merely happens to also
# be non-zero.
#
# Two real, deterministically-reproducible sub-cases (both confirmed by
# @lead against current code before this golden was written):
#   1. TRIAD_BASELINE_FILE points at a directory -- IsADirectoryError inside
#      _load_triad_baseline_paths(), which runs unconditionally on every
#      linter-FAIL contract regardless of whether it's actually baselined.
#   2. TRIAD_BASELINE_HASH_FILE points at a directory -- IsADirectoryError
#      inside _load_triad_baseline_hashes(). This one is reached ONLY when
#      the contract's path IS listed in TRIAD_BASELINE_FILE (the hash file
#      is never consulted otherwise -- see _triad_contract_is_grandfathered's
#      early return), so this sub-case's baseline file must list the
#      contract's own repo-relative path to actually exercise the bug.
#
# A third, same-class shape is included for completeness: TRIAD_BASELINE_FILE
# containing bytes that are not valid UTF-8 (UnicodeDecodeError) -- same
# unconditional call path as sub-case 1, no baseline-listing needed.
#
# Deliberately NOT covered here (per @lead's own caveat): chmod-based
# permission-denied fixtures are unreliable when the gate runs as the file
# owner (often still readable, sometimes even as root), and this project's
# autonomy hooks deny chmod 777 / broad rm -rf outright -- neither makes for
# a deterministic, sandboxable assertion. Malformed hash-pin LINES (e.g. a
# line with only one field) are not a defect at all: _load_triad_baseline_hashes
# already skips them silently (`len(parts) != 2: continue`), so there is
# nothing to fail closed on there.
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE="$REPO_ROOT/.agent/memory/project/specs/verification-triad-gate/goldens/fixtures/f2_fixture_noncompliant_ui.yaml"
SANDBOX="$REPO_ROOT/.tmp/sandbox/f2-baseline-loading-failclosed"
TRIAD_PREFLIGHT_ERROR_EXIT_CODE=7
TRIAD_ENFORCEMENT_EXIT_CODE=6

fail=0

_cleanup() {
  [ -n "${SANDBOX:-}" ] && [ -d "$SANDBOX" ] && rm -rf -- "$SANDBOX"
}
trap _cleanup EXIT

if [ ! -f "$FIXTURE" ]; then
  echo "FAIL: fixture not found: $FIXTURE"
  exit 1
fi

mkdir -p "$SANDBOX"
CONTRACT_COPY="$SANDBOX/f2_fixture_noncompliant_ui.yaml"
cp "$FIXTURE" "$CONTRACT_COPY"
CONTRACT_REL_PATH="$(python3 -c "import os,sys; print(os.path.relpath(sys.argv[1], sys.argv[2]))" "$CONTRACT_COPY" "$REPO_ROOT")"

EMPTY_BASELINE="$SANDBOX/empty-baseline.txt"
EMPTY_HASH="$SANDBOX/empty-baseline.sha256"
: > "$EMPTY_BASELINE"
: > "$EMPTY_HASH"

_check_exit7() {
  local label="$1" rc="$2" out="$3"
  if [ "$rc" -eq "$TRIAD_PREFLIGHT_ERROR_EXIT_CODE" ]; then
    echo "ok: $label fails closed, exit $rc"
    return 0
  fi
  echo "FAIL $label: expected exit $TRIAD_PREFLIGHT_ERROR_EXIT_CODE, got $rc (never exit 1's" \
       "uncaught traceback, never exit 0, never $TRIAD_ENFORCEMENT_EXIT_CODE's unrelated" \
       "'confirmed noncompliant' meaning). Output:"
  echo "$out"
  return 1
}

# Sub-case 1: TRIAD_BASELINE_FILE points at a directory. No matching baseline
# entry needed -- _load_triad_baseline_paths() runs unconditionally.
BASELINE_DIR="$SANDBOX/baseline-is-a-dir"
mkdir -p "$BASELINE_DIR"
out1="$(TRIAD_BASELINE_FILE="$BASELINE_DIR" TRIAD_BASELINE_HASH_FILE="$EMPTY_HASH" \
  python3 "$REPO_ROOT/execution/contract.py" gate "$CONTRACT_COPY" --phase 4 --run-checks 2>&1)"
rc1=$?
_check_exit7 "sub-case 1 (TRIAD_BASELINE_FILE is a directory)" "$rc1" "$out1" || fail=1

# Sub-case 2: TRIAD_BASELINE_HASH_FILE points at a directory, WITH the
# contract's own path listed in TRIAD_BASELINE_FILE so the hash-loading call
# is actually reached (it is skipped entirely for a not-listed contract).
LISTED_BASELINE="$SANDBOX/listed-baseline.txt"
printf '%s\n' "$CONTRACT_REL_PATH" > "$LISTED_BASELINE"
HASH_DIR="$SANDBOX/hash-is-a-dir"
mkdir -p "$HASH_DIR"
out2="$(TRIAD_BASELINE_FILE="$LISTED_BASELINE" TRIAD_BASELINE_HASH_FILE="$HASH_DIR" \
  python3 "$REPO_ROOT/execution/contract.py" gate "$CONTRACT_COPY" --phase 4 --run-checks 2>&1)"
rc2=$?
_check_exit7 "sub-case 2 (TRIAD_BASELINE_HASH_FILE is a directory, path listed)" "$rc2" "$out2" || fail=1

# Sub-case 3: TRIAD_BASELINE_FILE contains bytes that are not valid UTF-8.
BAD_UTF8_BASELINE="$SANDBOX/bad-utf8-baseline.txt"
printf '%s\n\xff\xfe not valid utf-8\n' "$CONTRACT_REL_PATH" > "$BAD_UTF8_BASELINE"
out3="$(TRIAD_BASELINE_FILE="$BAD_UTF8_BASELINE" TRIAD_BASELINE_HASH_FILE="$EMPTY_HASH" \
  python3 "$REPO_ROOT/execution/contract.py" gate "$CONTRACT_COPY" --phase 4 --run-checks 2>&1)"
rc3=$?
_check_exit7 "sub-case 3 (TRIAD_BASELINE_FILE has invalid UTF-8 bytes)" "$rc3" "$out3" || fail=1

# Cross-check: none of the three failure outputs may contain a raw Python
# traceback -- decision 1's promise is a loud, actionable stderr message
# naming the failing file, not an interpreter crash dump that happens to
# also be non-zero.
for pair in "1:$out1" "2:$out2" "3:$out3"; do
  n="${pair%%:*}"
  out="${pair#*:}"
  if echo "$out" | grep -q "^Traceback (most recent call last):"; then
    echo "FAIL sub-case $n: output contains a raw Python traceback -- not a fail-closed" \
         "preflight message, an uncaught crash."
    fail=1
  fi
done

if [ "$fail" -eq 0 ]; then
  echo "PASS: baseline-loading errors (directory-as-file, invalid UTF-8) fail closed with" \
       "exit $TRIAD_PREFLIGHT_ERROR_EXIT_CODE, no raw traceback"
fi
exit "$fail"
