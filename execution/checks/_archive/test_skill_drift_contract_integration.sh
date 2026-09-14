#!/usr/bin/env bash
# Proves verify_skill_drift.py's exit-77 SKIP is natively recognized by
# execution/contract.py's own gate machinery (mission verification-integrity,
# GH #1322) when wired directly into a contract.py assertion — not just by
# this mission's own test_skill_drift.sh wrapper, which only checks the
# script's raw exit code and never routes it through contract.py at all.
#
# Built in response to a 2026-08-16 escalation: model-tier-repair's
# contract-f3 assertion A10 skips (no OPENROUTER_API_KEY) but was counted as
# "pass" by `contract.py gate`, because that check script exits 0 for SKIP
# instead of the reserved skip code. Investigation found contract.py itself
# needs no fix — it already has a correct, separately-tested exit-77 SKIP
# mechanism — the defect is entirely at the check-script layer. This script
# is the evidence for that finding, kept as a permanent regression fixture
# rather than a one-off manual proof.
#
# Never touches the real repo's contract-results state — each run uses a
# throwaway sandbox CWD, same isolation pattern as verify_f1_skip_detection.sh.
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SELF_DIR/../.." && pwd)"
CHECK="$REPO_ROOT/execution/checks/verify_skill_drift.py"
CONTRACT_PY="$REPO_ROOT/execution/contract.py"

build_fixture_contract() {
    # build_fixture_contract <dest_yaml> <required true|false>
    local dest="$1" required="$2" skill_root="$3"
    mkdir -p "$skill_root/.agent/skills"
    printf -- '---\nalembic_version: 1.68.0\n---\n# Alembic\ncontent\n' > "$skill_root/.agent/skills/alembic.md"
    cat > "$dest" <<EOF
schema: athanor.contract/v1
slug: f3-contract-integration-fixture
goal: prove verify_skill_drift.py exit-77 SKIP is natively recognized by contract.py gate machinery
created_at: '2026-08-16'
autonomy: high
features:
  - id: F1
    name: fixture
    status: pending
assertions:
  phase: 4
  checks:
    - id: A1
      description: verify_skill_drift.py against an unreachable endpoint (port 1, connection refused)
      required: $required
      command: python3 $CHECK --root $skill_root --endpoint http://127.0.0.1:1/
EOF
}

case "${1:-all}" in
  skip_blocks_by_default)
    workdir="$(mktemp -d /tmp/f3-contract-integ-default.XXXXXX)"
    trap 'rm -rf "$workdir"' EXIT
    build_fixture_contract "$workdir/fixture.yaml" false "$workdir/root"
    mkdir -p "$workdir/sandbox"
    out="$(cd "$workdir/sandbox" && python3 "$CONTRACT_PY" gate "$workdir/fixture.yaml" --phase 4 --run-checks 2>&1)" && rc=0 || rc=$?
    if [ "$rc" -eq 0 ]; then
      echo "FAIL: a required:false skip should still block the gate by default (no --allow-skips) — this is contract.py's existing, tested behavior" >&2
      echo "$out" >&2
      exit 1
    fi
    if ! echo "$out" | grep -q "0 pass, 1 skip, 0 fail"; then
      echo "FAIL: expected '0 pass, 1 skip, 0 fail' — the skip must never be counted as a pass" >&2
      echo "$out" >&2
      exit 1
    fi
    echo "PASS: exit-77 SKIP is recognized by contract.py, kept out of the pass count, and blocks the gate by default"
    ;;
  skip_allowed_with_flag)
    workdir="$(mktemp -d /tmp/f3-contract-integ-allow.XXXXXX)"
    trap 'rm -rf "$workdir"' EXIT
    build_fixture_contract "$workdir/fixture.yaml" false "$workdir/root"
    mkdir -p "$workdir/sandbox"
    out="$(cd "$workdir/sandbox" && python3 "$CONTRACT_PY" gate "$workdir/fixture.yaml" --phase 4 --run-checks --allow-skips 2>&1)" && rc=0 || rc=$?
    if [ "$rc" -ne 0 ]; then
      echo "FAIL: a required:false skip with --allow-skips should pass the gate" >&2
      echo "$out" >&2
      exit 1
    fi
    if ! echo "$out" | grep -q "PASSED (skips allowed)"; then
      echo "FAIL: expected the qualified 'PASSED (skips allowed)' message, never an unqualified PASSED, when a skip is present" >&2
      echo "$out" >&2
      exit 1
    fi
    echo "PASS: --allow-skips permits the gate to pass, with a qualified (never bare) PASSED message"
    ;;
  required_skip_hardfails)
    workdir="$(mktemp -d /tmp/f3-contract-integ-required.XXXXXX)"
    trap 'rm -rf "$workdir"' EXIT
    build_fixture_contract "$workdir/fixture.yaml" true "$workdir/root"
    mkdir -p "$workdir/sandbox"
    out="$(cd "$workdir/sandbox" && python3 "$CONTRACT_PY" gate "$workdir/fixture.yaml" --phase 4 --run-checks --allow-skips 2>&1)" && rc=0 || rc=$?
    if [ "$rc" -eq 0 ]; then
      echo "FAIL: required:true must hard-fail a skip even with --allow-skips" >&2
      echo "$out" >&2
      exit 1
    fi
    if ! echo "$out" | grep -q "1 fail"; then
      echo "FAIL: expected the required skip to be counted as a fail, not a skip" >&2
      echo "$out" >&2
      exit 1
    fi
    echo "PASS: required:true skip hard-fails the gate regardless of --allow-skips"
    ;;
  all)
    "$SELF_DIR/test_skill_drift_contract_integration.sh" skip_blocks_by_default
    "$SELF_DIR/test_skill_drift_contract_integration.sh" skip_allowed_with_flag
    "$SELF_DIR/test_skill_drift_contract_integration.sh" required_skip_hardfails
    ;;
  *)
    echo "usage: $0 {skip_blocks_by_default|skip_allowed_with_flag|required_skip_hardfails|all}" >&2
    exit 2
    ;;
esac
