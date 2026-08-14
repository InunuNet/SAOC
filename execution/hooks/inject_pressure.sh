#!/usr/bin/env bash
# inject_pressure.sh — UserPromptSubmit hook
# Injects [context: X% | quota: Y% | refresh: Zh] into every user turn so the
# agent can self-throttle without human intervention.
#
# Inputs (stdin JSON from Claude Code):
#   - transcript_path: path to current session transcript (JSONL)
# Reads (read-only):
#   - transcript_path → last assistant usage block for context %
#   - ~/.claude/MEMORY/STATE/usage-cache.json → quota % + refresh window
# Output (stdout JSON):
#   {"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[context: X% | quota: Y% | refresh: Zh]"}}
#
# Hard rules:
#   - ALWAYS exit 0 (never block a user turn)
#   - Gracefully degrade to "?" when any data source is unavailable
#   - All stderr suppressed; timeout python work at <= 4s
set +e
exec 2>/dev/null

# --- Read hook input from stdin ---
INPUT=$(cat)
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty')

# --- Context tokens + % from transcript ---
CTX_TOKENS="?"
CTX_PCT="?"
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  _PY=$(mktemp /tmp/athanor_hook.XXXXXX.py)
  cat > "$_PY" <<'PYEOF'
import json, sys
last_usage = None
last_model = ""
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        rec = json.loads(line)
    except Exception:
        continue
    msg = rec.get("message") or {}
    if not isinstance(msg, dict):
        continue
    usage = msg.get("usage")
    if isinstance(usage, dict):
        last_usage = usage
        last_model = msg.get("model", last_model) or last_model
if not last_usage:
    print("?|?")
    sys.exit(0)
inp = int(last_usage.get("input_tokens", 0) or 0)
cc  = int(last_usage.get("cache_creation_input_tokens", 0) or 0)
total = inp + cc
model = (last_model or "").lower()
window = 1_000_000 if ("opus-4-7" in model or "4.7" in model) else 200_000
pct = round(100 * total / window) if window else 0
print(f"{total}|{pct}")
PYEOF
  _PY_OUT=$(tail -n 200 "$TRANSCRIPT" | timeout 4 python3 "$_PY")
  rm -f "$_PY"
  [ -z "$_PY_OUT" ] && _PY_OUT="?|?"
  CTX_TOKENS="${_PY_OUT%%|*}"
  CTX_PCT="${_PY_OUT##*|}"
  [ -z "$CTX_TOKENS" ] && CTX_TOKENS="?"
  [ -z "$CTX_PCT" ]    && CTX_PCT="?"
fi

# --- Quota % + refresh from usage-cache.json ---
Q_PCT="?"
R_HRS="?"
RESETS_RAW=""
CACHE="${ATHANOR_QUOTA_CACHE_OVERRIDE:-$HOME/.claude/MEMORY/STATE/usage-cache.json}"
if [ -f "$CACHE" ]; then
  Q_PCT=$(jq -r '.five_hour.utilization | floor' "$CACHE")
  [ -z "$Q_PCT" ] || [ "$Q_PCT" = "null" ] && Q_PCT="?"
  RESETS_RAW=$(jq -r '.five_hour.resets_at // empty' "$CACHE")
  _PY2=$(mktemp /tmp/athanor_hook.XXXXXX.py)
  cat > "$_PY2" <<'PYEOF'
import sys, datetime
raw = sys.stdin.read().strip()
if not raw:
    print("?")
    sys.exit(0)
try:
    s = raw.replace("Z", "+00:00")
    resets = datetime.datetime.fromisoformat(s)
    now = datetime.datetime.now(datetime.timezone.utc)
    hrs = (resets - now).total_seconds() / 3600.0
    if hrs < 0:
        print("0.0h")
    else:
        print(f"{round(hrs, 1)}h")
except Exception:
    print("?")
PYEOF
  R_HRS=$(printf '%s' "$RESETS_RAW" | timeout 4 python3 "$_PY2")
  rm -f "$_PY2"
  [ -z "$R_HRS" ] && R_HRS="?"
fi

# --- Mirror quota status to a project-local file (additive, best-effort) ---
# Consumed by execution/quota.py status (F1). Never allowed to abort the turn
# or corrupt the additionalContext JSON below — all failures swallowed.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd)"
DEFAULT_MIRROR="${REPO_ROOT:-.}/.agent/memory/scratch/.quota_status.json"
MIRROR_PATH="${ATHANOR_QUOTA_MIRROR_OVERRIDE:-$DEFAULT_MIRROR}"
if [[ "$Q_PCT" =~ ^[0-9]+$ ]] && [ -n "$RESETS_RAW" ]; then
  _PY3=$(mktemp /tmp/athanor_hook.XXXXXX.py)
  cat > "$_PY3" <<'PYEOF'
import datetime, json, os, sys

used_pct = int(sys.argv[1])
resets_raw = sys.argv[2]
mirror_path = sys.argv[3]
try:
    resets = datetime.datetime.fromisoformat(resets_raw.replace("Z", "+00:00"))
    now = datetime.datetime.now(datetime.timezone.utc)
    data = {
        "used_pct": used_pct,
        "resets_at": resets.isoformat(),
        "seconds_to_reset": (resets - now).total_seconds(),
        "captured_at": now.isoformat(),
    }
    parent = os.path.dirname(mirror_path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    tmp_path = f"{mirror_path}.tmp.{os.getpid()}"
    with open(tmp_path, "w") as f:
        json.dump(data, f)
    os.replace(tmp_path, mirror_path)
except Exception:
    pass
PYEOF
  timeout 4 python3 "$_PY3" "$Q_PCT" "$RESETS_RAW" "$MIRROR_PATH" >/dev/null 2>&1
  rm -f "$_PY3"
fi

# --- High-water-mark checkpoint: proactive, PRIMARY mechanism -------------
# Independent of Claude Code's StopFailure payload contract -- depends only
# on this hook's own already-verified Q_PCT. Same schema, same default path,
# as the reactive quota_death_checkpoint.sh StopFailure hook. Never fatal --
# a UserPromptSubmit hook must always exit 0 and emit valid JSON on stdout.
if [[ "$Q_PCT" =~ ^[0-9]+$ ]] && [ "$Q_PCT" -ge 90 ]; then
  CHECKPOINT="${ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH:-${REPO_ROOT:-.}/.agent/memory/scratch/.quota_death_checkpoint.json}"
  ACTIVE_MISSION_PATH="${ATHANOR_ACTIVE_MISSION_PATH:-${REPO_ROOT:-.}/.agent/memory/project/missions/active.json}"
  mkdir -p "$(dirname "$CHECKPOINT")" 2>/dev/null
  if [ -d "$(dirname "$CHECKPOINT")" ]; then
    CP_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    CP_MISSION="null"
    CP_CHECKPOINT="null"
    if [ -f "$ACTIVE_MISSION_PATH" ]; then
      CP_MISSION="$(jq -c '.mission // null' "$ACTIVE_MISSION_PATH" 2>/dev/null || echo null)"
      CP_CHECKPOINT="$(jq -c '.checkpoint // null' "$ACTIVE_MISSION_PATH" 2>/dev/null || echo null)"
    fi
    CP_MSG="⚡ QUOTA RECOVERY: quota reached ${Q_PCT}% at ${CP_TS} (high-water mark). Resume: python3 execution/mission.py resume"
    # Write to a temp file in the same directory, then rename into place, so the
    # checkpoint is only ever absent or complete -- never truncated by a mid-write kill.
    CHECKPOINT_TMP="${CHECKPOINT}.tmp.$$"
    jq -n \
      --arg ts "$CP_TS" \
      --arg reason "quota_high_water" \
      --argjson mission "$CP_MISSION" \
      --argjson cp "$CP_CHECKPOINT" \
      --arg msg "$CP_MSG" \
      '{timestamp:$ts, stop_reason:$reason, active_mission:$mission, active_checkpoint:$cp, recovery_message:$msg}' \
      > "$CHECKPOINT_TMP" 2>/dev/null \
      && mv -f "$CHECKPOINT_TMP" "$CHECKPOINT" 2>/dev/null \
      || rm -f "$CHECKPOINT_TMP" 2>/dev/null
  fi
fi

# --- Build injection string ---
CTX_STR="${CTX_PCT}%"
[ "$CTX_PCT" = "?" ] && CTX_STR="?"
Q_STR="${Q_PCT}%"
[ "$Q_PCT" = "?" ] && Q_STR="?"

# Threshold: only fire when CTX_TOKENS is a number (not "?") AND >= 100000
if [[ "$CTX_TOKENS" =~ ^[0-9]+$ ]] && [ "$CTX_TOKENS" -ge 100000 ]; then
  CTX_K=$(( CTX_TOKENS / 1000 ))
  INJECT="⚡ CONTEXT HIGH (${CTX_K}k tokens / ${CTX_STR}) — WRAP UP: brain.py wrap-up + commit mission to disk + /compact | quota: ${Q_STR} | refresh: ${R_HRS}"
else
  INJECT="[context: ${CTX_STR} | quota: ${Q_STR} | refresh: ${R_HRS}]"
fi

# --- Emit JSON via jq to avoid quoting issues ---
jq -nc --arg msg "$INJECT" '{hookSpecificOutput:{hookEventName:"UserPromptSubmit",additionalContext:$msg}}' \
  || echo '{}'

exit 0
