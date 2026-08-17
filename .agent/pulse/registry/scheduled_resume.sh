#!/usr/bin/env bash
# Pulse job: ONE-SHOT scheduled mission resume.
#
# Why this exists instead of mission_loop.sh: mission_loop.sh fires every Pulse cycle (~5 min)
# and enqueues a fully autonomous "never pause, never ask" Claude session against the active
# mission. That is correct for an unattended machine and wrong when a human-driven session is
# already working the same mission — two agents would run gates, mutate files and commit
# against one working tree. mission_loop.sh is therefore left non-executable, and this job
# fires exactly once, at a wall-clock time chosen deliberately.
#
# Behaviour: before RESUME_AT, silent no-op. At or after it, drops a marker and hands off to
# pulse_mission_loop.sh once. The marker makes it idempotent — Pulse keeps calling this every
# cycle and every later call is a no-op, so it cannot re-fire.
#
# To re-arm: delete the marker file and update RESUME_AT.
# To go back to continuous autonomous operation: chmod +x mission_loop.sh and chmod -x this.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.bun/bin:$HOME/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$PROJECT_ROOT"

# Local wall-clock time to resume at. The machine is SAST (+2); this is interpreted in the
# machine's local timezone, deliberately — it is the time Brad asked for, not a UTC instant.
RESUME_AT="2026-08-18 02:22:00"
MARKER=".agent/pulse/registry/.scheduled_resume.fired"

if [ -f "$MARKER" ]; then
  exit 0
fi

NOW_EPOCH="$(date +%s)"
TARGET_EPOCH="$(python3 -c "
import datetime, sys
print(int(datetime.datetime.strptime('$RESUME_AT', '%Y-%m-%d %H:%M:%S').timestamp()))
")"

if [ "$NOW_EPOCH" -lt "$TARGET_EPOCH" ]; then
  # Not yet. Stay quiet — this runs every ~5 minutes and must not spam the log.
  exit 0
fi

# Write the marker BEFORE launching. If the handoff below dies, this job must not retry every
# five minutes forever; a human re-arms it deliberately by deleting the marker.
date -u +"fired at %Y-%m-%dT%H:%M:%SZ (scheduled for $RESUME_AT local)" > "$MARKER"

echo "[scheduled-resume] Reached $RESUME_AT — handing off to pulse_mission_loop.sh (one shot)."
exec bash execution/pulse_mission_loop.sh --platform claude
