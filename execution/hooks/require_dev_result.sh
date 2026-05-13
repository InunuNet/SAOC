#!/usr/bin/env bash
# F5: Gate @dev -> @qa
# Fires on PreToolUse/Agent. Blocks qa dispatch when no dev-result-*.md exists.

INPUT=$(cat)

TYPE=$(printf '%s' "$INPUT" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('subagent_type',''))" \
  2>/dev/null)

case "$TYPE" in
  qa) ;;
  *) exit 0 ;;
esac

python3 execution/handoff_check.py --from dev --to qa
exit $?
