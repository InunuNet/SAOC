#!/usr/bin/env bash
# check_autonomy.sh — PreToolUse autonomy gate
# exit 0 = allow, exit 2 = block
# Uses bash/jq only — no python3 startup cost per hooks.md rule
# Session cache: /tmp/athanor_autonomy_$PPID (cleared on new session)

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || echo "")
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")
# Trim leading whitespace — prevents bypass via "  sudo ..." or "  rm -rf ..."
COMMAND="${COMMAND#"${COMMAND%%[! ]*}"}"

CACHE="/tmp/athanor_autonomy_${PPID}"

# Read level from session cache or profile.json
# Fallback is "low" (maximally restrictive safe default when config missing).
# Note: autonomy_matrix.json "default": "medium" is the onboarding default —
# this hook fallback is intentionally more restrictive for safety.
if [ -f "$CACHE" ]; then
  LEVEL=$(cat "$CACHE")
else
  LEVEL=$(jq -r '.autonomy.level // "low"' .agent/profile.json 2>/dev/null || echo "low")
  echo "$LEVEL" > "$CACHE"
fi

# ── Floor denials — always blocked at every level including high ──────────────
case "$FILE_PATH" in
  */.git/*|*/.env|*/.sops.yaml|*.pem|*.key|*/secrets/*|\
  */init.sh|*/full_boot.sh|*/.gemini/policies/*|*/.ssh/*|*/.aws/*|*/.gnupg/*)
    echo "⛔ AUTONOMY FLOOR: write to protected path '$FILE_PATH' always denied" >&2
    exit 2 ;;
esac

case "$COMMAND" in
  *"rm -rf "*|"rm -rf"|*"git push --force"*"main"*|\
  *"git push --force"*"master"*|"chmod 777 "*|\
  *"curl"*"| sh"*|*"curl"*"| bash"*|\
  *"wget"*"| sh"*|*"wget"*"| bash"*|\
  "dd if=/dev/zero"*|"sudo "*)
    echo "⛔ AUTONOMY FLOOR: command denied at all levels" >&2
    exit 2 ;;
esac

# ── Off: block all writes and shell ──────────────────────────────────────────
if [ "$LEVEL" = "off" ]; then
  case "$TOOL" in
    Write|Edit|Bash)
      echo "⛔ AUTONOMY OFF: $TOOL requires explicit confirmation (level=off)" >&2
      exit 2 ;;
  esac
fi

# ── Low: restrict writes to memory dirs only ─────────────────────────────────
if [ "$LEVEL" = "low" ]; then
  if [ "$TOOL" = "Write" ] || [ "$TOOL" = "Edit" ]; then
    case "$FILE_PATH" in
      */.agent/memory/scratch/*|*/.agent/memory/project/*)
        exit 0 ;;
      *)
        echo "⛔ AUTONOMY LOW: write to '$FILE_PATH' requires confirmation" >&2
        exit 2 ;;
    esac
  fi
fi

# ── Medium: protect infrastructure files ─────────────────────────────────────
if [ "$LEVEL" = "medium" ]; then
  if [ "$TOOL" = "Write" ] || [ "$TOOL" = "Edit" ]; then
    case "$FILE_PATH" in
      */.agent/rules/_core/*|*/.gemini/policies/*|*/.claude/settings.json|*/Makefile)
        echo "⛔ AUTONOMY MEDIUM: '$FILE_PATH' is protected infrastructure (level=medium)" >&2
        exit 2 ;;
    esac
  fi
fi

# ── All other cases: allow ────────────────────────────────────────────────────
exit 0
