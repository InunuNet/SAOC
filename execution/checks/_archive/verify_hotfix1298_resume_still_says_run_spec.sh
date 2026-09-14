#!/usr/bin/env bash
# GH #1298 REGRESSION GUARD — when F1 genuinely has no contract on disk
# anywhere under specs/<slug>/, resume must still say "run /spec for F1".
# The #1298 fix must not make resume silent or wrongly claim a contract
# exists when it doesn't.
set -euo pipefail
REPO_ROOT="${1:?usage: verify_hotfix1298_resume_still_says_run_spec.sh <repo_root>}"
GOLDENS_DIR="$REPO_ROOT/.agent/memory/project/specs/hotfix-1298-1299-mission-resume-checkpoint/goldens"
GOLDEN_MISSION="$GOLDENS_DIR/mission-without-contract.md"

SANDBOX=$(mktemp -d)
trap 'rm -rf "$SANDBOX"' EXIT

mkdir -p "$SANDBOX/.agent/memory/project/missions"
MISSION="$SANDBOX/.agent/memory/project/missions/mission-without-contract.md"
cp "$GOLDEN_MISSION" "$MISSION"
# Deliberately do NOT create .agent/memory/project/specs/golden-1298-without-contract/ —
# no contract exists anywhere for this mission's F1.

cd "$SANDBOX"
OUTPUT=$(python3 "$REPO_ROOT/execution/mission.py" resume "$MISSION")

if ! echo "$OUTPUT" | grep -qi "run /spec"; then
  echo "FAIL: resume no longer says 'run /spec' for a feature with genuinely no contract (regression)"
  echo "$OUTPUT"
  exit 1
fi

if echo "$OUTPUT" | grep -qi "dispatch @dev against existing contract"; then
  echo "FAIL: resume falsely claimed an existing contract when none exists on disk"
  echo "$OUTPUT"
  exit 1
fi

echo "PASS: resume still correctly says 'run /spec' when no contract exists on disk"
