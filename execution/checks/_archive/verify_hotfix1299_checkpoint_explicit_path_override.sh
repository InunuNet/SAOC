#!/usr/bin/env bash
# GH #1299 BACKWARD-COMPAT — an explicit positional mission path must still
# override the active.json default, exactly like existing callers expect.
# active.json points at a DIFFERENT mission than the one passed explicitly;
# only the explicitly-passed mission may be modified.
set -euo pipefail
REPO_ROOT="${1:?usage: verify_hotfix1299_checkpoint_explicit_path_override.sh <repo_root>}"
GOLDENS_DIR="$REPO_ROOT/.agent/memory/project/specs/hotfix-1298-1299-mission-resume-checkpoint/goldens"

SANDBOX=$(mktemp -d)
trap 'rm -rf "$SANDBOX"' EXIT

mkdir -p "$SANDBOX/.agent/memory/project/missions"

ACTIVE_MISSION="$SANDBOX/.agent/memory/project/missions/mission-with-contract.md"
OTHER_MISSION="$SANDBOX/.agent/memory/project/missions/mission-for-checkpoint.md"
cp "$GOLDENS_DIR/mission-with-contract.md" "$ACTIVE_MISSION"
cp "$GOLDENS_DIR/mission-for-checkpoint.md" "$OTHER_MISSION"

cat > "$SANDBOX/.agent/memory/project/missions/active.json" <<EOF
{"mission": "$ACTIVE_MISSION", "checkpoint": {"milestone": "M1", "feature": "F1"}, "activated_at": "2026-07-24T00:00:00+00:00"}
EOF

cd "$SANDBOX"
# Explicit path targets OTHER_MISSION, even though active.json points at ACTIVE_MISSION.
python3 "$REPO_ROOT/execution/mission.py" checkpoint "$OTHER_MISSION" --feature F1 --status done

if grep -q "status: done" "$ACTIVE_MISSION"; then
  echo "FAIL: checkpoint with an explicit path modified the active.json mission instead (override not honored)"
  exit 1
fi

if ! grep -q "status: done" "$OTHER_MISSION"; then
  echo "FAIL: checkpoint with an explicit path did not update the explicitly-passed mission"
  exit 1
fi

echo "PASS: explicit positional path still overrides the active.json default"
