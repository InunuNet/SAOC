#!/usr/bin/env bash
# check_mission_complete.sh — Phase-4 gate: mission_complete.py must gate
# active.json clearing correctly on the status of the referenced mission.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PY=".venv/bin/python3"
[ -x "$PY" ] || PY="python3"

GOLDENS="$REPO_ROOT/.agent/memory/project/specs/wrap-mission-secrets-guard/goldens"
MC="$REPO_ROOT/execution/skills/lib/mission_complete.py"

FAIL=0

"$PY" "$MC" "$GOLDENS/active_complete.json" >/dev/null 2>&1 && RC=0 || RC=$?
if [ "$RC" -ne 0 ]; then
    echo "FAIL: active_complete.json expected exit=0, got $RC" >&2
    FAIL=1
fi

"$PY" "$MC" "$GOLDENS/active_incomplete.json" >/dev/null 2>&1 && RC=0 || RC=$?
if [ "$RC" -ne 1 ]; then
    echo "FAIL: active_incomplete.json expected exit=1, got $RC" >&2
    FAIL=1
fi

"$PY" "$MC" "/nonexistent-active.json" >/dev/null 2>&1 && RC=0 || RC=$?
if [ "$RC" -ne 2 ]; then
    echo "FAIL: /nonexistent-active.json expected exit=2, got $RC" >&2
    FAIL=1
fi

GHOST_ACTIVE="$(mktemp -t mission_complete_ghost.XXXXXX.json)"
trap 'rm -f "$GHOST_ACTIVE"' EXIT
printf '{"mission": ".agent/memory/project/missions/DOES-NOT-EXIST.md"}' > "$GHOST_ACTIVE"
"$PY" "$MC" "$GHOST_ACTIVE" >/dev/null 2>&1 && RC=0 || RC=$?
if [ "$RC" -ne 2 ]; then
    echo "FAIL: ghost mission pointer expected exit=2, got $RC" >&2
    FAIL=1
fi
rm -f "$GHOST_ACTIVE"
trap - EXIT

if [ "$FAIL" -ne 0 ]; then
    exit 1
fi

echo "OK: check_mission_complete.sh"
exit 0
