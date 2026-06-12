#!/usr/bin/env bash
# Layer 3: mission.py resume handles active.json with mission=null gracefully
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh

echo "=== test_mission_resume_null_active.sh ==="

ACTIVE_JSON=".agent/memory/project/missions/active.json"
BACKUP="$(mktemp)"
ORIG_EXISTS=0

cleanup() {
  if [ "$ORIG_EXISTS" -eq 1 ]; then
    cp "$BACKUP" "$ACTIVE_JSON"
  else
    rm -f "$ACTIVE_JSON"
  fi
  rm -f "$BACKUP"
}
trap cleanup EXIT

if [ -f "$ACTIVE_JSON" ]; then
  cp "$ACTIVE_JSON" "$BACKUP"
  ORIG_EXISTS=1
fi

python3 - <<'PY'
import json
from pathlib import Path
Path(".agent/memory/project/missions").mkdir(parents=True, exist_ok=True)
Path(".agent/memory/project/missions/active.json").write_text(json.dumps({
    "mission": None,
    "checkpoint": None,
    "note": "test null active mission"
}, indent=2))
PY

OUTPUT="$(python3 execution/mission.py resume 2>&1)"
ACTUAL_EXIT=$?

assert_exit "mission.py resume exits 0 when active mission is null" 0 "$ACTUAL_EXIT"
assert_output_contains "mission.py resume prints no active mission guidance" "No active mission" "$OUTPUT"

summary
