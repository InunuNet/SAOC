#!/usr/bin/env bash
# verify_f2_close_out_gate.sh -- sandboxed behavioral + static scenarios for
# mission verification-integrity F2 (the milestone-gate close_out bypass,
# hit live 2026-07-29/30 while closing harness-integrity-hardening).
#
# Defect: execution/mission.py's cmd_gate(), when the final milestone
# passes, wrote fm["status"] = "done" directly -- jumping over the
# close_out state whose entire purpose (docs/mission-closeout-gate.md) is
# to force a brain wrap-up (via `mission.py close-out`) before a mission
# can be considered complete. Fix: cmd_gate must write "close_out", never
# "done"; only cmd_close_out may write "done".
#
# Drives the REAL execution/mission.py from repo root against throwaway
# mission fixtures in a mktemp sandbox. Never touches
# .agent/memory/project/missions/ or active.json, never commits, never
# pushes -- the fixture path is passed explicitly as the `mission` arg on
# every subcommand, so no code path here can fall back to the real
# active-mission pointer.
#
# NOTE: gate invocations below pass --allow-skips. F1's fixture leaves
# `contract: null` with no on-disk contract, which (post-F7) makes the
# gate SKIP-and-fail F1 by default -- a correct, unrelated behavior this
# script is not testing. --allow-skips isolates the close_out transition
# under test from F7's skip-verification doctrine.
#
# Usage: verify_f2_close_out_gate.sh <case>
#   writes_close_out_not_done       -- single-milestone mission, final (only)
#                                       milestone gates clean: file must end
#                                       up with status: close_out, NOT
#                                       status: done, and NO top-level
#                                       completed_at; stdout must reference
#                                       close_out/close-out and must NOT
#                                       contain the old "Mission status ->
#                                       done." message.
#   no_bypass_static                 -- static: cmd_gate()'s source must
#                                       assign fm["status"] = "close_out"
#                                       (never "done") in its all-milestones-
#                                       done branch, and must not call
#                                       clear_active() (clearing the active
#                                       pointer early would hide the
#                                       close_out state from the boot-hook
#                                       warning in full_boot.sh).
#   partial_milestone_stays_in_progress -- two-milestone mission, only the
#                                       first milestone gated: mission-level
#                                       status must remain "in_progress" --
#                                       proves the close_out transition is
#                                       conditioned on ALL milestones being
#                                       done, not applied unconditionally.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CASE="${1:-}"

# write_fixture PATH M1_STATUS INCLUDE_M2
#   PATH         -- output mission file path
#   M1_STATUS    -- milestone M1's status field (pre-gate; normally "pending")
#   INCLUDE_M2   -- "yes" to add a second, ungated milestone M2/F2
write_fixture() {
    local path="$1" m1status="$2" include_m2="$3"
    local ms2_block=""
    if [ "$include_m2" = "yes" ]; then
        ms2_block=$(cat <<'YAML'
  - id: M2
    name: Second milestone
    features: [F2]
    status: pending
    gate_ran_at: null
    gate_result: null
    rationale: test
YAML
)
    fi
    cat > "$path" <<YAML
---
schema: athanor.mission/v1
slug: f2-sandbox
goal: sandbox test mission for verify_f2_close_out_gate.sh
created_at: '2026-08-05T00:00:00+00:00'
status: in_progress
features:
  - id: F1
    title: Feature one
    status: done
    agent: dev
    spec: null
    inline_brief: test
    contract: null
    started_at: '2026-08-05T00:00:00+00:00'
    completed_at: '2026-08-05T00:00:00+00:00'
    handoff: null
    notes: ''
  - id: F2
    title: Feature two
    status: pending
    agent: dev
    spec: null
    inline_brief: test
    contract: null
    started_at: null
    completed_at: null
    handoff: null
    notes: ''
milestones:
  - id: M1
    name: First milestone
    features: [F1]
    status: ${m1status}
    gate_ran_at: null
    gate_result: null
    rationale: test
${ms2_block}---

# F2 Sandbox
YAML
}

case "$CASE" in

  writes_close_out_not_done)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    fixture="$tmpdir/mission.md"
    write_fixture "$fixture" pending no

    set +e
    out="$(python3 execution/mission.py gate "$fixture" --milestone M1 --allow-skips 2>&1)"
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: gate exited $exit_code, expected 0"; fail=1; }
    grep -q '^status: close_out$' "$fixture" || { echo "FAIL: mission file does not have status: close_out"; fail=1; }
    grep -q '^status: done$' "$fixture" && { echo "FAIL: mission file has status: done (should be close_out)"; fail=1; }
    grep -q '^completed_at:' "$fixture" && { echo "FAIL: top-level completed_at set by gate (only close-out may set this)"; fail=1; }
    echo "$out" | grep -qi 'close_out\|close-out' || { echo "FAIL: gate stdout does not mention close_out/close-out"; fail=1; }
    echo "$out" | grep -q 'Mission status .* done\.' && { echo "FAIL: gate stdout still prints the old 'Mission status -> done.' message"; fail=1; }

    if [ "$fail" -eq 1 ]; then
        echo "--- fixture after gate ---"
        cat "$fixture"
        echo "--- gate output ---"
        echo "$out"
        exit 1
    fi
    echo "PASS: writes_close_out_not_done"
    ;;

  no_bypass_static)
    body="$(awk '/^def cmd_gate\(/{p=1} p && /^def [a-zA-Z_]+\(/ && !/^def cmd_gate\(/{p=0} p' execution/mission.py)"
    fail=0
    echo "$body" | grep -q 'clear_active(' && { echo "FAIL: cmd_gate() still calls clear_active() -- must not clear the active pointer before close_out is resolved"; fail=1; }
    echo "$body" | grep -Fq 'fm["status"] = "close_out"' || { echo "FAIL: cmd_gate() does not assign fm[\"status\"] = \"close_out\" anywhere"; fail=1; }
    echo "$body" | grep -Fq 'fm["status"] = "done"' && { echo "FAIL: cmd_gate() still assigns fm[\"status\"] = \"done\" directly -- only cmd_close_out may do this"; fail=1; }
    if [ "$fail" -eq 1 ]; then
        echo "--- extracted cmd_gate() body ---"
        echo "$body"
        exit 1
    fi
    echo "PASS: no_bypass_static"
    ;;

  partial_milestone_stays_in_progress)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    fixture="$tmpdir/mission.md"
    write_fixture "$fixture" pending yes

    set +e
    out="$(python3 execution/mission.py gate "$fixture" --milestone M1 --allow-skips 2>&1)"
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: gate exited $exit_code, expected 0"; fail=1; }
    grep -q '^status: in_progress$' "$fixture" || { echo "FAIL: mission-level status changed even though M2 is not done"; fail=1; }
    grep -q '^status: close_out$' "$fixture" && { echo "FAIL: mission prematurely entered close_out with an ungated milestone remaining"; fail=1; }

    if [ "$fail" -eq 1 ]; then
        echo "--- fixture after gate ---"
        cat "$fixture"
        echo "--- gate output ---"
        echo "$out"
        exit 1
    fi
    echo "PASS: partial_milestone_stays_in_progress"
    ;;

  *)
    echo "ERROR: unknown case '$CASE'. Valid: writes_close_out_not_done, no_bypass_static, partial_milestone_stays_in_progress" >&2
    exit 1
    ;;
esac
