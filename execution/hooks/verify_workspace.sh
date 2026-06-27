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

# Layer 1: WORKSPACE file must exist
if [ ! -f "$WORKSPACE_FILE" ]; then
  echo "⛔ WORKSPACE file missing — run 'bash init.sh' first. If this is a new project, run '/onboard'." >&2
  exit 2
fi

WORKSPACE_NAME=$(sed 's/[[:space:]]*$//' < "$WORKSPACE_FILE" | head -1)
DIR_NAME=$(basename "$PWD")

# Layer 2: WORKSPACE content must match current directory name
if [ "$WORKSPACE_NAME" != "$DIR_NAME" ]; then
  echo "⛔ Workspace mismatch: WORKSPACE says '$WORKSPACE_NAME' but dir is '$DIR_NAME'" >&2
  exit 2
fi

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
