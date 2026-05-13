#!/usr/bin/env bash
# F4: Gate @architect -> @dev
# Fires on PreToolUse/Agent. Blocks dev dispatch when no contract.yaml exists.

INPUT=$(cat)

TYPE=$(printf '%s' "$INPUT" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('subagent_type',''))" \
  2>/dev/null)

case "$TYPE" in
  dev) ;;
  *) exit 0 ;;
esac

python3 execution/handoff_check.py --from architect --to dev
exit $?
