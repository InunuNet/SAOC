#!/usr/bin/env bash
# Layer 3: pulse_mission_loop reconciles stale duplicate-slug active missions
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh

echo "=== test_pulse_mission_loop_duplicate_slug_reconcile.sh ==="

ACTIVE_JSON=".agent/memory/project/missions/active.json"
OLD_MISSION=".agent/memory/project/missions/2026-05-19-test-dup-loop.md"
NEW_MISSION=".agent/memory/project/missions/2026-05-20-test-dup-loop.md"
QUEUE_FILE=".agent/mission_queue.txt"

ACTIVE_BACKUP="$(mktemp)"
QUEUE_BACKUP="$(mktemp)"
ACTIVE_EXISTS=0
QUEUE_EXISTS=0

cleanup() {
  rm -f "$OLD_MISSION" "$NEW_MISSION"
  if [ "$ACTIVE_EXISTS" -eq 1 ]; then
    cp "$ACTIVE_BACKUP" "$ACTIVE_JSON"
  else
    rm -f "$ACTIVE_JSON"
  fi
  if [ "$QUEUE_EXISTS" -eq 1 ]; then
    cp "$QUEUE_BACKUP" "$QUEUE_FILE"
  else
    rm -f "$QUEUE_FILE"
  fi
  rm -f "$ACTIVE_BACKUP" "$QUEUE_BACKUP"
}
trap cleanup EXIT

if [ -f "$ACTIVE_JSON" ]; then
  cp "$ACTIVE_JSON" "$ACTIVE_BACKUP"
  ACTIVE_EXISTS=1
fi

if [ -f "$QUEUE_FILE" ]; then
  cp "$QUEUE_FILE" "$QUEUE_BACKUP"
  QUEUE_EXISTS=1
fi

python3 - <<'PY'
import json
from pathlib import Path

old_mission = Path(".agent/memory/project/missions/2026-05-19-test-dup-loop.md")
new_mission = Path(".agent/memory/project/missions/2026-05-20-test-dup-loop.md")
old_mission.write_text("""---
schema: athanor.mission/v1
slug: test-dup-loop
goal: test-dup-loop
created_at: '2026-05-19T00:00:00+00:00'
status: pending
features: []
milestones: []
---

# Mission: test-dup-loop
""")
new_mission.write_text("""---
schema: athanor.mission/v1
slug: test-dup-loop
goal: Implement duplicate-slug regression coverage
created_at: '2026-05-20T00:00:00+00:00'
status: done
features:
  - id: F1
    title: done
    status: done
milestones:
  - id: M1
    name: done
    features: [F1]
    status: done
---

# Mission: test-dup-loop
""")
Path(".agent/memory/project/missions/active.json").write_text(json.dumps({
    "mission": str(old_mission),
    "checkpoint": {"milestone": None, "feature": None},
    "note": "test duplicate slug reconcile"
}, indent=2))
Path(".agent/mission_queue.txt").write_text("# slug|goal — one per line\n")
PY

OUTPUT="$(CODEX_CI=1 bash execution/pulse_mission_loop.sh --dry-run 2>&1)"
ACTUAL_EXIT=$?

ACTIVE_PATH="$(python3 - <<'PY'
import json
from pathlib import Path
data = json.loads(Path(".agent/memory/project/missions/active.json").read_text())
print(data.get("mission"))
PY
)"

assert_exit "pulse_mission_loop duplicate-slug dry-run exits 0" 0 "$ACTUAL_EXIT"
assert_output_contains "pulse_mission_loop clears stale duplicate slug" "No active mission and queue empty — idle." "$OUTPUT"
assert_output_contains "active.json mission cleared after duplicate-slug reconciliation" "None" "$ACTIVE_PATH"

summary
