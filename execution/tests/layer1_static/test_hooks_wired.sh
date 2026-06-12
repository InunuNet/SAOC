#!/usr/bin/env bash
# Layer 1: Verify .claude/settings.json has required hooks wired
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh

echo "=== test_hooks_wired.sh ==="

SETTINGS=".claude/settings.json"

# SessionStart hook with full_boot.sh
OUT=$(jq -r '.hooks.SessionStart[]?.hooks[]?.command // ""' "$SETTINGS" 2>/dev/null | grep -c "full_boot.sh" || echo 0)
[ "$OUT" -ge 1 ] && RC=0 || RC=1
assert_exit "SessionStart has full_boot.sh"      0 $RC

# PreToolUse Write hook (scope check for PAI/MEMORY paths)
OUT=$(jq -r '.hooks.PreToolUse[]? | select(.matcher == "Write") | .hooks[]?.command // ""' "$SETTINGS" 2>/dev/null | grep -c "exit 2" || echo 0)
[ "$OUT" -ge 1 ] && RC=0 || RC=1
assert_exit "PreToolUse Write hook exists"       0 $RC

# PreToolUse Bash hook with verify_workspace.sh
OUT=$(jq -r '.hooks.PreToolUse[]? | select(.matcher == "Bash") | .hooks[]?.command // ""' "$SETTINGS" 2>/dev/null | grep -c "verify_workspace.sh" || echo 0)
[ "$OUT" -ge 1 ] && RC=0 || RC=1
assert_exit "PreToolUse Bash has verify_workspace.sh" 0 $RC

# SubagentStop hook with subagent_stop.sh
OUT=$(jq -r '.hooks.SubagentStop[]?.hooks[]?.command // ""' "$SETTINGS" 2>/dev/null | grep -c "subagent_stop.sh" || echo 0)
[ "$OUT" -ge 1 ] && RC=0 || RC=1
assert_exit "SubagentStop has subagent_stop.sh"  0 $RC

summary
