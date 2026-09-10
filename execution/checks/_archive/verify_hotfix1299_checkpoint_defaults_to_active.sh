#!/usr/bin/env bash
# GH #1299 — mission.py checkpoint must default to the active mission
# (same active.json resolution resume/activate use) when no positional
# path is given. A fresh/compacted agent without the path handy must be
# able to checkpoint by feature id + status alone.
set -euo pipefail
REPO_ROOT="${1:?usage: verify_hotfix1299_checkpoint_defaults_to_active.sh <repo_root>}"
GOLDEN="$REPO_ROOT/.agent/memory/project/specs/hotfix-1298-1299-mission-resume-checkpoint/goldens/mission-for-checkpoint.md"

SANDBOX=$(mktemp -d)
trap 'rm -rf "$SANDBOX"' EXIT

mkdir -p "$SANDBOX/.agent/memory/project/missions"
MISSION="$SANDBOX/.agent/memory/project/missions/mission-for-checkpoint.md"
cp "$GOLDEN" "$MISSION"

cat > "$SANDBOX/.agent/memory/project/missions/active.json" <<EOF
{"mission": "$MISSION", "checkpoint": {"milestone": "M1", "feature": "F1"}, "activated_at": "2026-07-24T00:00:00+00:00"}
EOF

cd "$SANDBOX"
OUTPUT=$(python3 "$REPO_ROOT/execution/mission.py" checkpoint --feature F1 --status done)
echo "$OUTPUT"

if ! grep -q "status: done" "$MISSION"; then
  echo "FAIL: checkpoint with no positional path did not update the active mission's feature status"
  exit 1
fi

if ! grep -q "feature: F1" "$MISSION"; then
  echo "FAIL: checkpoint with no positional path did not update last_checkpoint.feature"
  exit 1
fi

echo "PASS: checkpoint with no positional path defaults to the active mission and updates it"
