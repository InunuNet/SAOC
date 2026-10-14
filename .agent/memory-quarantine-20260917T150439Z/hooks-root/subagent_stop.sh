#!/usr/bin/env bash
# Logs subagent completion to brain.py
input=$(cat)
agent_type=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('agent_type','unknown'))" 2>/dev/null || echo "unknown")
last_msg=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('last_assistant_message','')[:300])" 2>/dev/null || echo "")

if [ -n "$last_msg" ] && [ "$agent_type" != "unknown" ]; then
  python3 execution/brain.py remember \
    --summary "Agent ${agent_type} completed: ${last_msg}" \
    --tags "agent,${agent_type},subagent" \
    2>/dev/null || true
fi
