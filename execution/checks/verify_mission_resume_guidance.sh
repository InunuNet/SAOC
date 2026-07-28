#!/usr/bin/env bash
# Verifies: `mission.py resume` on a 0-milestone mission points the user at
# the close-stub command instead of only telling them to add milestones.
set -euo pipefail
REPO_ROOT="${1:?usage: verify_mission_resume_guidance.sh <repo_root>}"
GOLDEN="$REPO_ROOT/.agent/memory/project/specs/mission-py-stub-close/goldens/stub-mission.md"

SANDBOX=$(mktemp -d)
trap 'rm -rf "$SANDBOX"' EXIT

mkdir -p "$SANDBOX/.agent/memory/project/missions"
MISSION="$SANDBOX/.agent/memory/project/missions/stub-mission.md"
cp "$GOLDEN" "$MISSION"

cd "$SANDBOX"
OUTPUT=$(python3 "$REPO_ROOT/execution/mission.py" resume "$MISSION")

echo "$OUTPUT" | grep -q "close-stub" || {
  echo "FAIL: resume guidance for a 0-milestone mission does not mention close-stub"
  echo "$OUTPUT"
  exit 1
}

echo "PASS: resume guidance references the close-stub command"
