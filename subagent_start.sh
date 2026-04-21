#!/usr/bin/env bash
# Injects Athanor context into spawned subagents

input=$(cat)
agent_type=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('agent_type','unknown'))" 2>/dev/null || echo "unknown")

AGENT_TYPE="$agent_type" python3 - <<'PYEOF'
import json, os

def read_file(path, max_lines=None):
    try:
        with open(path) as f:
            lines = f.readlines()
        if max_lines:
            lines = lines[-max_lines:]
        return ''.join(lines).strip()
    except Exception:
        return ""

agent_type = os.environ.get('AGENT_TYPE', 'unknown')
agent_file = f".agent/agents/{agent_type}.md"

parts = []

if os.path.exists(agent_file):
    with open(agent_file) as f:
        agent_lines = f.readlines()[:30]
    parts.append(''.join(agent_lines).strip())

rules = read_file(".agent/memory/project/rules.md")
if rules:
    parts.append(f"PROJECT RULES: {rules}")

learned = read_file(".agent/memory/project/learned.md", max_lines=40)
if learned:
    parts.append(f"RECENT LEARNINGS: {learned}")

output = {
    "hookSpecificOutput": {
        "hookEventName": "SubagentStart",
        "additionalContext": " ".join(parts)
    }
}
print(json.dumps(output))
PYEOF
