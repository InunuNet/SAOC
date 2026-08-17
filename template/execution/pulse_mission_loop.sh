#!/usr/bin/env bash
# pulse_mission_loop.sh — Pulse-driven autonomous mission loop for Athanor.
#
# Runs every 60s via Pulse. Fully autonomous:
#   - Auto-detects provider ID
#   - Reads active mission from active.json
#   - If mission done: auto-activates next from .agent/mission_queue.txt
#   - Injects latest comms.md directive into resume prompt
#   - Auto-checks for template updates and applies if behind
#   - Enqueues provider-neutral resume tickets; dispatcher owns model launch
#
# Usage:
#   bash execution/pulse_mission_loop.sh                  # auto-detect
#   bash execution/pulse_mission_loop.sh --platform gemini-cli
#   bash execution/pulse_mission_loop.sh --platform claude-code
#   bash execution/pulse_mission_loop.sh --platform codex
#   bash execution/pulse_mission_loop.sh --dry-run

set -euo pipefail

PLATFORM="${ATHANOR_PLATFORM:-}"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform) PLATFORM="$2"; shift 2 ;;
    --dry-run)  DRY_RUN=true; shift ;;
    *) echo "[pulse-loop] Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# Must be in an Athanor workspace
if [[ ! -f ".agent/profile.json" ]]; then
  echo "[pulse-loop] Not an Athanor workspace — skipping." >&2
  exit 0
fi

# Auto-update check: if template_version is stale, update silently
CURRENT_VER=$(python3 -c "import json; print(json.load(open('.agent/profile.json')).get('template_version','0'))" 2>/dev/null || echo "0")
LATEST_VER=$(gh api repos/InunuNet/Athanor/contents/.agent/version --jq '.content' 2>/dev/null | base64 -d 2>/dev/null | tr -d '\n' || echo "")
if [[ -n "$LATEST_VER" && "$CURRENT_VER" != "$LATEST_VER" ]]; then
  echo "[pulse-loop] Template stale ($CURRENT_VER → $LATEST_VER) — updating..."
  python3 execution/update_template.py --apply 2>/dev/null && echo "[pulse-loop] Updated to $LATEST_VER" || echo "[pulse-loop] WARN: update failed" >&2
fi

# Read active mission + reconcile stale duplicate-slug missions (#102)
RECONCILED=false
ACTIVE=$(python3 - <<'PYEOF' 2>/dev/null || echo "null"
import json
from pathlib import Path
try:
    import yaml as _yaml
    def _load_fm_text(text):
        return _yaml.safe_load(text) or {}
except ImportError:
    import re as _re
    def _load_fm_text(text):
        result = {}
        for line in text.splitlines():
            m = _re.match(r"^(\w+):\s*(.+)$", line)
            if m:
                result[m.group(1)] = m.group(2).strip()
        return result
active_json = Path(".agent/memory/project/missions/active.json")
missions_dir = Path(".agent/memory/project/missions")
if not active_json.exists():
    print("null"); raise SystemExit(0)
data = json.loads(active_json.read_text())
active_path = data.get("mission")
if not active_path:
    # Legacy format: active_mission holds a slug (not a path) — resolve to file
    slug_hint = data.get("active_mission")
    if slug_hint:
        candidates = sorted(missions_dir.glob("*.md"), reverse=True)
        for c in candidates:
            if slug_hint in c.name:
                active_path = str(c)
                data["mission"] = active_path
                active_json.write_text(json.dumps(data, indent=2))
                break
if not active_path:
    print("null"); raise SystemExit(0)
active_file = Path(active_path)
if not active_file.exists():
    data.update({"mission": None, "checkpoint": None, "note": "active mission file missing"})
    active_json.write_text(json.dumps(data, indent=2))
    print("null"); raise SystemExit(0)
def load_fm(p):
    t = p.read_text()
    if not t.startswith("---\n"): return {}
    try: return _load_fm_text(t.split("---", 2)[1])
    except: return {}
active_fm = load_fm(active_file)
slug = active_fm.get("slug")
if not slug:
    print(str(active_file)); raise SystemExit(0)
# Don't reconcile an in_progress active mission — only clear stale done duplicates
if (active_fm.get("status") or "").lower() in {"in_progress", "active"}:
    print(str(active_file)); raise SystemExit(0)
candidates = sorted([(m.name, m, load_fm(m)) for m in missions_dir.glob("*.md") if load_fm(m).get("slug") == slug], key=lambda x: x[0])
if not candidates or Path(candidates[-1][1]) == active_file:
    print(str(active_file)); raise SystemExit(0)
_, latest_path, latest_meta = candidates[-1]
if (latest_meta.get("status") or "").lower() in {"done", "completed", "complete"}:
    data.update({"mission": None, "checkpoint": None, "note": f"stale duplicate slug {slug} cleared"})
    active_json.write_text(json.dumps(data, indent=2))
    print("reconciled")
else:
    data["mission"] = str(latest_path)
    active_json.write_text(json.dumps(data, indent=2))
    print(str(latest_path))
PYEOF)
[[ "$ACTIVE" == "reconciled" ]] && RECONCILED=true && ACTIVE="null"

# If no active mission, try to activate next from mission queue
if [[ "$ACTIVE" == "null" || -z "$ACTIVE" ]]; then
  QUEUE=".agent/mission_queue.txt"
  if [[ -f "$QUEUE" ]]; then
    NEXT_LINE=$(grep -v "^#" "$QUEUE" | grep -v "^$" | head -1 || true)
    if [[ -n "$NEXT_LINE" ]]; then
      # Queue format: "slug|goal description" or just "slug" (falls back to generic goal)
      NEXT_SLUG="${NEXT_LINE%%|*}"
      NEXT_GOAL="${NEXT_LINE#*|}"
      [[ "$NEXT_GOAL" == "$NEXT_SLUG" ]] && NEXT_GOAL="Implement $NEXT_SLUG per harness coding standards. Ghost mission: write, test, document."
      if [ -f ".agent/pulse/registry/completed/missions/$NEXT_SLUG.done" ]; then
        echo "[pulse-loop] Skipping completed mission slug: $NEXT_SLUG"
        python3 -c "
import pathlib
p = pathlib.Path('$QUEUE')
lines = [l for l in p.read_text().splitlines() if not l.strip().startswith('$NEXT_SLUG')]
p.write_text('\n'.join(lines) + '\n')
" 2>/dev/null || true
        exit 0
      fi
      NEXT="$NEXT_SLUG"
      echo "[pulse-loop] No active mission — activating next from queue: $NEXT_SLUG"
      python3 execution/mission.py new --slug "$NEXT_SLUG" "$NEXT_GOAL" 2>/dev/null || true
      ACTIVE=$(python3 -c "
import json, pathlib
p = pathlib.Path('.agent/memory/project/missions/active.json')
if p.exists():
    d = json.loads(p.read_text())
    print(d.get('mission') or 'null')
else:
    print('null')
" 2>/dev/null || echo "null")
      # Remove activated mission from queue
      [[ "$ACTIVE" != "null" ]] && python3 -c "
import pathlib
p = pathlib.Path('$QUEUE')
lines = [l for l in p.read_text().splitlines() if not l.strip().startswith('$NEXT_SLUG')]
p.write_text('\n'.join(lines) + '\n')
" 2>/dev/null || true
    fi
  fi
  if [[ "$ACTIVE" == "null" || -z "$ACTIVE" ]]; then
    # Fallback: scan missions dir for any in_progress mission — repairs stale active.json
    FOUND=$(python3 - <<'PYEOF' 2>/dev/null || echo "null"
import json
from pathlib import Path
try:
    import yaml as _yaml
    def _load_fm_text(text):
        return _yaml.safe_load(text) or {}
except ImportError:
    import re as _re
    def _load_fm_text(text):
        result = {}
        for line in text.splitlines():
            m = _re.match(r"^(\w+):\s*(.+)$", line)
            if m:
                result[m.group(1)] = m.group(2).strip()
        return result
missions_dir = Path(".agent/memory/project/missions")
active_json = missions_dir / "active.json"
def load_fm(p):
    t = p.read_text()
    if not t.startswith("---\n"): return {}
    try: return _load_fm_text(t.split("---", 2)[1])
    except: return {}
for mf in sorted(missions_dir.glob("*.md"), reverse=True):
    fm = load_fm(mf)
    if (fm.get("status") or "").lower() in ("in_progress", "active"):
        data = {"mission": str(mf), "checkpoint": fm.get("last_checkpoint") or {"milestone": None, "feature": None}, "note": "repaired by pulse-loop scan"}
        active_json.write_text(json.dumps(data, indent=2))
        print(str(mf)); raise SystemExit(0)
print("null")
PYEOF)
    if [[ "$FOUND" != "null" && -n "$FOUND" ]]; then
      echo "[pulse-loop] Repaired stale active.json → $FOUND"
      ACTIVE="$FOUND"
    else
      echo "[pulse-loop] No active mission and queue empty — idle."
      exit 0
    fi
  fi
fi

# Check mission status — use exact JSON field to avoid substring false positives
STATUS=$(python3 -c "
import subprocess, sys
r = subprocess.run(['python3', 'execution/mission.py', 'status', '$ACTIVE', '--json'],
    capture_output=True, text=True)
if r.returncode == 0:
    import json
    try: print(json.loads(r.stdout).get('status', 'unknown'))
    except: print(r.stdout.strip() or 'unknown')
else:
    print('unknown')
" 2>/dev/null || echo "unknown")

case "$STATUS" in
  completed|done|"mission complete")
    echo "[pulse-loop] Mission complete ($STATUS) — clearing and checking queue."
    SLUG=$(python3 - <<'PYEOF' 2>/dev/null || echo ""
import json
from pathlib import Path
try:
    import yaml as _yaml
    def _load_fm_text(text):
        return _yaml.safe_load(text) or {}
except ImportError:
    import re as _re
    def _load_fm_text(text):
        result = {}
        for line in text.splitlines():
            m = _re.match(r"^(\w[\w-]*):\s*(.+)$", line)
            if m:
                result[m.group(1)] = m.group(2).strip()
        return result
p = Path(".agent/memory/project/missions/active.json")
if not p.exists():
    raise SystemExit(0)
data = json.loads(p.read_text())
mission_path = data.get("mission")
if not mission_path:
    slug_hint = data.get("active_mission")
    if slug_hint:
        missions_dir2 = Path(".agent/memory/project/missions")
        for c in sorted(missions_dir2.glob("*.md"), reverse=True):
            if slug_hint in c.name:
                mission_path = str(c)
                break
if not mission_path:
    raise SystemExit(0)
mf = Path(mission_path)
if not mf.exists():
    raise SystemExit(0)
t = mf.read_text()
if not t.startswith("---\n"):
    raise SystemExit(0)
fm = _load_fm_text(t.split("---", 2)[1])
slug = fm.get("slug", "")
if slug:
    print(slug)
PYEOF)
    if [[ -n "$SLUG" ]]; then
      mkdir -p ".agent/pulse/registry/completed/missions"
      touch ".agent/pulse/registry/completed/missions/$SLUG.done"
      echo "[pulse-loop] Ledger entry written: completed/missions/$SLUG.done"
    fi
    python3 -c "
import json, pathlib
p = pathlib.Path('.agent/memory/project/missions/active.json')
p.write_text(json.dumps({'mission': None, 'checkpoint': None, 'note': 'mission complete'}, indent=2))
" 2>/dev/null || true
    exit 0
    ;;
  unknown)
    echo "[pulse-loop] WARN: could not read mission status — continuing with active mission as-is." >&2
    ;;
  *BLOCKED*)
    echo "[pulse-loop] Mission BLOCKED — human intervention required." >&2
    exit 0
    ;;
esac

echo "[pulse-loop] Active mission: $STATUS"

# Get latest comms.md directive for context
COMMS_CONTEXT=""
COMMS_FILES=(".claude/comms.md" "comms.md" "../comms.md")
for cf in "${COMMS_FILES[@]}"; do
  if [[ -f "$cf" ]]; then
    COMMS_CONTEXT=$(grep -A3 "^\[CODI\|^## \[CODI" "$cf" 2>/dev/null | head -5 | tr '\n' ' ' || true)
    break
  fi
done

# Provider detection — check Codex env vars first, then local project hints.
if [[ -z "$PLATFORM" ]]; then
  if [[ -n "${CODEX_CI:-}" || -n "${CODEX_THREAD_ID:-}" || -n "${CODEX_SESSION_ID:-}" ]]; then
    PLATFORM="codex"
  elif [[ -f ".gemini/settings.json" ]]; then
    PLATFORM="gemini-cli"
  elif [[ -d ".codex" ]]; then
    PLATFORM="codex"
  else
    PLATFORM="claude-code"
  fi
fi

case "$PLATFORM" in
  claude) PLATFORM="claude-code" ;;
  gemini) PLATFORM="gemini-cli" ;;
esac

echo "[pulse-loop] Provider: $PLATFORM"
echo "[pulse-loop] Platform: ${PLATFORM%-code}"

# Resume prompt — includes checkpoint and comms context
CHECKPOINT=$(python3 -c "
import json, pathlib
p = pathlib.Path('.agent/memory/project/missions/active.json')
if p.exists():
    d = json.loads(p.read_text())
    cp = d.get('checkpoint', {})
    print(f'Milestone {cp.get(\"milestone\",\"M1\")}, Feature {cp.get(\"feature\",\"F1\")}')
else:
    print('start of mission')
" 2>/dev/null || echo "current checkpoint")

# Build concrete prompt with exact file paths and commands
ACTIVE_JSON_PATH=".agent/memory/project/missions/active.json"
RESUME_CMD="python3 execution/mission.py resume $ACTIVE"
STATUS_CMD="python3 execution/mission.py status $ACTIVE --json"

echo "[pulse-loop] Active mission file: $ACTIVE"
echo "[pulse-loop] Resume command: $RESUME_CMD"

RESUME_PROMPT="You are the primary agent on the Athanor harness running autonomously.
Active mission pointer: $ACTIVE_JSON_PATH
Active mission file: $ACTIVE
Current checkpoint: $CHECKPOINT

EXACT COMMANDS — use these, do not probe alternate paths:
  Resume: $RESUME_CMD
  Status: $STATUS_CMD

Run the resume command now to get the exact next chain step.
Proceed through ALL steps (@architect→@dev→@qa→@docs→gate→maintainer) without stopping.
NEVER pause between steps. NEVER ask for confirmation. NEVER create a duplicate mission.
If resume says 'no milestones defined': add milestones to the mission file and continue.
When DONE: bash execution/skills/wrap_mission.sh 'mission complete' 'mission,complete'
Only stop if BLOCKED and human action is genuinely required.${COMMS_CONTEXT:+ Maintainer context: $COMMS_CONTEXT}"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "[pulse-loop] DRY-RUN provider=$PLATFORM active=$ACTIVE checkpoint=$CHECKPOINT"
  echo "[pulse-loop] resume_cmd: $RESUME_CMD"
  echo "[pulse-loop] status_cmd: $STATUS_CMD"
  exit 0
fi

# Quota backoff state file
QUOTA_STAMP=".agent/memory/scratch/.quota_backoff"
if [[ -f "$QUOTA_STAMP" ]]; then
  BACKOFF_UNTIL=$(cat "$QUOTA_STAMP" 2>/dev/null || echo 0)
  NOW=$(python3 -c "import time; print(int(time.time()))")
  if [[ $NOW -lt $BACKOFF_UNTIL ]]; then
    REMAINING=$((BACKOFF_UNTIL - NOW))
    echo "[pulse-loop] Quota backoff active — $REMAINING seconds remaining. Skipping turn."
    exit 0
  else
    rm -f "$QUOTA_STAMP"
    echo "[pulse-loop] Quota backoff expired — resuming."
  fi
fi

if [[ ! -x "execution/pulse_ticket.py" ]]; then
  echo "[pulse-loop] pulse_ticket.py unavailable — safe no-op; no provider launched." >&2
  exit 0
fi

DEDUPE_KEY="mission-resume:$(pwd):$ACTIVE"
python3 execution/pulse_ticket.py enqueue \
  --source pulse_mission_loop \
  --kind mission_resume \
  --project-path "$(pwd)" \
  --provider "$PLATFORM" \
  --requires-model true \
  --prompt "$RESUME_PROMPT" \
  --dedupe-key "$DEDUPE_KEY" \
  --max-turns "${ATHANOR_PULSE_RESUME_MAX_TURNS:-1}" \
  --max-tokens "${ATHANOR_PULSE_RESUME_MAX_TOKENS:-20000}"

echo "[pulse-loop] Resume ticket enqueued for dispatcher."
