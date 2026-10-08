#!/usr/bin/env bash
# Layer 3: pulse_mission_loop reconciles stale duplicate-slug active missions
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh
source execution/tests/lib/sandbox_repo.sh

echo "=== test_pulse_mission_loop_duplicate_slug_reconcile.sh ==="

# In a sandbox repo with an empty missions dir. The loop's fallback scan picks
# up ANY in_progress mission, so this test used to MOVE the host project's
# real in-progress missions out to a temp dir for the run and move them back
# in a trap -- a killed run stranded the live mission outside the project.
SB=$(make_sandbox_repo pulse_dup_slug execution)
cd "$SB" || exit 1
mkdir -p .agent/memory/project/missions

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
