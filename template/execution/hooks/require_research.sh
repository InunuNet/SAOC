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

RESULT=$(python3 execution/handoff_check.py --from analyst --to architect 2>/dev/null)
PASS=$(printf '%s' "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('pass','false'))" 2>/dev/null || echo "false")

if [[ "$PASS" != "True" && "$PASS" != "true" ]]; then
  echo "BLOCKED: No research-*.md found in .agent/memory/scratch/" >&2
  echo "FIX: Dispatch @analyst to research the topic." >&2
  echo "     Output file: .agent/memory/scratch/research-<slug>.md" >&2
  echo "     Required section: ## Findings (min 512 bytes)" >&2
  echo "THEN: re-dispatch @architect once research artifact exists" >&2
  exit 2
fi

exit 0
