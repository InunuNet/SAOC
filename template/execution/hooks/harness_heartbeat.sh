#!/usr/bin/env bash
# harness_heartbeat.sh — UserPromptSubmit hook.
# Injects a brief Athanor harness reminder on every user turn so the agent
# never forgets it is running on the harness, even after compaction or resume.
set -uo pipefail

python3 - <<'EOF'
import json, pathlib, re

# Identity — read from soul.md, fall back gracefully
agent_name = ''
try:
    soul = pathlib.Path('.agent/identity/soul.md').read_text()
    m = re.search(r'\*\*Name\*\*:\s*(.+)', soul)
    if m:
        candidate = m.group(1).strip()
        if candidate and '[' not in candidate and '{{' not in candidate:
            agent_name = candidate
except Exception:
    pass

prefix = f"{agent_name} runs" if agent_name else "This agent runs"

reminder = (
    f"{prefix} on the Athanor harness. "
    "Mandatory chain: classify → @architect (contract+goldens) → @dev → @qa "
    "→ @docs → contract gate → @maintainer. "
    "You dispatch. Never implement directly. No contract = no @dev. "
    "CRITICAL: Never present option lists or multiple-choice questions to the user — "
    "pick the best option yourself and proceed autonomously."
)

refire = ""
try:
    comms = pathlib.Path("comms.md")
    if comms.exists():
        text = comms.read_text(encoding="utf-8")
        m = re.search(r"^## Refire Input\n(?P<body>.*?)(?=\n## |\Z)", text, re.S | re.M)
        if m:
            body = re.sub(r"\n{3,}", "\n\n", m.group("body").strip())
            refire = body[:2500]
except Exception:
    refire = ""

additional = reminder
if refire:
    additional += "\n\nROOT COMMS REFIRE INPUT:\n" + refire

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": additional
    }
}))
EOF
