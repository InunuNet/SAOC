#!/usr/bin/env bash
# pain_point_monitor.sh — Recurring blocker analyst (Pulse registry job)
#
# WHAT: Scans brain.py for recurring blockers. When found, prepends a
#       [CODI -> SELF] directive (<=20 lines) to comms.md. Purely analytical:
#       does NOT spawn AI sessions, does NOT mutate missions.
#
# CADENCE: pulse_runner.sh iterates ALL scripts in .agent/pulse/registry/ every
#          300s (see execution/launchd/com.athanor.pulse.plist). This script
#          self-throttles to 6h (21600s) via a timestamp guard file. DO NOT add
#          a new <dict> / StartInterval entry to com.athanor.pulse.plist — the
#          plist runs the runner, not individual jobs. Registry placement is
#          the only registration needed.
#
# SILENT FAILURE MODES (all -> exit 0 with no comms.md mutation):
#   - brain.py missing / errors
#   - scan-blockers returns "No recurring blockers detected" or empty
#   - cadence guard says we ran <6h ago
#   - comms.md write fails
#
# DO NOT add `set -e` — pulse_runner treats non-zero as FAILURE in pulse.log
# and we want this job to stay quiet on healthy sessions.

set -uo pipefail

LOG_PREFIX="[pain-point-monitor]"
HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$HARNESS_DIR" || exit 0

# --- Cadence guard: 6h = 21600s ---
STAMP_DIR="$HARNESS_DIR/.agent/memory/scratch/pain_point_monitor"
STAMP_FILE="$STAMP_DIR/.last_run_ts"
INTERVAL=21600
mkdir -p "$STAMP_DIR" || true

NOW=$(date +%s)
if [[ -f "$STAMP_FILE" ]]; then
  LAST=$(cat "$STAMP_FILE" 2>/dev/null || echo 0)
  [[ "$LAST" =~ ^[0-9]+$ ]] || LAST=0
  ELAPSED=$(( NOW - LAST ))
  if [[ $ELAPSED -lt $INTERVAL ]]; then
    echo "$LOG_PREFIX Skipped (last run ${ELAPSED}s ago, cadence ${INTERVAL}s)."
    exit 0
  fi
fi

# Stamp now so a slow brain.py cannot cause repeated runs in the same hour.
echo "$NOW" > "$STAMP_FILE" || true

# --- Run scan-blockers; tolerate brain.py absence ---
BLOCKER_OUTPUT=$(python3 execution/brain.py scan-blockers 2>/dev/null || echo "")

if [[ -z "$BLOCKER_OUTPUT" ]]; then
  echo "$LOG_PREFIX brain.py unavailable or empty output — silent exit."
  exit 0
fi

if echo "$BLOCKER_OUTPUT" | grep -q "No recurring blockers detected"; then
  echo "$LOG_PREFIX No recurring blockers detected — healthy. Silent exit."
  exit 0
fi

echo "$LOG_PREFIX Recurring blockers found — writing comms.md alert."

# --- Build and prepend the [CODI -> SELF] directive ---
TS=$(date '+%Y-%m-%d %H:%M')

# Cap blocker summary at 15 lines so the comms block stays <=20 lines total.
SUMMARY=$(echo "$BLOCKER_OUTPUT" | head -15)

# Use python heredoc with env vars (avoid shell quoting hazards in $SUMMARY).
TS="$TS" SUMMARY="$SUMMARY" python3 - <<'PYEOF' || exit 0
import os, pathlib
ts = os.environ["TS"]
summary = os.environ["SUMMARY"].rstrip()
p = pathlib.Path("comms.md")
header = f"## [CODI -> SELF] {ts} — RECURRING BLOCKERS DETECTED\n\n"
footer = "\n\nAction: review .agent/memory/project/learned.md and address the top blocker before next mission.\n\n"
block = header + summary + footer
existing = p.read_text() if p.exists() else ""
p.write_text(block + existing)
print("Pain point alert written to comms.md")
PYEOF

exit 0
