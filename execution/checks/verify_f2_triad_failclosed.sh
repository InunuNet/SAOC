#!/usr/bin/env bash
# verify_f2_triad_failclosed.sh -- proves the F2 triad preflight fails
# CLOSED (blocks the gate) when verify_triad_coverage.py itself cannot
# produce a real classification -- unlike the dataset-residue guard's
# documented fail-OPEN precedent (execution/contract.py:745-761).
#
# Decision rationale (see contract-f2.yaml goal, decision 1): the residue
# guard's dependency is a live external network service (Sanity) shared
# across every concurrent gate run, where transient blips are common and
# blocking unrelated work on one is a real availability cost.
# verify_triad_coverage.py has zero external dependencies -- local file read
# + regex, no subprocess of its own, no network -- so a broken/missing
# linter is a real code regression, not noise, and this mission's own
# headline defect is exactly a check that silently degraded to PASS when
# its tool was missing (browser_deployed_check.sh:156, F1). Fail-closed
# keeps this preflight from repeating that defect one layer up.
#
# Two sub-cases, both via TRIAD_LINTER_SCRIPT_OVERRIDE (test-only env var,
# mirrors CONTRACT_GATE_RESIDUE_FIXTURE's existing pattern -- never set in
# real runs):
#   1. linter script exits a code outside its documented 0/1/2 contract
#      (the broken-stub fixture, f2_broken_linter_stub.sh, exits 9).
#   2. linter script path does not exist at all.
# Both must block with TRIAD_PREFLIGHT_ERROR_EXIT_CODE (7), never exit 0,
# and never TRIAD_ENFORCEMENT_EXIT_CODE (6) -- an infra error is not a
# confirmed finding.
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE="$REPO_ROOT/.agent/memory/project/specs/verification-triad-gate/goldens/fixtures/f2_fixture_noncompliant_ui.yaml"
BROKEN_STUB="$REPO_ROOT/.agent/memory/project/specs/verification-triad-gate/goldens/fixtures/f2_broken_linter_stub.sh"
SANDBOX="$REPO_ROOT/.tmp/sandbox/f2-triad-failclosed"
TRIAD_PREFLIGHT_ERROR_EXIT_CODE=7

fail=0

_cleanup() {
  [ -n "${SANDBOX:-}" ] && [ -d "$SANDBOX" ] && rm -rf -- "$SANDBOX"
}
trap _cleanup EXIT

if [ ! -f "$FIXTURE" ]; then
  echo "FAIL: fixture not found: $FIXTURE"
  exit 1
fi
if [ ! -x "$BROKEN_STUB" ]; then
  echo "FAIL: broken-linter stub missing or not executable: $BROKEN_STUB"
  exit 1
fi

mkdir -p "$SANDBOX"
CONTRACT_COPY="$SANDBOX/f2_fixture_noncompliant_ui.yaml"
cp "$FIXTURE" "$CONTRACT_COPY"
EMPTY_BASELINE="$SANDBOX/empty-baseline.txt"
EMPTY_HASH="$SANDBOX/empty-baseline.sha256"
: > "$EMPTY_BASELINE"
: > "$EMPTY_HASH"

# Sub-case 1: linter exits an out-of-contract code (9).
out1="$(TRIAD_BASELINE_FILE="$EMPTY_BASELINE" TRIAD_BASELINE_HASH_FILE="$EMPTY_HASH" \
  TRIAD_LINTER_SCRIPT_OVERRIDE="$BROKEN_STUB" \
  python3 "$REPO_ROOT/execution/contract.py" gate "$CONTRACT_COPY" --phase 4 --run-checks 2>&1)"
rc1=$?
if [ "$rc1" -ne "$TRIAD_PREFLIGHT_ERROR_EXIT_CODE" ]; then
  echo "FAIL sub-case 1 (linter exits out-of-contract code): expected exit $TRIAD_PREFLIGHT_ERROR_EXIT_CODE, got $rc1. Output:"
  echo "$out1"
  fail=1
else
  echo "ok: sub-case 1 (linter exits 9, out of its 0/1/2 contract) fails closed, exit $rc1"
fi

# Sub-case 2: linter path does not exist at all.
MISSING_LINTER="$SANDBOX/does-not-exist.py"
out2="$(TRIAD_BASELINE_FILE="$EMPTY_BASELINE" TRIAD_BASELINE_HASH_FILE="$EMPTY_HASH" \
  TRIAD_LINTER_SCRIPT_OVERRIDE="$MISSING_LINTER" \
  python3 "$REPO_ROOT/execution/contract.py" gate "$CONTRACT_COPY" --phase 4 --run-checks 2>&1)"
rc2=$?
if [ "$rc2" -ne "$TRIAD_PREFLIGHT_ERROR_EXIT_CODE" ]; then
  echo "FAIL sub-case 2 (linter script missing): expected exit $TRIAD_PREFLIGHT_ERROR_EXIT_CODE, got $rc2. Output:"
  echo "$out2"
  fail=1
else
  echo "ok: sub-case 2 (linter script missing entirely) fails closed, exit $rc2"
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: triad preflight fails closed on both linter-infra-error shapes"
fi
exit "$fail"
