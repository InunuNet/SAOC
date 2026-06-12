#!/usr/bin/env bash
# post_compact_restore.sh — PostCompact command hook
# Claude Code's PostCompact event does NOT accept hookSpecificOutput.additionalContext.
# Instead, we persist the orchestrator context to a flag file under .agent/memory/scratch/
# and emit a minimal valid systemMessage payload. A companion UserPromptSubmit hook
# (post_compact_inject.sh) reads the flag on the next user turn and injects the context.
set -uo pipefail

python3 - <<'EOF'
import json, pathlib, re

def safe_read(p, max_lines=None):
    try:
        text = pathlib.Path(p).read_text()
        if max_lines:
            lines = text.splitlines()
            return '\n'.join(lines[:max_lines])
        return text
    except Exception:
        return '(not found)'

# Resolve agent identity from soul.md (project-specific), fall back gracefully
agent_name = 'the primary agent'
try:
    soul = pathlib.Path('.agent/identity/soul.md').read_text()
    m = re.search(r'\*\*Name\*\*:\s*(.+)', soul)
    if m:
        candidate = m.group(1).strip()
        # Skip unfilled placeholders
        if candidate and '[' not in candidate and '{{' not in candidate:
            agent_name = candidate
except Exception:
    pass

# Active mission
mission_info = 'No active mission.'
try:
    active = json.loads(pathlib.Path('.agent/memory/project/missions/active.json').read_text())
    m = active.get('mission') or 'none'
    cp = active.get('checkpoint') or 'none'
    note = active.get('note', '')
    if m and m != 'none':
        mission_info = f'ACTIVE MISSION: {m} @ {cp}\n  Note: {note}'
except Exception:
    pass

try:
    if 'ACTIVE MISSION' in mission_info:
        mfile = pathlib.Path('.agent/memory/project/missions') / pathlib.Path(m).name
        mfile = mfile if mfile.exists() else None
        if mfile:
            status_match = re.search(r'(?m)^status:\s*(\S+)', mfile.read_text())
            if status_match and status_match.group(1).strip() in ('in_progress', 'pending'):
                mission_info += '\n⚡ PROCEED IMMEDIATELY: Run python3 execution/mission.py resume NOW. Do not wait for user confirmation.'
except Exception:
    pass

goals = safe_read('.agent/memory/project/goals.md', max_lines=15)

context = f"""
╔══ POST-COMPACTION CONTEXT RESTORE ══════════════════════════╗
║ Context was just compacted. The following rules and state   ║
║ MUST govern the rest of this session without exception.     ║
╚═════════════════════════════════════════════════════════════╝

## ORCHESTRATOR ROLE — NON-NEGOTIABLE

You are {agent_name}, the DISPATCHER. You do NOT implement anything directly.

CRITICAL RULES:
1. The primary session NEVER writes code, tests, or docs — delegate to agents.
2. Mandatory chain (skip nothing): classify → [mission|spec] → @architect
   (contract + golden files) → @dev → @qa → @docs → contract.py gate
   → @maintainer → commit
3. No contract.yaml → no @dev dispatch. No golden files → no @dev dispatch.
4. Trivial tasks (read, status, single command) are handled directly — chain
   does not apply. Everything else goes through the chain.

Agents and their roles:
  @lead      → planner/researcher, returns spec/plan. Never spawns agents.
  @dev       → code only, against golden files. Never writes QA inputs.
  @qa        → adversarial. Inputs from Codi/@architect, NOT from @dev.
  @architect → contract.yaml + golden files. Blocks @dev until done.
  @docs      → README + docs/<feature>.md. Runs before contract gate.
  @analyst   → research/analysis. Read-only.
  @maintainer→ learned.md + brain wrap-up. Mandatory at session close.

## CURRENT STATE

{mission_info}

## GOALS
{goals}

## NEXT ACTION
If an active mission is shown above: run `python3 execution/mission.py resume`
and continue from the listed checkpoint.
If no active mission: check backlog.md and plan next mission with /mission new.
""".strip()

# Persist context for the UserPromptSubmit injector to pick up on next user turn.
flag = pathlib.Path('.agent/memory/scratch/.post_compact_context.txt')
flag.parent.mkdir(parents=True, exist_ok=True)
flag.write_text(context)

# Emit a minimal, schema-valid PostCompact payload.
print(json.dumps({
    "systemMessage": "PostCompact: orchestrator context restore queued."
}))
EOF
