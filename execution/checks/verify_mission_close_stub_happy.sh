#!/usr/bin/env bash
# Verifies: `mission.py close-stub` closes a 0-milestone stub mission as done
# and clears active.json when that mission was the active one.
set -euo pipefail
REPO_ROOT="${1:?usage: verify_mission_close_stub_happy.sh <repo_root>}"
GOLDEN="$REPO_ROOT/.agent/memory/project/specs/mission-py-stub-close/goldens/stub-mission.md"

SANDBOX=$(mktemp -d)
trap 'rm -rf "$SANDBOX"' EXIT

mkdir -p "$SANDBOX/.agent/memory/project/missions"
MISSION="$SANDBOX/.agent/memory/project/missions/stub-mission.md"
cp "$GOLDEN" "$MISSION"

cat > "$SANDBOX/.agent/memory/project/missions/active.json" <<EOF
{"mission": "$MISSION", "checkpoint": {"milestone": null, "feature": null}, "activated_at": "2026-07-01T00:00:00+00:00"}
EOF

cd "$SANDBOX"
OUTPUT=$(python3 "$REPO_ROOT/execution/mission.py" close-stub "$MISSION")

grep -q "status: done" "$MISSION" || { echo "FAIL: mission status was not set to done"; exit 1; }

if [ -f "$SANDBOX/.agent/memory/project/missions/active.json" ]; then
  echo "FAIL: active.json was not cleared for the closed active mission"
  exit 1
fi

echo "$OUTPUT" | grep -qi "done\|closed" || { echo "FAIL: no confirmation message printed"; echo "$OUTPUT"; exit 1; }

echo "PASS: close-stub set status=done and cleared active.json"
