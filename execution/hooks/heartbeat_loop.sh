#!/usr/bin/env bash
# heartbeat_loop.sh — always-on 60min quota-death recovery heartbeat
# Enqueues a bounded resume ticket when autonomy=loop.
# No-op when not in loop mode. No flag required — runs on launchd interval.
set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

_LEVEL=$(python3 -c "import json; p=json.load(open('$PROJECT_ROOT/.agent/profile.json')); print(p.get('autonomy',{}).get('level','off'))" 2>/dev/null || echo 'off')

if [ "$_LEVEL" = "loop" ]; then
  TICKET_HELPER="$PROJECT_ROOT/execution/pulse_ticket.py"
  if [ ! -x "$TICKET_HELPER" ]; then
    echo "[heartbeat-loop] pulse_ticket.py unavailable — safe no-op; no provider launched" >&2
    exit 0
  fi

  RESUME_PROMPT="AUTONOMOUS MODE: resume the active mission if present; otherwise pick the next backlog item and start immediately."
  python3 "$TICKET_HELPER" enqueue \
    --source heartbeat_loop \
    --kind loop_heartbeat_resume \
    --project-path "$PROJECT_ROOT" \
    --provider "claude-code" \
    --requires-model true \
    --prompt "$RESUME_PROMPT" \
    --dedupe-key "heartbeat-loop:$PROJECT_ROOT" \
    --max-turns "${ATHANOR_PULSE_HEARTBEAT_MAX_TURNS:-1}" \
    --max-tokens "${ATHANOR_PULSE_HEARTBEAT_MAX_TOKENS:-12000}" \
    || echo "[heartbeat-loop] WARN: ticket enqueue failed" >&2
fi

exit 0
