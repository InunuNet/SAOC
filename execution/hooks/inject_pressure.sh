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
cr  = int(last_usage.get("cache_read_input_tokens", 0) or 0)
total = inp + cc + cr
model = (last_model or "").lower()
window = 1_000_000 if ("opus-4-7" in model or "4.7" in model) else 200_000
pct = round(100 * total / window) if window else 0
print(f"{total}|{pct}")
PYEOF
  _PY_OUT=$(tail -n 2000 "$TRANSCRIPT" | timeout 4 python3 "$_PY")
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
CACHE="$HOME/.claude/MEMORY/STATE/usage-cache.json"
if [ -f "$CACHE" ]; then
  Q_PCT=$(jq -r '.five_hour.utilization | floor' "$CACHE")
  [ -z "$Q_PCT" ] || [ "$Q_PCT" = "null" ] && Q_PCT="?"
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
  R_HRS=$(jq -r '.five_hour.resets_at // empty' "$CACHE" | timeout 4 python3 "$_PY2")
  rm -f "$_PY2"
  [ -z "$R_HRS" ] && R_HRS="?"
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
