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

RESULT=$(python3 execution/handoff_check.py --from dev --to qa 2>/dev/null)
PASS=$(printf '%s' "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('pass','false'))" 2>/dev/null || echo "false")

if [[ "$PASS" != "True" && "$PASS" != "true" ]]; then
  echo "BLOCKED: No dev-result-*.md found in .agent/memory/scratch/" >&2
  echo "FIX: Dispatch @dev to implement against the contract golden files." >&2
  echo "     Output file: .agent/memory/scratch/dev-result-<slug>.md" >&2
  echo "     Required section: ## Golden Assertions (min 128 bytes)" >&2
  echo "THEN: re-dispatch @qa once dev-result artifact exists" >&2
  exit 2
fi

exit 0
