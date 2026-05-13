#!/usr/bin/env bash
# F3: Gate @analyst -> @architect
# Fires on PreToolUse/Agent. Blocks architect dispatch when no research-*.md exists.

INPUT=$(cat)

TYPE=$(printf '%s' "$INPUT" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('subagent_type',''))" \
  2>/dev/null)

case "$TYPE" in
  architect) ;;
  *) exit 0 ;;
esac

python3 execution/handoff_check.py --from analyst --to architect
exit $?
