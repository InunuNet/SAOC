#!/usr/bin/env bash
# F6 Stage 2: Gate docs -> contract.py gate
# Fires on PreToolUse/Bash. Blocks `contract.py gate *` calls when no docs/*.md exists.

INPUT=$(cat)

CMD=$(printf '%s' "$INPUT" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" \
  2>/dev/null)

case "$CMD" in
  "contract.py gate "*|"contract.py gate") ;;
  *) exit 0 ;;
esac

python3 execution/handoff_check.py --from docs --to gate 2>/dev/null
RC=$?
[ "$RC" -eq 127 ] && exit 0
exit "$RC"
