#!/usr/bin/env bash
# F6 Stage 1: Gate @qa -> @docs
# Fires on PreToolUse/Agent. Blocks docs dispatch when no qa-report-*.md exists.

INPUT=$(cat)

TYPE=$(printf '%s' "$INPUT" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('subagent_type',''))" \
  2>/dev/null)

case "$TYPE" in
  docs) ;;
  *) exit 0 ;;
esac

python3 execution/handoff_check.py --from qa --to docs
exit $?
