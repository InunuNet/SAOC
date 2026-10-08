#!/usr/bin/env bash
# Layer 3: mission.py resume handles active.json with mission=null gracefully
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh
source execution/tests/lib/sandbox_repo.sh

echo "=== test_mission_resume_null_active.sh ==="

# In a sandbox repo: this overwrites active.json and the boot-panel marker,
# which in the host checkout are that project's live mission pointer and boot
# verdict (restored by a trap that a killed run never reaches).
SB=$(make_sandbox_repo mission_resume_null execution)
cd "$SB" || exit 1

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
