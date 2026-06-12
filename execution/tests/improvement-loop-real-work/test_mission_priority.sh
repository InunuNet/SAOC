#!/usr/bin/env bash
# Golden test for mission: improvement-loop-real-work
#
# Verifies that execution/improvement_loop.sh contains the mission-first
# priority check at the top of the main loop body, that the legacy
# step 7.5 mission-advance block has been removed, and that the file
# is syntactically valid bash.
#
# Exit 0 if all checks PASS; exit 1 if any check FAILs.

set -u

# Resolve project root from this script's location: tests/<slug>/file -> exec -> root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LOOP_SH="$PROJECT_ROOT/execution/improvement_loop.sh"

fails=0
total=0

check() {
  local desc="$1"; shift
  total=$(( total + 1 ))
  if "$@" >/dev/null 2>&1; then
    echo "PASS  ${total}. ${desc}"
  else
    echo "FAIL  ${total}. ${desc}"
    fails=$(( fails + 1 ))
  fi
}

if [[ ! -f "$LOOP_SH" ]]; then
  echo "FAIL  improvement_loop.sh not found at $LOOP_SH"
  exit 1
fi

# 1. active.json read in improvement_loop.sh
check "active.json referenced in improvement_loop.sh" \
  grep -q 'active.json' "$LOOP_SH"

# 2. CLAUDE_LOOP_PROMPT set in improvement_loop.sh
check "CLAUDE_LOOP_PROMPT set before claude-loop.sh call" \
  grep -q 'CLAUDE_LOOP_PROMPT' "$LOOP_SH"

# 3. claude-loop.sh invocation present
check "claude-loop.sh invocation present" \
  grep -q 'claude-loop.sh' "$LOOP_SH"

# 4. --max 1 used for single-turn advance
check "claude-loop.sh called with --max 1" \
  grep -qE 'claude-loop\.sh.*--max 1' "$LOOP_SH"

# 5. Old step 7.5 comment / signature NOT present anymore
if grep -qE '7\.5:|Active mission found' "$LOOP_SH"; then
  echo "FAIL  5. legacy step 7.5 block still present"
  fails=$(( fails + 1 ))
else
  echo "PASS  5. legacy step 7.5 block removed"
fi
total=$(( total + 1 ))

# 6. bash -n syntax check
check "improvement_loop.sh passes bash -n syntax check" \
  bash -n "$LOOP_SH"

echo "---"
echo "Results: $(( total - fails )) / $total passed"

if (( fails > 0 )); then
  exit 1
fi
exit 0
