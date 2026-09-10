#!/usr/bin/env bash
# Verifies: `mission.py close-stub` refuses (non-zero exit, no mutation) on a
# mission that has real, non-empty milestones — even if some are unfinished.
set -euo pipefail
REPO_ROOT="${1:?usage: verify_mission_close_stub_refuses_real.sh <repo_root>}"
GOLDEN="$REPO_ROOT/.agent/memory/project/specs/mission-py-stub-close/goldens/real-mission-unfinished.md"

SANDBOX=$(mktemp -d)
trap 'rm -rf "$SANDBOX"' EXIT

mkdir -p "$SANDBOX/.agent/memory/project/missions"
MISSION="$SANDBOX/.agent/memory/project/missions/real-mission-unfinished.md"
cp "$GOLDEN" "$MISSION"

cd "$SANDBOX"
if python3 "$REPO_ROOT/execution/mission.py" close-stub "$MISSION" >"$SANDBOX/out.log" 2>&1; then
  echo "FAIL: close-stub should have refused a mission with non-empty milestones (exited 0)"
  cat "$SANDBOX/out.log"
  exit 1
fi

grep -q "status: done" "$MISSION" && { echo "FAIL: mission status was mutated to done despite refusal"; exit 1; }
grep -q "status: in_progress" "$MISSION" || { echo "FAIL: mission file was altered despite refusal"; exit 1; }

echo "PASS: close-stub refused a mission with non-empty milestones and made no changes"
