#!/usr/bin/env bash
# Layer 3: mission.py resume handles active.json with mission=null gracefully
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh

echo "=== test_mission_resume_null_active.sh ==="

ACTIVE_JSON=".agent/memory/project/missions/active.json"
MARKER_JSON="$(python3 -c 'import sys; sys.path.insert(0, "execution"); import boot_panel; print(boot_panel.MARKER_REL)')"
BACKUP="$(mktemp)"
MARKER_BACKUP="$(mktemp)"
ORIG_EXISTS=0
MARKER_ORIG_EXISTS=0

cleanup() {
  if [ "$ORIG_EXISTS" -eq 1 ]; then
    cp "$BACKUP" "$ACTIVE_JSON"
  else
    rm -f "$ACTIVE_JSON"
  fi
  if [ "$MARKER_ORIG_EXISTS" -eq 1 ]; then
    cp "$MARKER_BACKUP" "$MARKER_JSON"
  else
    rm -f "$MARKER_JSON"
  fi
  rm -f "$BACKUP" "$MARKER_BACKUP"
}
trap cleanup EXIT

if [ -f "$ACTIVE_JSON" ]; then
  cp "$ACTIVE_JSON" "$BACKUP"
  ORIG_EXISTS=1
fi

if [ -f "$MARKER_JSON" ]; then
  cp "$MARKER_JSON" "$MARKER_BACKUP"
  MARKER_ORIG_EXISTS=1
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

# Isolate the boot-panel marker too: a stale or halting marker left over from
# ambient workspace state must not make this test's outcome depend on it
# (P0 stale-boot-marker finding). Write a fresh, non-halting one.
python3 - <<'PY'
import sys
sys.path.insert(0, "execution")
import boot_panel
from pathlib import Path
root = Path(".").resolve()
doc = {"verdict": "ok", "halt_reasons": [], "collected_at": boot_panel._iso(boot_panel._now()),
       "workspace": {"project_name": None, "version": None}}
boot_panel.write_marker(root, doc)
PY

OUTPUT="$(python3 execution/mission.py resume 2>&1)"
ACTUAL_EXIT=$?

assert_exit "mission.py resume exits 0 when active mission is null" 0 "$ACTUAL_EXIT"
assert_output_contains "mission.py resume prints no active mission guidance" "No active mission" "$OUTPUT"

summary
