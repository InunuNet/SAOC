#!/usr/bin/env bash
# verify_f2_triad_failclosed.sh -- proves the triad-coverage gate hook fails CLOSED (registry
# on_error: closed, so the stock gate exits 2) when verify_triad_coverage.py itself cannot produce
# a real classification -- unlike the dataset-residue hook, which is on_error: open.
#
# Rationale: the residue guard depends on a live external service where transient blips are
# common; verify_triad_coverage.py is a local file read plus regex, so a broken or missing linter
# is a real regression, not noise (the mission's headline defect was a check that silently
# degraded to PASS when its tool was missing).
#
# Two sub-cases, both via TRIAD_LINTER_SCRIPT_OVERRIDE (test-only env var):
#   1. the linter exits a code outside its documented 0/1 contract (the broken-stub fixture
#      f2_broken_linter_stub.sh exits 9).
#   2. the linter script path does not exist at all.
# Both must exit 2 with HOOK ERROR (never 0, and never 1: an infrastructure error is not a
# confirmed finding).
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURES="$REPO_ROOT/.agent/memory/project/specs/verification-triad-gate/goldens/fixtures"
FIXTURE="$FIXTURES/f2_fixture_noncompliant_ui.yaml"
BROKEN_STUB="$FIXTURES/f2_broken_linter_stub.sh"
SANDBOX="$REPO_ROOT/.tmp/sandbox/f2-triad-failclosed"
ERROR_EXIT_CODE=2

# shellcheck source=../../scripts/gate-hooks/checks/fixture_project.sh
. "$REPO_ROOT/scripts/gate-hooks/checks/fixture_project.sh"

fail=0
trap 'fixture_project_cleanup "$SANDBOX"' EXIT

if [ ! -f "$FIXTURE" ]; then
  echo "FAIL: fixture not found: $FIXTURE"
  exit 1
fi
if [ ! -x "$BROKEN_STUB" ]; then
  echo "FAIL: broken-linter stub missing or not executable: $BROKEN_STUB"
  exit 1
fi

fixture_project_init "$SANDBOX" || { echo "FAIL: could not build the fixture project"; exit 1; }
CONTRACT_COPY="$SANDBOX/c.yaml"
# The fixture predates stock validate's required `created_at`; prepend it to the scratch copy.
{ printf "created_at: '2026-10-25'\n"; cat "$FIXTURE"; } > "$CONTRACT_COPY"
: > "$SANDBOX/empty-baseline.txt"
: > "$SANDBOX/empty-baseline.sha256"

check_closed() {
  # args: label linter-override
  local label="$1" linter="$2" out rc
  out="$(TRIAD_BASELINE_FILE="$SANDBOX/empty-baseline.txt" \
    TRIAD_BASELINE_HASH_FILE="$SANDBOX/empty-baseline.sha256" \
    TRIAD_LINTER_SCRIPT_OVERRIDE="$linter" \
    python3 "$REPO_ROOT/execution/contract.py" gate "$CONTRACT_COPY" --phase 4 --run-checks 2>&1)"
  rc=$?
  if [ "$rc" -ne "$ERROR_EXIT_CODE" ]; then
    echo "FAIL $label: expected exit $ERROR_EXIT_CODE, got $rc. Output:"
    echo "$out"
    fail=1
  elif ! printf '%s' "$out" | grep -q "HOOK ERROR: triad-coverage"; then
    echo "FAIL $label: exit $rc but no triad-coverage HOOK ERROR in the output. Output:"
    echo "$out"
    fail=1
  else
    echo "ok: $label fails closed, exit $rc"
  fi
}

check_closed "sub-case 1 (linter exits 9, outside its 0/1 contract)" "$BROKEN_STUB"
check_closed "sub-case 2 (linter script missing entirely)" "$SANDBOX/does-not-exist.py"

if [ "$fail" -eq 0 ]; then
  echo "PASS: triad hook fails closed on both linter-infra-error shapes"
fi
exit "$fail"
