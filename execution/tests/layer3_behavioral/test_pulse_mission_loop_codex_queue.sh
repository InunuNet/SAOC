#!/usr/bin/env bash
# Layer 3: pulse_mission_loop detects Codex and activates next queued mission
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh

echo "=== test_pulse_mission_loop_codex_queue.sh ==="

ACTIVE_JSON=".agent/memory/project/missions/active.json"
QUEUE_FILE=".agent/mission_queue.txt"
MISSION_FILE=".agent/memory/project/missions/$(date +%Y-%m-%d)-test-loop-queue.md"

ACTIVE_BACKUP="$(mktemp)"
QUEUE_BACKUP="$(mktemp)"
ACTIVE_EXISTS=0
QUEUE_EXISTS=0

cleanup() {
  rm -f "$MISSION_FILE"
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
Path(".agent/memory/project/missions").mkdir(parents=True, exist_ok=True)
Path(".agent/memory/project/missions/active.json").write_text(json.dumps({
    "mission": None,
    "checkpoint": None,
    "note": "test queue activation"
}, indent=2))
Path(".agent/mission_queue.txt").write_text("# slug|goal — one per line\n"
                                            "test-loop-queue|Implement test-loop-queue mission for pulse loop regression coverage.\n")
PY

OUTPUT="$(CODEX_CI=1 bash execution/pulse_mission_loop.sh --dry-run 2>&1)"
ACTUAL_EXIT=$?

ACTIVE_PATH="$(python3 - <<'PY'
import json
from pathlib import Path
data = json.loads(Path(".agent/memory/project/missions/active.json").read_text())
print(data.get("mission") or "")
PY
)"

assert_exit "pulse_mission_loop dry-run exits 0" 0 "$ACTUAL_EXIT"
assert_output_contains "pulse_mission_loop selects Codex platform" "Platform: codex" "$OUTPUT"
assert_output_contains "pulse_mission_loop activates queued mission" "activating next from queue: test-loop-queue" "$OUTPUT"
assert_file_exists "pulse_mission_loop created queued mission file" "$MISSION_FILE"
assert_output_contains "active.json points at queued mission" "test-loop-queue" "$ACTIVE_PATH"

summary
