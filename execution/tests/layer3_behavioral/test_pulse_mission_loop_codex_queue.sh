#!/usr/bin/env bash
# Layer 3: pulse_mission_loop detects Codex and activates next queued mission
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh
source execution/tests/lib/sandbox_repo.sh

echo "=== test_pulse_mission_loop_codex_queue.sh ==="

# In a sandbox repo: this drives the real mission loop, which writes
# active.json and a new mission file. Run in the host checkout, it wrote (and
# then tried to undo) that project's live mission state (Alembic 2026-09-29).
SB=$(make_sandbox_repo pulse_codex_queue execution)
cd "$SB" || exit 1

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

# By glob, not by `date -u`: mission.py names the file from its own clock.
MISSION_FILE="$(ls .agent/memory/project/missions/*-test-loop-queue.md 2>/dev/null | head -1)"
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
assert_file_exists "pulse_mission_loop created queued mission file" "${MISSION_FILE:-missing}"
assert_output_contains "active.json points at queued mission" "test-loop-queue" "$ACTIVE_PATH"

summary
