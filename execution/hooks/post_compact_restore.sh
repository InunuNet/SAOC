#!/usr/bin/env bash
# post_compact_restore.sh — PostCompact command hook
# Claude Code's PostCompact event does NOT accept hookSpecificOutput.additionalContext.
# Instead, we persist the orchestrator context to a flag file under .agent/memory/scratch/
# and emit a minimal valid systemMessage payload. A companion UserPromptSubmit hook
# (post_compact_inject.sh) reads the flag on the next user turn and injects the context.
set -uo pipefail

# Remove a Route-A lowered autoCompactWindow (and any stale arm flag) after the compaction it caused.
python3 execution/hooks/lib/autocompact_decider.py disarm >/dev/null 2>&1 || true

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

STALE_AFTER_DAYS = 7
NOT_RUNNING = ('done', 'abandoned', 'paused', 'blocked', 'close_out')
RUNNING = ('in_progress', 'pending')
proceed = False


def load_json(p):
    try:
        return json.loads(pathlib.Path(p).read_text())
    except Exception:
        return {}


def checkpoint_age_seconds(text):
    """Seconds since last_checkpoint.ts (fallback last_active_at); None if unreadable."""
    from datetime import datetime, timezone
    cp = re.search(r'(?ms)^last_checkpoint:\s*\n(.*?)(?=^\S)', text)
    ts = re.search(r"(?m)^\s+ts:\s*['\"]?([^'\"\s]+)", cp.group(1)) if cp else None
    ts = ts or re.search(r"(?m)^last_active_at:\s*['\"]?([^'\"\s]+)", text)
    if not ts:
        return None
    try:
        when = datetime.fromisoformat(ts.group(1).replace('Z', '+00:00'))
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - when).total_seconds()
    except Exception:
        return None


def autonomy_state():
    """(level, decided) mirroring full_boot.sh: the mission's record wins over the profile."""
    import sys
    sys.path.insert(0, 'execution')
    try:
        import autonomy
        normalize = autonomy.normalize
    except ImportError:
        # execution/autonomy.py absent (partial install): accept only the literal level words.
        normalize = lambda raw: raw if raw in ('interactive', 'autonomous', 'loop') else None
    rec = load_json('.agent/memory/project/missions/active.json').get('autonomy') or {}
    has = isinstance(rec, dict) and 'level' in rec
    raw = rec.get('level') if has else (load_json('.agent/profile.json').get('autonomy') or {}).get('level')
    return normalize(raw) or 'unknown', bool(has and rec.get('decided_at'))


try:
    if 'ACTIVE MISSION' in mission_info:
        mfile = pathlib.Path('.agent/memory/project/missions') / pathlib.Path(m).name
        if mfile.exists():
            mtext = mfile.read_text()
            status_match = re.search(r'(?m)^status:\s*(\S+)', mtext)
            status = status_match.group(1).strip().strip('\'"') if status_match else 'unknown'
            if status in NOT_RUNNING:
                mission_info = f'MISSION {mfile.stem}: {status}\n  Not an active mission. Do not resume it unless the user asks.'
            elif status in RUNNING:
                level, decided = autonomy_state()
                age = checkpoint_age_seconds(mtext)
                if age is not None and age > STALE_AFTER_DAYS * 86400:
                    mission_info += (f'\n⚠️ STALE CHECKPOINT: last checkpoint {round(age / 86400)} days ago -- confirm this is still '
                                     f'the objective; if not, python3 execution/mission.py pause {m}')
                elif not decided or level == 'unknown':
                    rec_level = level if level in ('interactive', 'autonomous', 'loop') else '<interactive|autonomous|loop>'
                    mission_info += ('\n⏸️ AUTONOMY UNDECIDED -- the mission does not start. Confirm before any work:'
                                     f'\n  python3 execution/set_autonomy.py --level {rec_level} --mission')
                elif level == 'interactive':
                    mission_info += "\n→ Autonomy DECIDED at 'interactive' -- run python3 execution/mission.py resume and ask before each step."
                else:
                    proceed = True
                    mission_info += '\n⚡ PROCEED IMMEDIATELY: Run python3 execution/mission.py resume NOW. Do not wait for user confirmation.'
except Exception:
    pass

# Shell tail reads this to decide whether to enqueue the loop-mode resume ticket.
pathlib.Path('.agent/memory/scratch').mkdir(parents=True, exist_ok=True)
pathlib.Path('.agent/memory/scratch/.post_compact_proceed').write_text('yes' if proceed else 'no')

goals = safe_read('.agent/memory/project/goals.md', max_lines=15)

# Loop-mode prefix: only when the PROCEED condition holds
loop_prefix = ''
try:
    _prof = json.load(open('.agent/profile.json'))
    if proceed and _prof.get('autonomy', {}).get('level') == 'loop':
        loop_prefix = 'LOOP MODE ACTIVE — PROCEED IMMEDIATELY. DO NOT WAIT FOR USER INPUT.\nComplete active mission, then start next backlog mission without pause.\n\n'
except Exception:
    pass

context = loop_prefix + f"""
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

# Signal Pulse heartbeat to auto-resume this session on next tick
# (only when the PROCEED condition holds; watch_comms.sh turns the flag into a resume ticket)
_PROCEED=$(cat .agent/memory/scratch/.post_compact_proceed 2>/dev/null || echo 'no')
if [ "$_PROCEED" = "yes" ]; then
  touch ".agent/pulse/registry/needs_resume.flag" 2>/dev/null || true
fi

# --- loop-mode resume ticket (provider-neutral) ---
_AUTONOMY_LEVEL=$(python3 -c "import json; p=json.load(open('.agent/profile.json')); print(p.get('autonomy',{}).get('level','off'))" 2>/dev/null || echo 'off')

if [ "$_AUTONOMY_LEVEL" = "loop" ] && [ "$_PROCEED" = "yes" ]; then
  if [ -x "execution/pulse_ticket.py" ]; then
    _RESUME_MSG="POST_COMPACT_RESUME: $(python3 execution/mission.py resume 2>/dev/null || echo 'resume active mission')"
    python3 execution/pulse_ticket.py enqueue \
      --source post_compact_restore \
      --kind post_compact_resume \
      --project-path "$(pwd)" \
      --provider "claude-code" \
      --requires-model true \
      --prompt "$_RESUME_MSG" \
      --dedupe-key "post-compact:$(pwd)" \
      --max-turns "${ATHANOR_PULSE_POST_COMPACT_MAX_TURNS:-1}" \
      --max-tokens "${ATHANOR_PULSE_POST_COMPACT_MAX_TOKENS:-12000}" >/dev/null 2>&1 || true
  fi
fi
# --- end loop-mode resume ticket ---
