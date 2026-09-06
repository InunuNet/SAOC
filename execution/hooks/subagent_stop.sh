#!/usr/bin/env bash
# Logs subagent completion to brain.py
INPUT=$(cat)
agent_type=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('agent_type','unknown'))" 2>/dev/null || echo "unknown")
agent_id=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('agent_id',''))" 2>/dev/null || echo "")
last_msg=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('last_assistant_message','')[:300])" 2>/dev/null || echo "")

# agent_type PRESENT-BUT-EMPTY is a different case from the key being absent
# entirely (.get()'s default of "unknown", filtered below unchanged). A
# present-but-empty value must never be interpolated blank into the summary
# -- fall back to agent_id (documented as always present on SubagentStop),
# or an explicit, honest placeholder if that too is unusable. Never drop the
# write outright: the subagent DID finish and DID say something real.
display_name="$agent_type"
if [ "$agent_type" = "" ]; then
  if [ -n "$agent_id" ]; then
    display_name="$agent_id"
  else
    display_name="unidentified-subagent"
  fi
fi

if [ -n "$last_msg" ] && [ "$agent_type" != "unknown" ]; then
  python3 execution/brain.py remember \
    --summary "Agent ${display_name} completed: ${last_msg}" \
    --tags "agent,${display_name},subagent" \
    2>/dev/null || true
  echo "💾 @${display_name} finished — update learned.md and the mission queue (backlog) if work was completed; check python3 execution/mission.py resume for active mission state."
fi
