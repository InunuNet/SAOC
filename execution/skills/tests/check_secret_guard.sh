#!/usr/bin/env bash
# check_secret_guard.sh — Phase-4 gate: secret_guard.py must flag exactly the
# known-secret golden paths and none of the known-safe golden paths.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PY=".venv/bin/python3"
[ -x "$PY" ] || PY="python3"

GOLDENS="$REPO_ROOT/.agent/memory/project/specs/wrap-mission-secrets-guard/goldens"
GUARD="$REPO_ROOT/execution/skills/lib/secret_guard.py"

FAIL=0

SECRET_OUT="$("$PY" "$GUARD" --stdin < "$GOLDENS/secret_paths_input.txt")" && SECRET_RC=0 || SECRET_RC=$?
SECRET_LINES=0
[ -n "$SECRET_OUT" ] && SECRET_LINES=$(printf '%s\n' "$SECRET_OUT" | wc -l | tr -d ' ')
if [ "$SECRET_RC" -ne 1 ] || [ "$SECRET_LINES" -ne 6 ]; then
    echo "FAIL: secret_paths_input.txt expected exit=1 lines=6, got exit=$SECRET_RC lines=$SECRET_LINES" >&2
    FAIL=1
fi

SAFE_OUT="$("$PY" "$GUARD" --stdin < "$GOLDENS/safe_paths_input.txt")" && SAFE_RC=0 || SAFE_RC=$?
SAFE_LINES=0
[ -n "$SAFE_OUT" ] && SAFE_LINES=$(printf '%s\n' "$SAFE_OUT" | wc -l | tr -d ' ')
if [ "$SAFE_RC" -ne 0 ] || [ "$SAFE_LINES" -ne 0 ]; then
    echo "FAIL: safe_paths_input.txt expected exit=0 lines=0, got exit=$SAFE_RC lines=$SAFE_LINES" >&2
    FAIL=1
fi

CASE_OUT="$(echo ".SECRETS/key.json" | "$PY" "$GUARD" --stdin)" && CASE_RC=0 || CASE_RC=$?
if [ "$CASE_RC" -ne 1 ] || [ "$CASE_OUT" != ".SECRETS/key.json" ]; then
    echo "FAIL: .SECRETS/key.json expected exit=1 (case-insensitive match), got exit=$CASE_RC out='$CASE_OUT'" >&2
    FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
    exit 1
fi

echo "OK: check_secret_guard.sh"
exit 0
