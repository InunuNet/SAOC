#!/usr/bin/env bash
# verify_f2_gate_enforcement.sh -- end-to-end proof that the stock `gate` enforces the
# triad-coverage preflight through the project-owned triad-coverage gate hook
# (scripts/gate-hooks/triad_hook.py, registered in .agent/contract_kinds.json), not just that
# verify_triad_coverage.py classifies correctly in isolation.
#
# Three scenarios, each a real `python3 execution/contract.py gate` run against a scratch copy of
# the noncompliant UI fixture (f2_fixture_noncompliant_ui.yaml) inside a fixture project, with
# TRIAD_BASELINE_FILE / TRIAD_BASELINE_HASH_FILE pointed at scratch baseline files so nothing here
# touches the real execution/triad-baseline-exempt.txt. Stock exit semantics: 1 is a hook finding.
#
#   1. not_baselined_blocks        -- not in any baseline -> gate exits 1, HOOK FINDING.
#   2. baselined_unedited_passes   -- listed, pin matches the live bytes -> the hook warns
#                                      (grandfathered) and the gate proceeds and exits 0.
#   3. baselined_but_edited_blocks -- listed, pinned, then edited -> the pin no longer matches,
#                                      enforcement re-arms, gate exits 1.
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE="$REPO_ROOT/.agent/memory/project/specs/verification-triad-gate/goldens/fixtures/f2_fixture_noncompliant_ui.yaml"
SANDBOX="$REPO_ROOT/.tmp/sandbox/f2-gate-enforcement"
FINDING_EXIT_CODE=1
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

run_gate() {
  # args: baseline-file hash-file
  TRIAD_BASELINE_FILE="$1" TRIAD_BASELINE_HASH_FILE="$2" \
    python3 "$REPO_ROOT/execution/contract.py" gate "$CONTRACT_COPY" --phase 4 --run-checks 2>&1
}

sha_of() {
  python3 -c "import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" "$1"
}

# --- Scenario 1: not in any baseline -> blocked ---
: > "$SANDBOX/empty-baseline.txt"
: > "$SANDBOX/empty-baseline.sha256"
out1="$(run_gate "$SANDBOX/empty-baseline.txt" "$SANDBOX/empty-baseline.sha256")"
rc1=$?
if [ "$rc1" -ne "$FINDING_EXIT_CODE" ]; then
  echo "FAIL scenario 1 (not_baselined_blocks): expected exit $FINDING_EXIT_CODE, got $rc1. Output:"
  echo "$out1"
  fail=1
elif ! printf '%s' "$out1" | grep -q "HOOK FINDING: triad-coverage"; then
  echo "FAIL scenario 1: exit $rc1 but no triad-coverage HOOK FINDING in the output. Output:"
  echo "$out1"
  fail=1
else
  echo "ok: scenario 1 (unbaselined noncompliant UI contract) blocked by the hook, exit $rc1"
fi

# --- Scenario 2: baselined with a pin matching current content -> passes ---
HASH2="$(sha_of "$CONTRACT_COPY")"
printf '%s\n' "$CONTRACT_NAME" > "$SANDBOX/matching-baseline.txt"
printf '%s  %s\n' "$HASH2" "$CONTRACT_NAME" > "$SANDBOX/matching-baseline.sha256"
out2="$(run_gate "$SANDBOX/matching-baseline.txt" "$SANDBOX/matching-baseline.sha256")"
rc2=$?
# Exit 0 alone cannot tell "correctly grandfathered" from "hook never ran", so also require the
# hook's own grandfather line.
if [ "$rc2" -ne 0 ]; then
  echo "FAIL scenario 2 (baselined_unedited_passes): expected gate exit 0, got $rc2. Output:"
  echo "$out2"
  fail=1
elif ! printf '%s' "$out2" | grep -q "grandfathered in the rollout baseline"; then
  echo "FAIL scenario 2: gate exited 0 but printed no evidence the triad hook ran and"
  echo "grandfathered this contract. Output:"
  echo "$out2"
  fail=1
else
  echo "ok: scenario 2 (baselined, unedited) hook ran, found it noncompliant, and grandfathered"
  echo "    it (gate exit 0, grandfather message present)"
fi

# --- Scenario 3: baselined, but content edited since (pin mismatch) -> re-blocks ---
printf '\n# edited after baselining\n' >> "$CONTRACT_COPY"
out3="$(run_gate "$SANDBOX/matching-baseline.txt" "$SANDBOX/matching-baseline.sha256")"
rc3=$?
if [ "$rc3" -ne "$FINDING_EXIT_CODE" ]; then
  echo "FAIL scenario 3 (baselined_but_edited_blocks): expected exit $FINDING_EXIT_CODE after the pin"
  echo "mismatch re-armed enforcement, got $rc3. Output:"
  echo "$out3"
  fail=1
else
  echo "ok: scenario 3 (baselined but edited since) re-armed and blocked, exit $rc3"
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: stock gate + triad-coverage hook enforcement verified for all three baseline scenarios"
fi
exit "$fail"
