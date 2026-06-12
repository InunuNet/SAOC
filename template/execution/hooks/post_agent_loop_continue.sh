#!/usr/bin/env bash
# post_agent_loop_continue.sh — PostToolUse(Agent) loop-continue bridge
# Resolves #1265 (async-dispatch-continue) AND #1266 (inter-dispatch-turn-bridge).
#
# Problem: when the Agent tool returns, the model ends its turn and emits a
# summary. There is no native PostToolUse(Agent) continuation. In autonomy=loop
# that breaks the @architect->@dev->@qa->@docs->gate->@maintainer chain — the
# orchestrator stalls between dispatches waiting on nothing.
#
# Fix: emit a systemMessage that instructs the orchestrator NOT to end its turn
# and to proceed straight to the next chain step. No-op outside loop mode so
# interactive sessions still get their normal summaries.
set -uo pipefail

_LEVEL=$(python3 -c "import json; p=json.load(open('.agent/profile.json')); print(p.get('autonomy',{}).get('level','off'))" 2>/dev/null || echo 'off')

if [ "$_LEVEL" = "loop" ]; then
  printf '%s\n' '{"systemMessage": "Agent completed. autonomy=loop: DO NOT end your turn. Proceed to the next chain step immediately. No summary output needed."}'
fi

exit 0
