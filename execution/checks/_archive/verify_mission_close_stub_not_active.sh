#!/usr/bin/env bash
# Verifies: `mission.py close-stub` leaves active.json untouched when the
# closed mission was NOT the currently active mission.
set -euo pipefail
REPO_ROOT="${1:?usage: verify_mission_close_stub_not_active.sh <repo_root>}"
GOLDEN="$REPO_ROOT/.agent/memory/project/specs/mission-py-stub-close/goldens/stub-mission.md"

SANDBOX=$(mktemp -d)
trap 'rm -rf "$SANDBOX"' EXIT

mkdir -p "$SANDBOX/.agent/memory/project/missions"
MISSION="$SANDBOX/.agent/memory/project/missions/stub-mission.md"
cp "$GOLDEN" "$MISSION"

OTHER_MISSION="$SANDBOX/.agent/memory/project/missions/some-other-mission.md"
cat > "$SANDBOX/.agent/memory/project/missions/active.json" <<EOF
{"mission": "$OTHER_MISSION", "checkpoint": {"milestone": null, "feature": null}, "activated_at": "2026-07-01T00:00:00+00:00"}
EOF

cd "$SANDBOX"
python3 "$REPO_ROOT/execution/mission.py" close-stub "$MISSION" >/dev/null

grep -q "status: done" "$MISSION" || { echo "FAIL: mission status was not set to done"; exit 1; }

if [ ! -f "$SANDBOX/.agent/memory/project/missions/active.json" ]; then
  echo "FAIL: active.json was removed even though the closed mission was not the active one"
  exit 1
fi

grep -q "$OTHER_MISSION" "$SANDBOX/.agent/memory/project/missions/active.json" || {
  echo "FAIL: active.json content was altered for an unrelated active mission"
  exit 1
}

echo "PASS: close-stub left an unrelated active.json untouched"
