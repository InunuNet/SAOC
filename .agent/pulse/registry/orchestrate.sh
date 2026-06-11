#!/usr/bin/env bash
# orchestrate.sh — Codi's active orchestration loop.
# Reads both harness comms.md files, picks up findings, writes new mission
# directives, and invokes claude -p to fix upstream issues automatically.
# Runs every 3 minutes via Pulse.

set -euo pipefail
LOG="[orchestrate]"
ATHANOR_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

HARNESSES=(
  "/Users/vetus/ai/Codex Harness:codex:DEX"
  "/Users/vetus/ai/Gemini Harness:gemini:GEMENA"
)

for ENTRY in "${HARNESSES[@]}"; do
  DIR="${ENTRY%%:*}"; REST="${ENTRY#*:}"
  PLATFORM="${REST%%:*}"; AGENT="${REST##*:}"
  COMMS="$DIR/comms.md"
  QUEUE="$DIR/.agent/mission_queue.txt"
  ACTIVE_JSON="$DIR/.agent/memory/project/missions/active.json"

  [[ -f "$COMMS" ]] || continue

  echo "$LOG Checking $AGENT ($PLATFORM)"

  # Read latest agent message
  LAST_AGENT_MSG=$(grep -m1 "^## \[$AGENT\|^## \[GEMINI\|^## \[DEX" "$COMMS" 2>/dev/null || echo "")
  echo "$LOG Last from $AGENT: ${LAST_AGENT_MSG:0:80}"

  # Check active mission
  ACTIVE=$(python3 -c "
import json,pathlib
p=pathlib.Path('$ACTIVE_JSON')
print(p.exists() and json.loads(p.read_text()).get('mission','null') or 'null')
" 2>/dev/null || echo "null")

  # Check queue depth
  QUEUE_DEPTH=0
  [[ -f "$QUEUE" ]] && QUEUE_DEPTH=$(grep -v "^#" "$QUEUE" | grep -v "^$" | wc -l | tr -d ' ' 2>/dev/null || echo 0)

  # Fix UPSTREAM ISSUEs via claude -p
  while IFS= read -r ISSUE_LINE; do
    TITLE=$(echo "$ISSUE_LINE" | sed 's/UPSTREAM ISSUE: //' | cut -d'|' -f1 | xargs)
    DETAIL=$(echo "$ISSUE_LINE" | cut -d'|' -f2- | xargs)

    FRICTION_ID=$(printf '%s|%s' "$TITLE" "$DETAIL" | tr '[:upper:]' '[:lower:]' | tr -s ' ' | md5 2>/dev/null \
      || printf '%s|%s' "$TITLE" "$DETAIL" | tr '[:upper:]' '[:lower:]' | tr -s ' ' | md5sum | cut -d' ' -f1)
    [ -f "$ATHANOR_ROOT/.agent/pulse/registry/completed/friction/$FRICTION_ID.done" ] && continue

    SIG="$FRICTION_ID"
    LOCK="$ATHANOR_ROOT/.agent/pulse/registry/processing/issue-$SIG.lock"
    [[ -f "$LOCK" ]] && continue
    touch "$LOCK"

    echo "$LOG Fixing upstream issue: $TITLE"

    cd "$ATHANOR_ROOT"
    claude -p "You are Codi on Athanor harness. Fix this upstream issue reported by $AGENT:
TITLE: $TITLE
DETAIL: $DETAIL
Use the full harness chain. Be surgical. Push to GitHub when done. Report fix in 1 sentence." \
      2>&1 | tail -3 || echo "$LOG WARN: claude fix attempt failed" >&2

    mkdir -p "$ATHANOR_ROOT/.agent/pulse/registry/completed/friction" \
      && touch "$ATHANOR_ROOT/.agent/pulse/registry/completed/friction/$FRICTION_ID.done"

  done < <(grep "^UPSTREAM ISSUE:" "$COMMS" 2>/dev/null | tail -20)

  # If agent idle and queue low: inject new missions via comms.md
  if [[ "$ACTIVE" == "null" && $QUEUE_DEPTH -lt 3 ]]; then
    echo "$LOG $AGENT idle with low queue ($QUEUE_DEPTH) — generating new missions"

    # Generate mission directive via claude -p
    NEW_MISSIONS=$(cd "$ATHANOR_ROOT" && claude -p "You are Codi. Generate 3 new ghost mission slugs for $AGENT to self-improve the Athanor harness on $PLATFORM. These should test progressively harder harness behaviors. Return exactly 3 lines, each a slug like 'ghost-wordcount'. No explanations." 2>/dev/null | grep "^ghost-" | head -3 || echo "")

    if [[ -n "$NEW_MISSIONS" ]]; then
      # Filter out already-completed slugs before adding to queue
      FILTERED_MISSIONS=""
      while IFS= read -r slug_line; do
        [[ -z "$slug_line" ]] && continue
        SLUG_ONLY="${slug_line%%|*}"
        if [ -f "$ATHANOR_ROOT/.agent/pulse/registry/completed/missions/$SLUG_ONLY.done" ]; then
          echo "$LOG Skipping completed slug: $SLUG_ONLY"
          continue
        fi
        FILTERED_MISSIONS="${FILTERED_MISSIONS}${slug_line}"$'\n'
      done <<< "$NEW_MISSIONS"
      NEW_MISSIONS="${FILTERED_MISSIONS%$'\n'}"
    fi
    if [[ -n "$NEW_MISSIONS" ]]; then
      # Add to queue
      echo "$NEW_MISSIONS" >> "$QUEUE"
      echo "$LOG Added missions to $AGENT queue: $NEW_MISSIONS"

      # Write directive to comms.md
      python3 -c "
import pathlib, datetime
p = pathlib.Path('$COMMS')
existing = p.read_text()
missions = '''$NEW_MISSIONS'''.strip().replace('\n', '\n- ')
ts = datetime.datetime.now().strftime('%Y-%m-%d')
msg = f'''## [CODI -> $AGENT] {ts} — NEW MISSIONS QUEUED

Codi generated next missions for your self-improvement queue:
- {missions}

These are in .agent/mission_queue.txt. Pulse will activate them in sequence.
Keep improving. Report findings as UPSTREAM ISSUE: title | detail.

---
'''
p.write_text(msg + existing)
" 2>/dev/null || true
    fi
  fi

done

echo "$LOG Orchestration pass complete."
