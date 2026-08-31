#!/usr/bin/env bash
# Injects Athanor context into spawned subagents

INPUT=$(cat)
agent_type=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('agent_type','unknown'))" 2>/dev/null || echo "unknown")

# --- Dispatch-events append (additive, best-effort) -----------------------
# Precise source of truth for session_token_log.sh's agent_dispatch_count
# (F1, token-accounting-hardening). Never allowed to block dispatch or
# corrupt the existing SubagentStart stdout contract below — all failures
# swallowed.
{
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
  REPO_ROOT="$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd)"
  DEFAULT_DISPATCH_LOG="${REPO_ROOT:-.}/.agent/memory/scratch/.session_dispatch_events.jsonl"
  DISPATCH_LOG="${ATHANOR_DISPATCH_EVENTS_PATH:-$DEFAULT_DISPATCH_LOG}"
  DISPATCH_EVENT=$(INPUT="$INPUT" AGENT_TYPE="$agent_type" python3 -c "
import json, os, sys, datetime
try:
    data = json.loads(os.environ.get('INPUT') or '{}')
except Exception:
    data = {}
session_id = data.get('session_id', '')
if session_id:
    print(json.dumps({
        'session_id': session_id,
        'agent_type': os.environ.get('AGENT_TYPE', 'unknown'),
        'ts': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    }))
")
  if [ -n "$DISPATCH_EVENT" ]; then
    mkdir -p "$(dirname "$DISPATCH_LOG")" 2>/dev/null
    : >> "$DISPATCH_LOG"
    if command -v flock >/dev/null 2>&1; then
      (
        flock -x 200
        printf '%s\n' "$DISPATCH_EVENT" >> "$DISPATCH_LOG"
      ) 200>>"$DISPATCH_LOG.lock"
    else
      # flock not installed: rely on POSIX PIPE_BUF/O_APPEND atomicity. A
      # single write() under PIPE_BUF (event is well under the 512-byte
      # guaranteed minimum) to an O_APPEND-opened file (>>) never interleaves
      # with a concurrent writer's write(), so the append stays a safe
      # fallback.
      printf '%s\n' "$DISPATCH_EVENT" >> "$DISPATCH_LOG"
    fi
  fi
} 2>/dev/null || true

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
        agent_spec = f.read()
    parts.append(agent_spec.strip())

rules = read_file(".agent/memory/project/rules.md")
if rules:
    parts.append(f"## PROJECT RULES\n{rules}")

learned = read_file(".agent/memory/project/learned.md", max_lines=40)
if learned:
    parts.append(f"## RECENT LEARNINGS\n{learned}")

output = {
    "hookSpecificOutput": {
        "hookEventName": "SubagentStart",
        "additionalContext": "\n\n---\n\n".join(parts)
    }
}
print(json.dumps(output))
PYEOF
