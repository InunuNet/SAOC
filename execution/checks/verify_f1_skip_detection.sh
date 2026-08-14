#!/usr/bin/env bash
# verify_f1_skip_detection.sh -- golden-file behavioral check for mission
# verification-integrity F1 (GH #1322): distinct SKIP status for contract.py
# kind:shell assertions (exit 77), gate-level skip blocking with an
# --allow-skips escape hatch, and per-check required:true hard override.
#
# Drives the REAL execution/contract.py (whatever state it's currently in --
# RED pre-fix, GREEN post-fix) against small synthetic fixture contracts,
# each run with CWD set to a fresh tmp sandbox so RESULTS_DIR
# (".agent/memory/scratch/contract-results", relative to CWD) never touches
# the real repo's scratch dir. The fixture assertions are pure `exit N`
# shell commands with no dependency on any other repo state, so no
# repo-mirroring is needed here (contrast with verify_f1_no_regression.sh's
# A9/A10, which exercise real contracts and do need it).
#
# Usage: verify_f1_skip_detection.sh <case>
#   shell_skip_signal            -- A3: exit 77 on a kind:shell command
#                                    classifies verdict=skip (not pass/fail);
#                                    check_cmd's own stdout renders the SKIP
#                                    icon, not PASS.
#   gate_allpass_unchanged       -- A4: all-pass phase (no skips) gates PASS,
#                                    exit 0, with the new summary line and a
#                                    byte-identical final "PASSED" message.
#   gate_skip_default_blocks     -- A5: 1 pass + 1 skip, no --allow-skips ->
#                                    exit 2, no "PASSED" anywhere in output.
#   gate_skip_allowed_passes     -- A6: the identical phase, WITH
#                                    --allow-skips -> exit 0, summary line
#                                    shows the nonzero skip count.
#   gate_required_skip_hardfails -- A7: skip on a required:true check, WITH
#                                    --allow-skips, still exits nonzero.
#   gate_real_fail_unchanged     -- A8: 1 pass + 1 REAL failure (exit 1, no
#                                    skips), gates exit 2 regardless of
#                                    --allow-skips, same rendering as before
#                                    this feature.
#
# Exit 0 = PASS, exit 1 = FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRACT_PY="$REPO_ROOT/execution/contract.py"
CASE="${1:-}"

setup_sandbox() {
  SANDBOX="$(mktemp -d)"
}

# Runs contract.py with CWD=$SANDBOX so RESULTS_DIR is fully isolated from
# the real repo's .agent/memory/scratch/contract-results/. Combines
# stdout+stderr into the captured output.
run_contract_py() {
  ( cd "$SANDBOX" && python3 "$CONTRACT_PY" "$@" ) 2>&1
}

case "$CASE" in
  shell_skip_signal)
    setup_sandbox
    cat > "$SANDBOX/fixture.yaml" <<'EOF'
schema: athanor.contract/v1
slug: f1-skip-fixture-a3
goal: synthetic fixture for A3 -- exit 77 must classify as skip
created_at: '2026-07-30'
assertions:
  phase: 4
  checks:
    - id: A1
      description: exits 77 (skip signal)
      command: "exit 77"
EOF
    OUT="$(run_contract_py check "$SANDBOX/fixture.yaml" --assertion A1)"
    RC=$?
    if [ "$RC" -ne 0 ]; then
      echo "FAIL: check exited $RC for a skip verdict (expected 0 -- skip is not itself a check-invocation failure)" >&2
      echo "$OUT" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    if ! echo "$OUT" | grep -q "^SKIP A1 (shell): SKIP$"; then
      echo "FAIL: check_cmd stdout did not render the SKIP icon for exit-77" >&2
      echo "$OUT" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    if echo "$OUT" | grep -q "^PASS A1"; then
      echo "FAIL: check_cmd rendered PASS for an exit-77 (skip) command" >&2
      echo "$OUT" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    RESULT_FILE="$SANDBOX/.agent/memory/scratch/contract-results/f1-skip-fixture-a3/A1.json"
    if [ ! -f "$RESULT_FILE" ]; then
      echo "FAIL: result file not written: $RESULT_FILE" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    VERDICT="$(python3 -c "import json; print(json.load(open('$RESULT_FILE'))['verdict'])")"
    if [ "$VERDICT" != "skip" ]; then
      echo "FAIL: result JSON verdict is '$VERDICT', expected 'skip'" >&2
      cat "$RESULT_FILE" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    echo "PASS: shell_skip_signal -- exit 77 classified verdict=skip in result JSON, SKIP icon rendered, check_cmd exits 0"
    rm -rf "$SANDBOX"
    ;;

  gate_allpass_unchanged)
    setup_sandbox
    cat > "$SANDBOX/fixture.yaml" <<'EOF'
schema: athanor.contract/v1
slug: f1-skip-fixture-a4
goal: synthetic fixture for A4 -- all-pass phase must gate unchanged
created_at: '2026-07-30'
assertions:
  phase: 4
  checks:
    - id: A1
      description: always passes
      command: "exit 0"
    - id: A2
      description: always passes
      command: "exit 0"
EOF
    OUT="$(run_contract_py gate "$SANDBOX/fixture.yaml" --phase 4 --run-checks)"
    RC=$?
    if [ "$RC" -ne 0 ]; then
      echo "FAIL: all-pass gate exited $RC, expected 0" >&2
      echo "$OUT" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    if ! echo "$OUT" | grep -qF "Phase 4 summary: 2 pass, 0 skip, 0 fail"; then
      echo "FAIL: summary line missing or wrong -- expected 'Phase 4 summary: 2 pass, 0 skip, 0 fail'" >&2
      echo "$OUT" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    if ! echo "$OUT" | grep -qF "PASS Phase 4 gate PASSED. Proceed to next phase."; then
      echo "FAIL: final all-pass message not byte-identical to the pre-feature wording" >&2
      echo "$OUT" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    echo "PASS: gate_allpass_unchanged -- exit 0, summary '2 pass, 0 skip, 0 fail', final message unchanged"
    rm -rf "$SANDBOX"
    ;;

  gate_skip_default_blocks)
    setup_sandbox
    cat > "$SANDBOX/fixture.yaml" <<'EOF'
schema: athanor.contract/v1
slug: f1-skip-fixture-a5a6
goal: synthetic fixture for A5/A6 -- 1 pass + 1 skip, no required
created_at: '2026-07-30'
assertions:
  phase: 4
  checks:
    - id: A1
      description: always passes
      command: "exit 0"
    - id: A2
      description: exits 77 (skip)
      command: "exit 77"
EOF
    OUT="$(run_contract_py gate "$SANDBOX/fixture.yaml" --phase 4 --run-checks)"
    RC=$?
    if [ "$RC" -eq 0 ]; then
      echo "FAIL: gate with an unallowed skip exited 0, expected nonzero" >&2
      echo "$OUT" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    if [ "$RC" -ne 2 ]; then
      echo "FAIL: gate with an unallowed skip exited $RC, expected the existing failure code 2 (no new exit code)" >&2
      echo "$OUT" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    if echo "$OUT" | grep -q "PASSED"; then
      echo "FAIL: 'PASSED' appeared in output of a skip-blocked gate" >&2
      echo "$OUT" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    # Load-bearing for falsifiability: exit-2 + no-PASSED alone is also true
    # of an ordinary real FAIL (exit 77 treated as fail by unpatched
    # contract.py, since 77 != expect_exit 0), so it wouldn't distinguish
    # "blocked because of skip" from "blocked because of a real failure".
    # The per-assertion line must specifically show A2 as SKIP, not FAIL.
    if ! echo "$OUT" | grep -q "SKIP A2: skip"; then
      echo "FAIL: A2 (exit 77) was not rendered/classified as SKIP in the gate's per-assertion lines" >&2
      echo "$OUT" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    echo "PASS: gate_skip_default_blocks -- exit 2, A2 classified SKIP (not FAIL), no 'PASSED' anywhere in output"
    rm -rf "$SANDBOX"
    ;;

  gate_skip_allowed_passes)
    setup_sandbox
    cat > "$SANDBOX/fixture.yaml" <<'EOF'
schema: athanor.contract/v1
slug: f1-skip-fixture-a5a6
goal: synthetic fixture for A5/A6 -- 1 pass + 1 skip, no required
created_at: '2026-07-30'
assertions:
  phase: 4
  checks:
    - id: A1
      description: always passes
      command: "exit 0"
    - id: A2
      description: exits 77 (skip)
      command: "exit 77"
EOF
    OUT="$(run_contract_py gate "$SANDBOX/fixture.yaml" --phase 4 --run-checks --allow-skips)"
    RC=$?
    if [ "$RC" -ne 0 ]; then
      echo "FAIL: gate with --allow-skips exited $RC, expected 0" >&2
      echo "$OUT" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    if ! echo "$OUT" | grep -qF "Phase 4 summary: 1 pass, 1 skip, 0 fail"; then
      echo "FAIL: summary line missing or wrong nonzero skip count -- expected 'Phase 4 summary: 1 pass, 1 skip, 0 fail'" >&2
      echo "$OUT" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    echo "PASS: gate_skip_allowed_passes -- exit 0 with --allow-skips, summary shows 1 pass, 1 skip, 0 fail"
    rm -rf "$SANDBOX"
    ;;

  gate_required_skip_hardfails)
    setup_sandbox
    cat > "$SANDBOX/fixture.yaml" <<'EOF'
schema: athanor.contract/v1
slug: f1-skip-fixture-a7
goal: synthetic fixture for A7 -- required:true skip must survive --allow-skips
created_at: '2026-07-30'
assertions:
  phase: 4
  checks:
    - id: A1
      description: always passes
      command: "exit 0"
    - id: A2
      description: exits 77 (skip), marked required
      command: "exit 77"
      required: true
EOF
    OUT="$(run_contract_py gate "$SANDBOX/fixture.yaml" --phase 4 --run-checks --allow-skips)"
    RC=$?
    if [ "$RC" -eq 0 ]; then
      echo "FAIL: --allow-skips rescued a required:true check's skip -- gate exited 0, expected nonzero" >&2
      echo "$OUT" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    if echo "$OUT" | grep -q "PASSED"; then
      echo "FAIL: 'PASSED' appeared in output despite a required:true skip" >&2
      echo "$OUT" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    # Load-bearing for falsifiability: without a real --allow-skips flag,
    # argparse itself rejects the unrecognized flag (nonzero exit, no
    # PASSED) -- which would trivially satisfy the two checks above even if
    # required:true's override logic didn't exist at all. Confirm the flag
    # was genuinely ACCEPTED (no argparse error) and that A2 was actually
    # classified SKIP before being hard-failed by the required override.
    if echo "$OUT" | grep -qi "unrecognized arguments"; then
      echo "FAIL: --allow-skips was rejected by argparse -- this run did not exercise the required:true override at all" >&2
      echo "$OUT" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    if ! echo "$OUT" | grep -q "SKIP A2: skip"; then
      echo "FAIL: A2 (exit 77) was not rendered/classified as SKIP before the required override hard-failed it" >&2
      echo "$OUT" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    echo "PASS: gate_required_skip_hardfails -- --allow-skips genuinely accepted, A2 classified SKIP, required:true still overrides it to a hard failure"
    rm -rf "$SANDBOX"
    ;;

  gate_real_fail_unchanged)
    setup_sandbox
    cat > "$SANDBOX/fixture.yaml" <<'EOF'
schema: athanor.contract/v1
slug: f1-skip-fixture-a8
goal: synthetic fixture for A8 -- a real failure (no skips) must gate unchanged
created_at: '2026-07-30'
assertions:
  phase: 4
  checks:
    - id: A1
      description: always passes
      command: "exit 0"
    - id: A2
      description: real failure
      command: "exit 1"
EOF
    for FLAGS in "" "--allow-skips"; do
      OUT="$(run_contract_py gate "$SANDBOX/fixture.yaml" --phase 4 --run-checks $FLAGS)"
      RC=$?
      if [ "$RC" -ne 2 ]; then
        echo "FAIL: real-failure gate (flags='$FLAGS') exited $RC, expected 2" >&2
        echo "$OUT" >&2
        rm -rf "$SANDBOX"
        exit 1
      fi
      if ! echo "$OUT" | grep -qF "FAIL Phase 4 gate FAILED. Failing: A2"; then
        echo "FAIL: real-failure rendering changed (flags='$FLAGS') -- expected 'FAIL Phase 4 gate FAILED. Failing: A2'" >&2
        echo "$OUT" >&2
        rm -rf "$SANDBOX"
        exit 1
      fi
    done
    echo "PASS: gate_real_fail_unchanged -- exit 2 and unchanged failing-assertion rendering, with and without --allow-skips"
    rm -rf "$SANDBOX"
    ;;

  *)
    echo "FAIL: unknown case '$CASE' (expected shell_skip_signal|gate_allpass_unchanged|gate_skip_default_blocks|gate_skip_allowed_passes|gate_required_skip_hardfails|gate_real_fail_unchanged)" >&2
    exit 1
    ;;
esac
