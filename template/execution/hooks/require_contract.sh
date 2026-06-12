#!/usr/bin/env bash
# F4: Gate @architect -> @dev
# Fires on PreToolUse/Agent. Blocks dev dispatch when no contract.yaml exists
# for the CURRENT active mission. Mission-specific check prevents old contracts
# from satisfying the gate for a different mission.

INPUT=$(cat)

TYPE=$(printf '%s' "$INPUT" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('subagent_type',''))" \
  2>/dev/null)

case "$TYPE" in
  dev) ;;
  *) exit 0 ;;
esac

# Get active mission slug — check mission-specific contract
SLUG=$(python3 -c "
import json, pathlib, os, re
p = pathlib.Path('.agent/memory/project/missions/active.json')
if p.exists():
    d = json.loads(p.read_text())
    m = d.get('mission', '') or ''
    basename = os.path.splitext(os.path.basename(m))[0]
    # Strip date prefix (handles multi-date like 2026-05-13-2026-05-14-slug)
    slug = re.sub(r'^(\d{4}-\d{2}-\d{2}-)+', '', basename)
    print(slug)
else:
    print('')
" 2>/dev/null || echo "")

if [[ -n "$SLUG" ]]; then
  CONTRACT=$(find .agent/memory/project/specs -path "*${SLUG}*" -name "contract*.yaml" 2>/dev/null | head -1 || echo "")
  if [[ -z "$CONTRACT" ]]; then
    echo "BLOCKED: No contract.yaml found for active mission '${SLUG}'." >&2
    echo "FIX: Dispatch @architect to write contract + golden files." >&2
    echo "     Output file: .agent/memory/project/specs/${SLUG}/contract.yaml" >&2
    echo "     Required section: goldens: (min 256 bytes, with assertions)" >&2
    echo "     Goldens dir:   .agent/memory/project/specs/${SLUG}/goldens/" >&2
    echo "THEN: re-dispatch @dev once contract.yaml exists for '${SLUG}'" >&2
    exit 2
  fi
  # Validate the contract isn't empty
  SIZE=$(wc -c < "$CONTRACT" 2>/dev/null || echo 0)
  if [[ "$SIZE" -lt 100 ]]; then
    echo "BLOCKED: contract.yaml for '${SLUG}' is too small (${SIZE} bytes) — likely incomplete." >&2
    echo "FIX: Dispatch @architect to expand contract with features, goldens, and assertions." >&2
    echo "     Output file: ${CONTRACT}" >&2
    echo "     Required section: features:, goldens:, assertions: (total min 256 bytes)" >&2
    echo "THEN: re-dispatch @dev once contract.yaml is complete" >&2
    exit 2
  fi
  exit 0
fi

# No active mission — fall back to generic handoff check
RESULT=$(python3 execution/handoff_check.py --from architect --to dev 2>/dev/null)
PASS=$(printf '%s' "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('pass','false'))" 2>/dev/null || echo "false")

if [[ "$PASS" != "True" && "$PASS" != "true" ]]; then
  echo "BLOCKED: No contract*.yaml found in .agent/memory/project/specs/" >&2
  echo "FIX: Dispatch @architect to write contract + golden files." >&2
  echo "     Output file: .agent/memory/project/specs/<slug>/contract.yaml" >&2
  echo "     Required section: goldens: (min 256 bytes)" >&2
  echo "THEN: re-dispatch @dev once contract.yaml exists" >&2
  exit 2
fi

exit 0
