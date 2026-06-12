#!/usr/bin/env bash
# Golden test for mission-aware claude-loop.sh.
# Verifies the canonical execution/claude-loop.sh has all required structural
# elements after the claude-loop mission merges canon quota/trap logic with
# mission-status gating and first-turn -p / continuation -c branches.
#
# Exit codes:
#   0 — all checks PASS
#   1 — one or more checks FAIL

set -u

# Resolve repo root from this script's location: <repo>/execution/tests/claude-loop/<this>
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TARGET="$REPO_ROOT/execution/claude-loop.sh"
PULSE="$REPO_ROOT/execution/pulse_mission_loop.sh"
TEMPLATE_TARGET="$REPO_ROOT/template/execution/claude-loop.sh"

PASS=0
FAIL=0

_check() {
    local name="$1"; shift
    if "$@" >/dev/null 2>&1; then
        printf 'PASS  %s\n' "$name"
        PASS=$((PASS + 1))
    else
        printf 'FAIL  %s\n' "$name"
        FAIL=$((FAIL + 1))
    fi
}

# C1: shebang is bash (env bash or /bin/bash)
_check "shebang is bash" bash -c "head -1 '$TARGET' | grep -Eq '^#!(/usr/bin/env bash|/bin/bash)'"

# C2: --dangerously-skip-permissions present
_check "--dangerously-skip-permissions flag present" grep -q -- '--dangerously-skip-permissions' "$TARGET"

# C3: claude -c continuation branch present
_check "claude -c continuation present" grep -q 'claude -c' "$TARGET"

# C4: claude -p first-turn branch present
_check "claude -p first-turn present" grep -q 'claude -p' "$TARGET"

# C5: CLAUDE_LOOP_PROMPT referenced
_check "CLAUDE_LOOP_PROMPT referenced" grep -q 'CLAUDE_LOOP_PROMPT' "$TARGET"

# C6: INT TERM trap present
_check "INT TERM trap present" bash -c "grep -q 'trap' '$TARGET' && grep -Eq 'INT TERM|TERM INT' '$TARGET'"

# C7: quota exit-3 backoff preserved
_check "quota exit-3 backoff preserved" bash -c "grep -q 'CLAUDE_LOOP_QUOTA_SLEEP' '$TARGET'"

# C8: active.json read for mission path (NOT bare mission.py status)
_check "active.json used to resolve mission path" grep -q 'active.json' "$TARGET"

# C9: mission.py status called with a positional argument (not bare)
_check "mission.py status called with positional path argument" bash -c "grep -Eq 'mission\\.py[[:space:]]+status[[:space:]]+\"?\\\$' '$TARGET'"

# C10: BLOCKED handling present
_check "BLOCKED exit condition present" grep -q 'BLOCKED' "$TARGET"

# C11: bash syntax valid
_check "bash -n syntax check" bash -n "$TARGET"

# C12: pulse_mission_loop.sh wires CLAUDE_LOOP_PROMPT for claude branch
_check "pulse wires CLAUDE_LOOP_PROMPT=\$RESUME_PROMPT into claude-loop" \
    grep -q 'CLAUDE_LOOP_PROMPT="$RESUME_PROMPT" bash execution/claude-loop.sh' "$PULSE"

# C13: template synced to canon
_check "template/execution/claude-loop.sh matches canon" diff -q "$TARGET" "$TEMPLATE_TARGET"

printf '\n---\nPASS: %d  FAIL: %d\n' "$PASS" "$FAIL"

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
exit 0
