#!/usr/bin/env bash
# verify_f7_milestone_gate_verifies.sh -- sandboxed behavioral + static
# scenarios for mission verification-integrity F7 (the milestone gate
# certifying without verifying).
#
# Defect: execution/mission.py's cmd_gate() only ever executes a feature's
# contract when feature["contract"] is set in the mission YAML -- i.e. only
# when `mission.py attach-spec` was explicitly run. If a real, passing (or
# failing) contract exists on disk at the standard derived path
# (.agent/memory/project/specs/<slug>/contract-f<N>.yaml -- exactly what
# cmd_resume already knows how to find via _existing_contract_for_feature)
# but attach-spec was never called, cmd_gate falls into its "no contract"
# branch and prints `PASS <fid>: done (no contract)` for ANY status=="done"
# feature, unconditionally -- including one whose real on-disk contract is
# currently FAILING. Observed live 2026-07-29/30: BOTH M1 and M2 of this
# mission's own milestones gated PASS this way while zero contracts were
# actually executed by cmd_gate itself.
#
# Fix under test must do two things:
#   1. When feature["contract"] is unset, auto-discover a contract on disk
#      via the same slug+id derivation cmd_resume already uses, and RUN it
#      (never silently PASS a feature whose real contract is failing).
#   2. When truly no contract exists anywhere (legitimate legacy case),
#      emit a SKIP verdict for that feature -- not PASS -- and by default
#      make the milestone gate FAIL (nonzero exit) unless the caller passes
#      --allow-skips, mirroring contract.py's own skip-fails-by-default
#      doctrine (docs/VALIDATION_CONTRACTS.md, F1).
#
# Drives the REAL execution/mission.py from repo root against throwaway
# mission fixtures in a mktemp sandbox. Mission fixtures live under
# mktemp -- never touches .agent/memory/project/missions/ or active.json.
# Throwaway CONTRACT fixtures must live under
# .agent/memory/project/specs/<sandbox-slug>/ because cmd_resume's existing
# derivation logic hardcodes that path relative to repo root -- this script
# creates that directory fresh under a unique sandbox slug and always
# removes it in a trap, before ever running any mission.py subcommand.
# Never commits, never pushes, never touches a real slug's specs directory.
#
# Usage: verify_f7_milestone_gate_verifies.sh <case>
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CASE="${1:-}"
SANDBOX_SLUG="f7-sandbox-$$-${RANDOM}"
SPECS_DIR=".agent/memory/project/specs/${SANDBOX_SLUG}"

cleanup() {
    rm -rf "${TMPDIR_FIXTURE:-}" "$SPECS_DIR"
}
trap cleanup EXIT

# write_fixture PATH CONTRACT_FIELD
#   PATH           -- output mission file path
#   CONTRACT_FIELD -- value to put in F1's `contract:` field (e.g. "null")
write_fixture() {
    local path="$1" contract_field="$2"
    cat > "$path" <<YAML
---
schema: athanor.mission/v1
slug: ${SANDBOX_SLUG}
goal: sandbox test mission for verify_f7_milestone_gate_verifies.sh
created_at: '2026-08-06T00:00:00+00:00'
status: in_progress
features:
  - id: F1
    title: Feature one
    status: done
    agent: dev
    spec: null
    inline_brief: test
    contract: ${contract_field}
    started_at: '2026-08-06T00:00:00+00:00'
    completed_at: '2026-08-06T00:00:00+00:00'
    handoff: null
    notes: ''
milestones:
  - id: M1
    name: First milestone
    features: [F1]
    status: pending
    gate_ran_at: null
    gate_result: null
    rationale: test
---

# F7 Sandbox
YAML
}

# write_failing_contract PATH -- a contract.py-valid contract with exactly
# one shell assertion that always fails.
write_failing_contract() {
    local path="$1"
    mkdir -p "$(dirname "$path")"
    cat > "$path" <<'YAML'
schema: athanor.contract/v1
slug: SLUG_PLACEHOLDER
goal: sandbox failing contract for verify_f7_milestone_gate_verifies.sh
created_at: '2026-08-06'
autonomy: high

features:
  - id: F1
    name: sandbox feature that must fail its own contract
    status: done

goldens: []

assertions:
  phase: 4
  checks:
    - id: A1
      description: deliberately failing check -- must never render as a milestone PASS
      command: "false"
YAML
    sed -i.bak "s/SLUG_PLACEHOLDER/${SANDBOX_SLUG}/" "$path" && rm -f "${path}.bak"
}

case "$CASE" in

  unattached_failing_contract_not_masked)
    # Core defect repro: F1 is status=done, contract field unset (never
    # attach-spec'd), but a REAL contract exists on disk at the standard
    # derived path and it is FAILING. Today's cmd_gate ignores the on-disk
    # contract entirely and prints a bare PASS "(no contract)".
    TMPDIR_FIXTURE="$(mktemp -d)"
    fixture="$TMPDIR_FIXTURE/mission.md"
    write_fixture "$fixture" "null"
    write_failing_contract "$SPECS_DIR/contract-f1.yaml"

    set +e
    out="$(python3 execution/mission.py gate "$fixture" --milestone M1 2>&1)"
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -ne 0 ] || { echo "FAIL: gate exited 0 despite F1's real on-disk contract failing"; fail=1; }
    echo "$out" | grep -q '(no contract)' && { echo "FAIL: gate still prints '(no contract)' for a feature with a real, discoverable, failing contract on disk"; fail=1; }
    echo "$out" | grep -qi 'FAIL' || { echo "FAIL: gate output contains no FAIL marker even though the discovered contract fails"; fail=1; }

    if [ "$fail" -eq 1 ]; then
        echo "--- gate output ---"
        echo "$out"
        exit 1
    fi
    echo "PASS: unattached_failing_contract_not_masked"
    ;;

  unattached_passing_contract_is_run)
    # Non-regression companion: same auto-discovery path, but the on-disk
    # contract PASSES. Gate must exit 0 and must show evidence the contract
    # was actually executed (not just a bare status-only PASS).
    TMPDIR_FIXTURE="$(mktemp -d)"
    fixture="$TMPDIR_FIXTURE/mission.md"
    write_fixture "$fixture" "null"
    mkdir -p "$SPECS_DIR"
    cat > "$SPECS_DIR/contract-f1.yaml" <<YAML
schema: athanor.contract/v1
slug: ${SANDBOX_SLUG}
goal: sandbox passing contract for verify_f7_milestone_gate_verifies.sh
created_at: '2026-08-06'
autonomy: high

features:
  - id: F1
    name: sandbox feature whose contract must actually run and pass
    status: done

goldens: []

assertions:
  phase: 4
  checks:
    - id: A1
      description: deliberately passing check
      command: "true"
YAML

    set +e
    out="$(python3 execution/mission.py gate "$fixture" --milestone M1 2>&1)"
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: gate exited $exit_code on a genuinely passing discovered contract"; fail=1; }
    echo "$out" | grep -q '(no contract)' && { echo "FAIL: gate prints '(no contract)' even though a real contract was discovered and run"; fail=1; }
    echo "$out" | grep -qi 'contract gate exit=' || { echo "FAIL: gate output shows no evidence the discovered contract was actually executed"; fail=1; }

    if [ "$fail" -eq 1 ]; then
        echo "--- gate output ---"
        echo "$out"
        exit 1
    fi
    echo "PASS: unattached_passing_contract_is_run"
    ;;

  truly_no_contract_skips_and_fails_by_default)
    # Legitimate legacy case: F1 status=done, contract field unset, and NO
    # contract file exists anywhere on disk for it. This must render as a
    # SKIP (never a bare PASS) and, with no flag passed, must fail the gate
    # by default -- mirroring contract.py's own skip-fails-unless-allowed
    # doctrine, so a milestone can never certify green purely because
    # nothing was ever verified.
    TMPDIR_FIXTURE="$(mktemp -d)"
    fixture="$TMPDIR_FIXTURE/mission.md"
    write_fixture "$fixture" "null"
    # deliberately do NOT create $SPECS_DIR/contract-f1.yaml

    set +e
    out="$(python3 execution/mission.py gate "$fixture" --milestone M1 2>&1)"
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -ne 0 ] || { echo "FAIL: gate exited 0 for a feature with no contract anywhere, and no --allow-skips passed"; fail=1; }
    echo "$out" | grep -qi 'SKIP' || { echo "FAIL: gate output contains no SKIP verdict for the truly-unverified feature"; fail=1; }
    echo "$out" | grep -qE '^  PASS F1' && { echo "FAIL: gate still renders a bare PASS for a feature with zero verification"; fail=1; }

    if [ "$fail" -eq 1 ]; then
        echo "--- gate output ---"
        echo "$out"
        exit 1
    fi
    echo "PASS: truly_no_contract_skips_and_fails_by_default"
    ;;

  truly_no_contract_allow_skips_passes)
    # Backward-compat escape hatch: identical fixture, but caller passes
    # --allow-skips. Gate must succeed (exit 0), preserving the old
    # behavior for legacy missions/features that genuinely never had a
    # contract, once the operator has consciously opted in.
    TMPDIR_FIXTURE="$(mktemp -d)"
    fixture="$TMPDIR_FIXTURE/mission.md"
    write_fixture "$fixture" "null"

    set +e
    out="$(python3 execution/mission.py gate "$fixture" --milestone M1 --allow-skips 2>&1)"
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: gate exited $exit_code with --allow-skips passed for a legitimate no-contract legacy feature"; fail=1; }
    echo "$out" | grep -qi 'PASS Milestone M1 gate passed' || { echo "FAIL: gate did not print the milestone-passed summary line even with --allow-skips"; fail=1; }

    if [ "$fail" -eq 1 ]; then
        echo "--- gate output ---"
        echo "$out"
        exit 1
    fi
    echo "PASS: truly_no_contract_allow_skips_passes"
    ;;

  no_bypass_static)
    body="$(awk '/^def cmd_gate\(/{p=1} p && /^def [a-zA-Z_]+\(/ && !/^def cmd_gate\(/{p=0} p' execution/mission.py)"
    fail=0
    echo "$body" | grep -q 'existing_contract_for_feature\|_discover_contract' || { echo "FAIL: cmd_gate() does not call any on-disk contract auto-discovery helper when feature['contract'] is unset"; fail=1; }
    echo "$body" | grep -qi 'skip' || { echo "FAIL: cmd_gate() source contains no SKIP handling at all for the no-contract-found case"; fail=1; }
    if [ "$fail" -eq 1 ]; then
        echo "--- extracted cmd_gate() body ---"
        echo "$body"
        exit 1
    fi
    echo "PASS: no_bypass_static"
    ;;

  *)
    echo "ERROR: unknown case '$CASE'. Valid: unattached_failing_contract_not_masked, unattached_passing_contract_is_run, truly_no_contract_skips_and_fails_by_default, truly_no_contract_allow_skips_passes, no_bypass_static" >&2
    exit 1
    ;;
esac
