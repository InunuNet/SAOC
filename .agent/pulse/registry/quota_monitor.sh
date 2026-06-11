#!/usr/bin/env bash
# quota_monitor.sh — Pulse job: track quota exhaustion + clear backoff when window resets.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export HOME="/Users/vetus"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LOG_PREFIX="[quota-monitor]"
NOW=$(date +%s)
BACKOFF_WINDOW=3600  # 1 hour rolling Claude quota window

# Clear expired backoff stamps written by pulse_mission_loop.sh
for stamp_file in \
  "$PROJECT_ROOT/.agent/memory/scratch/improvement_loop/.last_quota_stamp" \
  "$PROJECT_ROOT/.agent/pulse/quota_backoff.txt"; do
  [ -f "$stamp_file" ] || continue
  BACKOFF_UNTIL=$(cat "$stamp_file" 2>/dev/null || echo "0")
  echo "$BACKOFF_UNTIL" | grep -qE '^[0-9]+$' || continue
  REMAINING=$(( BACKOFF_UNTIL - NOW ))
  if [ "$REMAINING" -le 0 ]; then
    rm -f "$stamp_file"
    echo "$LOG_PREFIX Quota backoff expired — cleared. Sessions may resume."
  else
    MINS=$(( REMAINING / 60 ))
    echo "$LOG_PREFIX Quota backoff active: ${MINS}m remaining"
  fi
done

# Log active mission state per project
for proj in "/Users/vetus/ai/Athanor" "/Users/vetus/ai/Mumbl AI" "/Users/vetus/ai/Gemini Harness"; do
  [ -d "$proj" ] || continue
  name=$(basename "$proj")
  ajson="$proj/.agent/memory/project/missions/active.json"
  if [ -f "$ajson" ]; then
    mission=$(python3 -c "import json,pathlib; d=json.loads(pathlib.Path('$ajson').read_text()); print(d.get('mission','none') or 'none')" 2>/dev/null | xargs basename 2>/dev/null || echo "unknown")
    echo "$LOG_PREFIX $name: active=$mission"
  else
    echo "$LOG_PREFIX $name: no active mission"
  fi
done
echo "$LOG_PREFIX done $(date '+%H:%M:%S')"
