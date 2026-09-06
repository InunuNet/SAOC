#!/usr/bin/env bash
# verify_f2_gate_enforcement.sh -- end-to-end proof that contract.py's real
# `gate` subcommand enforces the triad-coverage preflight (mission
# verification-triad-gate M2/F2), not just that verify_triad_coverage.py
# classifies correctly in isolation.
#
# Three scenarios, each a real `python3 execution/contract.py gate` subprocess
# invocation against a scratch copy of the noncompliant UI fixture
# (f2_fixture_noncompliant_ui.yaml), with TRIAD_BASELINE_FILE /
# TRIAD_BASELINE_HASH_FILE env-overridden to scratch baseline files so
# nothing here touches the real execution/triad-baseline-exempt.txt:
#
#   1. not_baselined_blocks        -- contract not in any baseline -> gate
#                                      blocks, exit TRIAD_ENFORCEMENT_EXIT_CODE (6).
#   2. baselined_unedited_passes   -- contract listed in baseline with a
#                                      hash matching its current content ->
#                                      triad preflight does not block; gate
#                                      proceeds to run NC-01 (trivially true)
#                                      and passes.
#   3. baselined_but_edited_blocks -- contract listed in baseline, but its
#                                      content hash no longer matches the
#                                      recorded hash (edited since
#                                      baselining) -> re-arms enforcement ->
#                                      gate blocks again, same exit code as
#                                      scenario 1.
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE="$REPO_ROOT/.agent/memory/project/specs/verification-triad-gate/goldens/fixtures/f2_fixture_noncompliant_ui.yaml"
SANDBOX="$REPO_ROOT/.tmp/sandbox/f2-gate-enforcement"
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
CONTRACT_REL="$(python3 -c "import os,sys; print(os.path.relpath(sys.argv[1], sys.argv[2]))" "$CONTRACT_COPY" "$REPO_ROOT")"

# --- Scenario 1: not in any baseline -> blocked ---
EMPTY_BASELINE="$SANDBOX/empty-baseline.txt"
EMPTY_HASH="$SANDBOX/empty-baseline.sha256"
: > "$EMPTY_BASELINE"
: > "$EMPTY_HASH"

out1="$(TRIAD_BASELINE_FILE="$EMPTY_BASELINE" TRIAD_BASELINE_HASH_FILE="$EMPTY_HASH" \
  python3 "$REPO_ROOT/execution/contract.py" gate "$CONTRACT_COPY" --phase 4 --run-checks 2>&1)"
rc1=$?
if [ "$rc1" -ne "$TRIAD_ENFORCEMENT_EXIT_CODE" ]; then
  echo "FAIL scenario 1 (not_baselined_blocks): expected exit $TRIAD_ENFORCEMENT_EXIT_CODE, got $rc1. Output:"
  echo "$out1"
  fail=1
else
  echo "ok: scenario 1 (unbaselined noncompliant UI contract) blocked, exit $rc1"
fi

# --- Scenario 2: baselined with a hash matching current content -> passes ---
HASH2="$(python3 -c "import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" "$CONTRACT_COPY")"
BASELINE2="$SANDBOX/matching-baseline.txt"
HASHFILE2="$SANDBOX/matching-baseline.sha256"
printf '%s\n' "$CONTRACT_REL" > "$BASELINE2"
printf '%s  %s\n' "$HASH2" "$CONTRACT_REL" > "$HASHFILE2"

out2="$(TRIAD_BASELINE_FILE="$BASELINE2" TRIAD_BASELINE_HASH_FILE="$HASHFILE2" \
  python3 "$REPO_ROOT/execution/contract.py" gate "$CONTRACT_COPY" --phase 4 --run-checks 2>&1)"
rc2=$?
# "gate exit != 6" alone is vacuous: it is equally satisfied by an unrelated earlier
# preflight (e.g. the dataset-residue guard) blocking at exit 4 before the triad
# preflight ever runs, as it was in production earlier this mission. Assert the
# SPECIFIC expected exit code (0 -- NC-01 is trivially true, so a correctly
# grandfathered gate must reach _gate_dispatch and pass it) AND positive evidence,
# scraped from contract.py's own grandfather-path print (see
# execution/contract.py's "TRIAD PREFLIGHT: ... is missing triad kind(s) but is
# grandfathered ..." message), that the triad preflight specifically ran, found this
# contract noncompliant, and chose not to block it because of the baseline -- not
# that it never ran at all.
if [ "$rc2" -ne 0 ]; then
  echo "FAIL scenario 2 (baselined_unedited_passes): expected gate exit 0 (grandfathered, NC-01 trivially true), got $rc2. Output:"
  echo "$out2"
  fail=1
elif ! printf '%s' "$out2" | grep -q "grandfathered in the rollout baseline"; then
  echo "FAIL scenario 2 (baselined_unedited_passes): gate exited 0 but printed no evidence the"
  echo "triad preflight actually ran and grandfathered this contract -- exit 0 alone cannot"
  echo "distinguish 'correctly grandfathered' from 'triad preflight never reached / silently"
  echo "skipped'. Output:"
  echo "$out2"
  fail=1
else
  echo "ok: scenario 2 (baselined, unedited) triad preflight ran, found it noncompliant, and"
  echo "    grandfathered it (gate exit 0, grandfather message present)"
fi

# --- Scenario 3: baselined, but content edited since (hash mismatch) -> re-blocks ---
CONTRACT_EDITED="$SANDBOX/f2_fixture_noncompliant_ui_edited.yaml"
cp "$CONTRACT_COPY" "$CONTRACT_EDITED"
printf '\n# edited after baselining\n' >> "$CONTRACT_EDITED"
EDITED_REL="$(python3 -c "import os,sys; print(os.path.relpath(sys.argv[1], sys.argv[2]))" "$CONTRACT_EDITED" "$REPO_ROOT")"
BASELINE3="$SANDBOX/stale-baseline.txt"
HASHFILE3="$SANDBOX/stale-baseline.sha256"
printf '%s\n' "$EDITED_REL" > "$BASELINE3"
# Hash file still records the PRE-edit hash (HASH2), simulating "edited since baselined".
printf '%s  %s\n' "$HASH2" "$EDITED_REL" > "$HASHFILE3"

out3="$(TRIAD_BASELINE_FILE="$BASELINE3" TRIAD_BASELINE_HASH_FILE="$HASHFILE3" \
  python3 "$REPO_ROOT/execution/contract.py" gate "$CONTRACT_EDITED" --phase 4 --run-checks 2>&1)"
rc3=$?
if [ "$rc3" -ne "$TRIAD_ENFORCEMENT_EXIT_CODE" ]; then
  echo "FAIL scenario 3 (baselined_but_edited_blocks): expected exit $TRIAD_ENFORCEMENT_EXIT_CODE after hash mismatch re-armed enforcement, got $rc3. Output:"
  echo "$out3"
  fail=1
else
  echo "ok: scenario 3 (baselined but edited since) re-armed and blocked, exit $rc3"
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: contract.py gate real-execution enforcement verified for all three baseline scenarios"
fi
exit "$fail"
