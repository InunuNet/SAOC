#!/usr/bin/env bash
# F7: Gate @maintainer -> session-close
# Surface 1: SessionEnd — always runs handoff check
# Surface 2: PreToolUse/Bash — only intercepts `git commit` commands

INPUT=$(cat)

# Determine invocation surface via hook_event_name in the JSON payload.
# SessionEnd payloads have no tool_input; Bash PreToolUse payloads have tool_input.command.
CMD=$(printf '%s' "$INPUT" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" \
  2>/dev/null)

# If tool_input.command is present, this is a PreToolUse/Bash invocation.
# Only gate on git commit; let everything else pass.
if [ -n "$CMD" ]; then
  printf '%s' "$CMD" | grep -q 'git commit' || exit 0
fi

python3 execution/handoff_check.py --from maintainer --to close 2>/dev/null
RC=$?
[ "$RC" -eq 127 ] && exit 0
exit "$RC"
