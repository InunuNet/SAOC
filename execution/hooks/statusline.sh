#!/usr/bin/env bash
set +e

# Read stdin JSON
INPUT=$(cat)

# Debug: dump input to .tmp inside the workspace
echo "$INPUT" > "/Users/vetus/ai/Anti Harness/.tmp/statusline_debug.json" 2>/dev/null

# Parse values from stdin JSON
CWD=$(echo "$INPUT" | jq -r '.workspace.current_dir // "?"')
CTX_PCT=$(echo "$INPUT" | jq -r '.context_window.used_percentage // "?"')

# Parse values from the usage cache
Q_PCT="?"
R_HRS="?"
CACHE="$HOME/.claude/MEMORY/STATE/usage-cache.json"

if [ -f "$CACHE" ]; then
  RESETS_AT=$(jq -r '.five_hour.resets_at // empty' "$CACHE" 2>/dev/null)
  Q_PCT=$(jq -r '.five_hour.utilization | floor' "$CACHE" 2>/dev/null)
  [ -z "$Q_PCT" ] || [ "$Q_PCT" = "null" ] && Q_PCT="?"
  
  if [ -n "$RESETS_AT" ]; then
    _PY_RES=$(python3 -c "
import datetime
try:
    s = '$RESETS_AT'.replace('Z', '+00:00')
    resets = datetime.datetime.fromisoformat(s)
    now = datetime.datetime.now(datetime.timezone.utc)
    hrs = (resets - now).total_seconds() / 3600.0
    
    if hrs <= 0:
        print(f'0|0.0h')
    else:
        print(f'{int($Q_PCT)}|{round(hrs, 1)}h')
except Exception:
    print('?|?')
" 2>/dev/null)
    
    Q_PCT=$(echo "$_PY_RES" | cut -d'|' -f1)
    R_HRS=$(echo "$_PY_RES" | cut -d'|' -f2)
  fi
fi

BRANCH=$(git branch --show-current 2>/dev/null || echo "none")
TIME=$(date +"%H:%M")
PCT=${CTX_PCT:-0}
if [[ "$PCT" == "?" ]]; then PCT=0; fi
BAR_LEN=50
FILLED=$(( PCT * BAR_LEN / 100 ))
EMPTY=$(( BAR_LEN - FILLED ))

BAR=""
for ((i=0; i<FILLED; i++)); do BAR="${BAR}▰"; done
for ((i=0; i<EMPTY; i++)); do BAR="${BAR}▱"; done

echo -e "\033[1;36m— | \033[1;34mAGY STATUSLINE \033[1;36m| —\033[0m \033[1m$TIME\033[0m | \033[1;35m$BRANCH\033[0m | \033[1;34mCWD: \033[0m$CWD | \033[1;33mUSE: ${Q_PCT}% \033[0m(rst: ${R_HRS}) | \033[1;35mMEM:\033[0m 📁 Work ✦ Ratings ⊕ Sessions ♢ Research"
echo -e "\033[1;34m◉ CONTEXT:\033[0m \033[1;32m${BAR}\033[0m ${PCT}%"
