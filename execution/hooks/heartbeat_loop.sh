#!/usr/bin/env bash
# heartbeat_loop.sh — always-on 60min quota-death recovery heartbeat
# Fires claude --continue unconditionally when autonomy=loop.
# No-op when not in loop mode. No flag required — runs on launchd interval.
set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

_LEVEL=$(python3 -c "import json; p=json.load(open('$PROJECT_ROOT/.agent/profile.json')); print(p.get('autonomy',{}).get('level','off'))" 2>/dev/null || echo 'off')

if [ "$_LEVEL" = "loop" ]; then
  cd "$PROJECT_ROOT"
  if ! claude --continue -p "k" 2>&1; then
    claude -p "AUTONOMOUS MODE: pick next backlog item and start immediately." 2>&1
  fi
fi

exit 0
