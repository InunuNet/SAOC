#!/usr/bin/env bash
# verify_f6_phase_routing.sh -- golden-file behavioral check for mission
# verification-integrity F6 (GH #1317): normalize_contract() must route
# per-check `phase:` fields on individual `checks:` list items into
# distinct synthesized phases, instead of collapsing every check into one
# block-level (or default) phase.
#
# Drives the REAL execution/contract.py (whatever state it's currently in --
# RED pre-fix, GREEN post-fix) against small synthetic fixture contracts,
# each run with CWD set to a fresh tmp sandbox so RESULTS_DIR
# (".agent/memory/scratch/contract-results", relative to CWD) never touches
# the real repo's scratch dir. Fixture assertions are pure `echo`/`exit N`
# shell commands with no dependency on any other repo state, so no
# repo-mirroring is needed (contrast with verify_f1_no_regression.sh's
# A9/A10, which exercise real contracts and do need it).
#
# Usage: verify_f6_phase_routing.sh <case>
#   repro_report_grouping        -- exact GH #1317 repro: 4 checks, 3 distinct
#                                    per-check phases (1,2,1,3) must synthesize
#                                    into 3 phases with correct membership,
#                                    observed via `contract.py report`'s Phase
#                                    column (not just an exit code).
#   phase_isolation_pass          -- gate --phase 1 --run-checks on a fixture
#                                    where phase-1 checks all pass but a
#                                    phase-2 check FAILS must exit 0 and never
#                                    mention the phase-2 check id -- proves
#                                    phase 1 does not include phase-2 checks.
#   phase_isolation_fail          -- gate --phase 2 --run-checks on the same
#                                    fixture must exit 2 and print a FAIL line
#                                    for the phase-2 check id specifically
#                                    (not a "phase not found" error, and no
#                                    mention of the phase-1 check ids) --
#                                    proves phase 2 is a real, populated phase
#                                    of its own, not an artifact of collapse.
#   no_per_check_phase_field      -- when NO check in the checks: list
#                                    declares its own phase:, the existing
#                                    (pre-F6) behavior is unchanged: every
#                                    check lands in the block-level phase
#                                    (explicit, here 5) -- non-regression for
#                                    the common single-phase contract shape.
#   mixed_fallback                -- when SOME checks declare phase: and
#                                    others don't, in a contract that also
#                                    sets a non-default block-level phase:
#                                    (here 2), a check WITHOUT its own phase:
#                                    falls back to the block-level phase, not
#                                    to 1.
#   required_skip_with_phase      -- F1 x F6 interaction: a check on a
#                                    non-default phase (2) marked required:
#                                    true that skips (exit 77) still hard-
#                                    fails that phase's gate even with
#                                    --allow-skips -- proves required:true
#                                    survives normalization together with
#                                    per-check phase routing.
#
# Exit 0 = PASS, exit 1 = FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRACT_PY="$REPO_ROOT/execution/contract.py"
CASE="${1:-}"

setup_sandbox() {
  SANDBOX="$(mktemp -d)"
}

cleanup() {
  [ -n "${SANDBOX:-}" ] && rm -rf "$SANDBOX"
}
trap cleanup EXIT

# Runs contract.py with CWD=$SANDBOX so RESULTS_DIR is fully isolated from
# the real repo's .agent/memory/scratch/contract-results/. Combines
# stdout+stderr into the captured output.
run_contract_py() {
  ( cd "$SANDBOX" && python3 "$CONTRACT_PY" "$@" ) 2>&1
}

case "$CASE" in
  repro_report_grouping)
    setup_sandbox
    # Exact repro shape from GH #1317.
    cat > "$SANDBOX/fixture.yaml" <<'EOF'
schema: athanor.contract/v1
slug: f6-repro-fixture
goal: exact GH #1317 repro -- per-check phase must route into distinct phases
created_at: '2026-07-30'
assertions:
  checks:
    - id: A1
      phase: 1
      description: Check phase 1 assertion 1
      command: echo "P1A1"
    - id: A2
      phase: 2
      description: Check phase 2 assertion 1
      command: echo "P2A1"
    - id: A3
      phase: 1
      description: Check phase 1 assertion 2
      command: echo "P1A2"
    - id: A4
      phase: 3
      description: Check phase 3 assertion 1
      command: echo "P3A1"
EOF
    OUT="$(run_contract_py report "$SANDBOX/fixture.yaml")"
    FAIL=0
    for pair in "A1:1" "A2:2" "A3:1" "A4:3"; do
      aid="${pair%%:*}"
      phase="${pair##*:}"
      if ! echo "$OUT" | grep -qE "^${aid}[[:space:]]+${phase}[[:space:]]"; then
        echo "FAIL: report did not show $aid routed to phase $phase" >&2
        FAIL=1
      fi
    done
    if [ "$FAIL" != "0" ]; then
      echo "$OUT" >&2
      exit 1
    fi
    echo "PASS: repro_report_grouping -- report shows A1=1, A2=2, A3=1, A4=3 (3 distinct phases synthesized correctly)"
    ;;

  phase_isolation_pass|phase_isolation_fail)
    setup_sandbox
    cat > "$SANDBOX/fixture.yaml" <<'EOF'
schema: athanor.contract/v1
slug: f6-isolation-fixture
goal: phase-1 checks must not be contaminated by a failing phase-2 check
created_at: '2026-07-30'
assertions:
  checks:
    - id: A1
      phase: 1
      description: phase 1 pass
      command: "echo first-pass; exit 0"
    - id: A2
      phase: 2
      description: phase 2 FAIL (deliberately)
      command: "echo deliberate-fail; exit 1"
    - id: A3
      phase: 1
      description: phase 1 pass
      command: "echo second-pass; exit 0"
EOF
    if [ "$CASE" = "phase_isolation_pass" ]; then
      OUT="$(run_contract_py gate "$SANDBOX/fixture.yaml" --phase 1 --run-checks)"
      RC=$?
      if [ "$RC" -ne 0 ]; then
        echo "FAIL: gate --phase 1 exited $RC (expected 0 -- phase 1 has only 2 passing checks and must not see phase 2's failing check)" >&2
        echo "$OUT" >&2
        exit 1
      fi
      if echo "$OUT" | grep -q "A2"; then
        echo "FAIL: gate --phase 1 output mentions A2 -- phase 1 is contaminated by a phase-2 check" >&2
        echo "$OUT" >&2
        exit 1
      fi
      if ! echo "$OUT" | grep -q "PASS A1" || ! echo "$OUT" | grep -q "PASS A3"; then
        echo "FAIL: gate --phase 1 did not render PASS for both A1 and A3" >&2
        echo "$OUT" >&2
        exit 1
      fi
      echo "PASS: phase_isolation_pass -- gate --phase 1 exits 0, sees only A1+A3, never mentions A2"
    else
      OUT="$(run_contract_py gate "$SANDBOX/fixture.yaml" --phase 2 --run-checks)"
      RC=$?
      if [ "$RC" -ne 2 ]; then
        echo "FAIL: gate --phase 2 exited $RC (expected 2 -- phase 2 must be a real, populated phase containing the failing A2, not a missing-phase error)" >&2
        echo "$OUT" >&2
        exit 1
      fi
      if echo "$OUT" | grep -q "phase 2 not found"; then
        echo "FAIL: gate --phase 2 reported 'phase not found' -- per-check phase routing did not synthesize phase 2 at all" >&2
        echo "$OUT" >&2
        exit 1
      fi
      if ! echo "$OUT" | grep -q "FAIL A2"; then
        echo "FAIL: gate --phase 2 did not render FAIL for A2 specifically" >&2
        echo "$OUT" >&2
        exit 1
      fi
      if echo "$OUT" | grep -qE "A1|A3"; then
        echo "FAIL: gate --phase 2 output mentions A1 or A3 -- phase 2 is contaminated by phase-1 checks" >&2
        echo "$OUT" >&2
        exit 1
      fi
      echo "PASS: phase_isolation_fail -- gate --phase 2 exits 2, sees only A2 (real FAIL, not a missing-phase artifact), never mentions A1/A3"
    fi
    ;;

  no_per_check_phase_field)
    setup_sandbox
    cat > "$SANDBOX/fixture.yaml" <<'EOF'
schema: athanor.contract/v1
slug: f6-no-per-check-phase
goal: no check declares its own phase -- must fall back to block-level phase, unchanged from pre-F6 behavior
created_at: '2026-07-30'
assertions:
  phase: 5
  checks:
    - id: A1
      description: no phase field
      command: "exit 0"
    - id: A2
      description: no phase field
      command: "exit 0"
EOF
    OUT="$(run_contract_py report "$SANDBOX/fixture.yaml")"
    if ! echo "$OUT" | grep -qE "^A1[[:space:]]+5[[:space:]]" || ! echo "$OUT" | grep -qE "^A2[[:space:]]+5[[:space:]]"; then
      echo "FAIL: with no per-check phase fields, A1/A2 must both land on the block-level phase (5)" >&2
      echo "$OUT" >&2
      exit 1
    fi
    GATE5_OUT="$(run_contract_py gate "$SANDBOX/fixture.yaml" --phase 5 --run-checks)"
    GATE5_RC=$?
    if [ "$GATE5_RC" -ne 0 ]; then
      echo "FAIL: gate --phase 5 should pass (both checks pass, both belong to phase 5)" >&2
      echo "$GATE5_OUT" >&2
      exit 1
    fi
    GATE1_OUT="$(run_contract_py gate "$SANDBOX/fixture.yaml" --phase 1 --run-checks)"
    GATE1_RC=$?
    if [ "$GATE1_RC" -eq 0 ] || ! echo "$GATE1_OUT" | grep -q "phase 1 not found"; then
      echo "FAIL: gate --phase 1 should report 'phase 1 not found' -- checks must NOT default to phase 1 when a block-level phase (5) is explicitly set" >&2
      echo "$GATE1_OUT" >&2
      exit 1
    fi
    echo "PASS: no_per_check_phase_field -- both checks land on block-level phase 5, not phase 1"
    ;;

  mixed_fallback)
    setup_sandbox
    cat > "$SANDBOX/fixture.yaml" <<'EOF'
schema: athanor.contract/v1
slug: f6-mixed-fallback
goal: a check without its own phase falls back to the block-level phase, not to 1
created_at: '2026-07-30'
assertions:
  phase: 2
  checks:
    - id: A1
      description: no phase field -- falls back to block-level phase 2
      command: "exit 0"
    - id: A2
      phase: 9
      description: explicit phase 9 overrides block-level phase
      command: "exit 0"
EOF
    OUT="$(run_contract_py report "$SANDBOX/fixture.yaml")"
    if ! echo "$OUT" | grep -qE "^A1[[:space:]]+2[[:space:]]"; then
      echo "FAIL: A1 (no phase field) must fall back to block-level phase 2, not 1 or 9" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -qE "^A2[[:space:]]+9[[:space:]]"; then
      echo "FAIL: A2's explicit phase: 9 must override the block-level phase" >&2
      echo "$OUT" >&2
      exit 1
    fi
    echo "PASS: mixed_fallback -- A1 falls back to block-level phase 2, A2's explicit phase 9 is honored"
    ;;

  required_skip_with_phase)
    setup_sandbox
    cat > "$SANDBOX/fixture.yaml" <<'EOF'
schema: athanor.contract/v1
slug: f6-required-skip-phase
goal: required:true must still hard-fail a skip on a non-default per-check phase, with --allow-skips passed
created_at: '2026-07-30'
assertions:
  checks:
    - id: A1
      phase: 2
      required: true
      description: required, skips (exit 77), on phase 2
      command: "exit 77"
EOF
    OUT="$(run_contract_py gate "$SANDBOX/fixture.yaml" --phase 2 --run-checks --allow-skips)"
    RC=$?
    if [ "$RC" -eq 0 ]; then
      echo "FAIL: gate --phase 2 --allow-skips exited 0 -- required:true must hard-fail a skip regardless of --allow-skips, even under per-check phase routing" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if echo "$OUT" | grep -q "PASSED"; then
      echo "FAIL: gate output contains PASSED -- a required:true skip must never be rendered as a passing gate" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if echo "$OUT" | grep -q "phase 2 not found"; then
      echo "FAIL: gate reported 'phase 2 not found' -- per-check phase routing did not synthesize phase 2" >&2
      echo "$OUT" >&2
      exit 1
    fi
    echo "PASS: required_skip_with_phase -- required:true skip on a routed non-default phase still hard-fails with --allow-skips"
    ;;

  *)
    echo "FAIL: unknown case '$CASE' (expected one of: repro_report_grouping|phase_isolation_pass|phase_isolation_fail|no_per_check_phase_field|mixed_fallback|required_skip_with_phase)" >&2
    exit 1
    ;;
esac
