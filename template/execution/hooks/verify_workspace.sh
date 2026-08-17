#!/usr/bin/env bash
# verify_workspace.sh — PreToolUse hook for Bash commands
# Validates agent is operating in the correct workspace.
# Exit 0 = allow, Exit 2 = block tool call.


# Allow localhost voice/notification calls (not cross-project writes)
INPUT=$(cat 2>/dev/null || true)
case "$INPUT" in
    *localhost:888*|*127.0.0.1:888*) exit 0 ;;
esac

WORKSPACE_FILE="WORKSPACE"
PROFILE_FILE=".agent/profile.json"

# Worktree detection: if CWD is a git worktree of the main project, resolve
# WORKSPACE and PROFILE from the main project root and check from there.
if command -v git >/dev/null 2>&1; then
  GIT_COMMON=$(git rev-parse --git-common-dir 2>/dev/null)
  GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
  # Non-empty, different → we're in a linked worktree
  if [ -n "$GIT_COMMON" ] && [ -n "$GIT_DIR" ] && [ "$GIT_COMMON" != "$GIT_DIR" ]; then
    MAIN_ROOT=$(cd "$(dirname "$GIT_COMMON")" && pwd)
    if [ -f "$MAIN_ROOT/WORKSPACE" ]; then
      MAIN_NAME=$(sed 's/[[:space:]]*$//' < "$MAIN_ROOT/WORKSPACE" | head -1)
      # Validate profile from main project root too
      if [ -f "$MAIN_ROOT/.agent/profile.json" ] && command -v python3 >/dev/null 2>&1; then
        PNAME=$(python3 -c "import json,sys; p=json.load(open('$MAIN_ROOT/.agent/profile.json')); print(p.get('project_name',''))" 2>/dev/null)
        if [ -n "$PNAME" ] && [ "$PNAME" != "$MAIN_NAME" ]; then
          echo "⛔ Worktree profile mismatch: profile.json says '$PNAME' but WORKSPACE says '$MAIN_NAME'" >&2
          exit 2
        fi
      fi
      # Valid worktree of the correct project — allow
      exit 0
    fi
  fi
fi

# Layer 1: WORKSPACE file must exist
if [ ! -f "$WORKSPACE_FILE" ]; then
  echo "⛔ WORKSPACE file missing — run 'bash init.sh' first. If this is a new project, run '/onboard'." >&2
  exit 2
fi

WORKSPACE_NAME=$(sed 's/[[:space:]]*$//' < "$WORKSPACE_FILE" | head -1)

# Layer 2 (removed): directory-name check was too strict — workspace name and folder
# name are allowed to differ (e.g. workspace="Anti Harness" in folder "Athanor").
# Layer 3 (profile.json) is the meaningful consistency check.

# Layer 3: profile.json project_name must match (if file exists and has a name set)
if [ -f "$PROFILE_FILE" ]; then
  if ! command -v python3 >/dev/null 2>&1; then
    echo "⚠️  python3 not found — skipping profile check" >&2
    exit 0
  fi
  PROFILE_NAME=$(PROFILE_FILE="$PROFILE_FILE" python3 -c "
import json, os, sys
try:
    p = json.load(open(os.environ['PROFILE_FILE']))
    print(p.get('project_name', ''))
except Exception:
    sys.exit(1)
" 2>/dev/null)
  if [ $? -ne 0 ]; then
    echo "⛔ profile.json is unreadable or malformed" >&2
    exit 2
  fi
  # Only check if project_name is set (empty = pre-onboard, skip)
  if [ -n "$PROFILE_NAME" ] && [ "$PROFILE_NAME" != "$WORKSPACE_NAME" ]; then
    echo "⛔ Profile mismatch: profile.json says '$PROFILE_NAME' but WORKSPACE says '$WORKSPACE_NAME'" >&2
    exit 2
  fi
  if [ -z "$PROFILE_NAME" ]; then
    echo "⚠️  profile.json.project_name is empty — run /onboard" >&2
  fi
fi

exit 0
