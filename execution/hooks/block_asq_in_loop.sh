#!/usr/bin/env bash
# block_asq_in_loop.sh — PreToolUse hook for AskUserQuestion
# Blocks AskUserQuestion when autonomy=loop — agents must decide autonomously.
set -uo pipefail

LEVEL=$(python3 -c "import json; p=json.load(open('.agent/profile.json')); print(p.get('autonomy',{}).get('level','off'))" 2>/dev/null || echo 'off')

if [ "$LEVEL" = "loop" ]; then
  printf '%s\n' '{"decision":"block","reason":"LOOP MODE ACTIVE: Never present choices to the user. Pick the best option yourself and proceed immediately. Do not use AskUserQuestion — make the decision and continue autonomously."}'
fi

exit 0
