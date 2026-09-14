#!/usr/bin/env bash
# GH #1300 Finding 4 root cause, re-scoped 2026-08-06 after F2
# (commit 7e669fd4, verification-integrity/contract-f2.yaml).
#
# ORIGINAL DEFECT (pre-F2): `mission.py gate --milestone <last>` flipped a
# mission's frontmatter status straight to a terminal state ("done") without
# calling clear_active() -- leaving active.json pointing at an
# already-finished mission, the exact state that paralyzed
# require_contract_for_write.sh (GH #1300).
#
# WHY THIS SCRIPT CHANGED, NOT JUST GOT PATCHED: F2 deliberately redesigned
# the milestone-gate's terminal transition. cmd_gate() now writes
# `status: close_out` (never "done") and DOES NOT call clear_active() --
# on purpose, so full_boot.sh's boot warning and `mission.py resume` can
# keep surfacing the pending close-out until `mission.py close-out` runs.
# See docs/mission-closeout-gate.md and
# verification-integrity/contract-f2.yaml (A3, anti_patterns) -- that
# contract explicitly FORBIDS cmd_gate() from calling clear_active() again.
# A check asserting "gate clears active.json" would therefore assert
# behavior F2 intentionally deleted and would conflict with a sibling
# contract's anti-pattern; rewriting it to require clearing active.json is
# not a valid fix.
#
# WHAT STILL MATTERS FROM THE ORIGINAL DEFECT: the actual outcome GH #1300
# cared about -- a finished mission's stale active.json pointer must never
# cause require_contract_for_write.sh to block ordinary writes -- is a
# separate guarantee, already covered independently in THIS SAME contract
# by A8 (terminal-status mission fails open at the hook layer, regardless
# of whether active.json was cleared). That guarantee does not depend on
# this script.
#
# WHAT THIS SCRIPT NOW ASSERTS INSTEAD: the milestone-gate path's *current*
# intended terminal transition, so a regression back toward the pre-F2
# mechanism (status: done written directly, active.json cleared/missing
# from cmd_gate) is caught here too, not only via F2's own static check:
#   1. Gating the final milestone of the GH #1300 fixture mission leaves
#      status: close_out on disk -- never status: done.
#   2. active.json is left in place (NOT cleared) -- clearing it here would
#      be the F2 regression this script now guards against.
set -euo pipefail
REPO_ROOT="${1:?usage: verify_hotfix1300_gate_clears_active_json.sh <repo_root>}"
GOLDEN="$REPO_ROOT/.agent/memory/project/specs/hotfix-1300-writegate/goldens/gate-completion-mission.md"

SANDBOX=$(mktemp -d)
trap 'rm -rf "$SANDBOX"' EXIT

mkdir -p "$SANDBOX/.agent/memory/project/missions"
MISSION="$SANDBOX/.agent/memory/project/missions/gate-completion-mission.md"
cp "$GOLDEN" "$MISSION"

cat > "$SANDBOX/.agent/memory/project/missions/active.json" <<EOF
{"mission": "$MISSION", "checkpoint": {"milestone": "M1", "feature": "F1"}, "activated_at": "2026-07-19T00:00:00+00:00"}
EOF

cd "$SANDBOX"

# The fixture's F1 has no `contract` field and no slug-derived contract on
# disk (its slug is a throwaway fixture slug) -- post-F7, that makes the
# gate SKIP-and-fail by default. --allow-skips isolates the close_out
# transition under test from F7's unrelated skip-verification doctrine
# (same reasoning as verify_f2_close_out_gate.sh).
set +e
OUTPUT=$(python3 "$REPO_ROOT/execution/mission.py" gate --milestone M1 --allow-skips "$MISSION" 2>&1)
GATE_EXIT=$?
set -e

if [ "$GATE_EXIT" -ne 0 ]; then
  echo "FAIL: mission.py gate exited $GATE_EXIT, expected 0"
  echo "$OUTPUT"
  exit 1
fi

grep -q '^status: close_out$' "$MISSION" || {
  echo "FAIL: mission status is not close_out after the milestone gate completed the final milestone"
  echo "$OUTPUT"
  cat "$MISSION"
  exit 1
}

grep -q '^status: done$' "$MISSION" && {
  echo "FAIL: mission status is done -- cmd_gate() must never write status: done directly (regression of the pre-F2 GH #1300 mechanism; only cmd_close_out may write done)"
  exit 1
}

if [ ! -f "$SANDBOX/.agent/memory/project/missions/active.json" ]; then
  echo "FAIL: active.json was cleared by the milestone gate -- this is the pre-F2 mechanism reintroduced. active.json must stay in place through close_out so full_boot.sh and 'mission.py resume' keep surfacing the pending wrap-up until 'mission.py close-out' runs."
  exit 1
fi

echo "PASS: milestone gate transitions the fixture mission to close_out (never done) and leaves active.json in place, per the F2-redesigned lifecycle"
