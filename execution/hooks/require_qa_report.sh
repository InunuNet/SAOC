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

RESULT=$(python3 execution/handoff_check.py --from qa --to docs 2>/dev/null)
PASS=$(printf '%s' "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('pass','false'))" 2>/dev/null || echo "false")

if [[ "$PASS" != "True" && "$PASS" != "true" ]]; then
  echo "BLOCKED: No qa-report-*.md found in .agent/memory/scratch/" >&2
  echo "FIX: Dispatch @qa to run adversarial tests against the implementation." >&2
  echo "     Output file: .agent/memory/scratch/qa-report-<slug>.md" >&2
  echo "     Required section: ## Adversarial (min 128 bytes)" >&2
  echo "THEN: re-dispatch @docs once qa-report artifact exists" >&2
  exit 2
fi

exit 0
