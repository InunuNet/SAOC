#!/usr/bin/env bash
# shepherd.sh — Active harness monitor. Detects stalled agents and reactivates them.
# Runs every 5 minutes via Pulse. Checks each downstream harness:
#   - Is there an active mission?
#   - Has comms.md been updated recently?
#   - If stalled: reactivate via the project's platform CLI.
#   - If mission complete but queue has more: activate next mission.

set -euo pipefail

STALE_SECONDS=600  # 10 minutes without comms activity = stalled
LOG_PREFIX="[shepherd]"
ATHANOR_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

HARNESSES=(
  "/Users/vetus/ai/Codex Harness:codex"
  "/Users/vetus/ai/Gemini Harness:gemini"
)

for ENTRY in "${HARNESSES[@]}"; do
  DIR="${ENTRY%%:*}"
  PLATFORM="${ENTRY##*:}"

  [[ -d "$DIR" ]] || continue

  COMMS="$DIR/comms.md"
  ACTIVE_JSON="$DIR/.agent/memory/project/missions/active.json"
  QUEUE="$DIR/.agent/mission_queue.txt"

  echo "$LOG_PREFIX Checking $PLATFORM harness at $DIR"

  # --- Check active mission ---
  ACTIVE=$(python3 -c "
import json, pathlib
p = pathlib.Path('$ACTIVE_JSON')
if p.exists():
    d = json.loads(p.read_text())
    print(d.get('mission') or 'null')
else:
    print('null')
" 2>/dev/null || echo "null")

  # If no active mission, check queue and activate next
  if [[ "$ACTIVE" == "null" || -z "$ACTIVE" ]]; then
    if [[ -f "$QUEUE" ]]; then
      NEXT=$(grep -v "^#" "$QUEUE" | grep -v "^$" | head -1 2>/dev/null || echo "")
      if [[ -n "$NEXT" ]]; then
        _NEXT_SLUG="${NEXT%%|*}"
        [ -f "$ATHANOR_ROOT/.agent/pulse/registry/completed/missions/$_NEXT_SLUG.done" ] && { echo "$LOG_PREFIX Skipping completed mission slug: $_NEXT_SLUG"; continue; }
        echo "$LOG_PREFIX No active mission in $PLATFORM — activating: $NEXT"
        # Create minimal mission file and set active.json
        python3 -c "
import json, pathlib, datetime
path = pathlib.Path('$DIR')
slug = '$NEXT'
ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
mission_file = path / '.agent/memory/project/missions' / f'auto-{slug}.md'
mission_file.write_text(f'''---
schema: athanor.mission/v1
slug: {slug}
goal: Autonomous ghost mission: implement {slug.replace('-', '_')} per harness coding standards.
created_at: {ts}
status: in_progress
autonomy: high
features:
  - id: F1
    name: implement {slug}
    status: pending
milestones:
  - id: M1
    name: Implementation verified
    features: [F1]
    status: pending
---
''')
active = {'mission': str(mission_file.relative_to(path)), 'checkpoint': {'milestone': 'M1', 'feature': 'F1'}, 'activated_at': ts}
(path / '.agent/memory/project/missions/active.json').write_text(json.dumps(active, indent=2))
# Remove from queue
qp = pathlib.Path('$QUEUE')
lines = [l for l in qp.read_text().splitlines() if l.strip() not in ('$NEXT', '') and not l.strip().startswith('#')]
remaining = [l for l in qp.read_text().splitlines() if l.strip() == '$NEXT']
if not remaining:
    qp.write_text('\n'.join([l for l in qp.read_text().splitlines() if l.strip() != '$NEXT']) + '\n')
print('activated')
" 2>/dev/null && echo "$LOG_PREFIX Activated $NEXT in $PLATFORM"
        ACTIVE="auto-$NEXT"
      else
        echo "$LOG_PREFIX No active mission and queue empty for $PLATFORM — idle."
        continue
      fi
    else
      echo "$LOG_PREFIX No active mission and no queue for $PLATFORM — idle."
      continue
    fi
  fi

  # --- Check staleness ---
  COMMS_AGE=9999
  if [[ -f "$COMMS" ]]; then
    COMMS_MTIME=$(python3 -c "import os; print(int(os.path.getmtime('$COMMS')))" 2>/dev/null || echo 0)
    NOW=$(python3 -c "import time; print(int(time.time()))")
    COMMS_AGE=$((NOW - COMMS_MTIME))
  fi

  echo "$LOG_PREFIX $PLATFORM comms age: ${COMMS_AGE}s (stale threshold: ${STALE_SECONDS}s)"

  if [[ $COMMS_AGE -lt $STALE_SECONDS ]]; then
    echo "$LOG_PREFIX $PLATFORM is active (comms updated ${COMMS_AGE}s ago) — no intervention needed."
    continue
  fi

  # --- STALE: reactivate ---
  echo "$LOG_PREFIX STALE: $PLATFORM has not written to comms in ${COMMS_AGE}s — REACTIVATING"

  RESUME_PROMPT="You are the primary agent on the Athanor harness. You have been idle.
Run: python3 execution/mission.py resume to find your current checkpoint.
Continue the chain immediately: @architect→@dev→@qa→@docs→gate→maintainer.
Chain Continuous: never pause. Never ask for confirmation.
Report progress to comms.md when each step completes."

  case "$PLATFORM" in
    gemini)
      cd "$DIR" && gemini -p "$RESUME_PROMPT" --approval-mode yolo 2>&1 | tail -3 &
      echo "$LOG_PREFIX Reactivated $PLATFORM via gemini -p --approval-mode yolo"
      ;;
    codex)
      cd "$DIR" && codex exec "$RESUME_PROMPT" 2>&1 | tail -3 &
      echo "$LOG_PREFIX Reactivated $PLATFORM via codex exec"
      ;;
    claude)
      cd "$DIR" && claude -p "$RESUME_PROMPT" 2>&1 | tail -3 &
      echo "$LOG_PREFIX Reactivated $PLATFORM via claude -p"
      ;;
  esac

  cd /Users/vetus/ai/Athanor

done

echo "$LOG_PREFIX Shepherd pass complete."
