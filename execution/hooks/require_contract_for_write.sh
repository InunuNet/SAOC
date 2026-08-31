#!/usr/bin/env bash
# require_contract_for_write.sh — PreToolUse contract gate
# exit 0 = allow, exit 2 = block (no contract for active mission)
# Uses bash/jq only for the common path — avoids interpreter startup cost per
# hooks.md rule; the Bash-mutation detector shells out to python3 only when a
# Bash tool call is being evaluated (see lib/bash_mutation_paths.py).
# Fails OPEN on any internal error so a hook bug never paralyses the workspace.

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")

# ── Path helpers (shared by the Write/Edit path and the Bash-mutation path) ──

normalize_path() {
  local p="$1" _dir _base _resolved_dir
  if [ -n "$p" ]; then
    _dir="$(dirname "$p")"
    _base="$(basename "$p")"
    _resolved_dir="$(cd "$_dir" 2>/dev/null && pwd)"
    if [ -n "$_resolved_dir" ]; then
      p="${_resolved_dir}/${_base}"
    fi
  fi
  printf '%s' "$p"
}

is_traversal() {
  case "$1" in
    */../*|*/..) return 0 ;;
    *) return 1 ;;
  esac
}

is_safe_zone() {
  case "$1" in
    */.agent/memory/*|*.agent/memory/*) return 0 ;;
    */docs/*|docs/*) return 0 ;;
    */CHANGELOG.md|CHANGELOG.md) return 0 ;;
    */WORKSPACE|WORKSPACE) return 0 ;;
    */.agent/version|.agent/version) return 0 ;;
    */.agent/profile.json|.agent/profile.json) return 0 ;;
    */.agent/handoffs.yaml|.agent/handoffs.yaml) return 0 ;;
    */comms.md|comms.md) return 0 ;;
    README.md|*/README.md) return 0 ;;
    /tmp/*|*/tmp/*) return 0 ;;
    /private/tmp/*|*/private/tmp/*) return 0 ;;
    */scratchpad/*) return 0 ;;
    *) return 1 ;;
  esac
}

# ── Mission/contract decision — resolved once per hook invocation ────────────
# Path-independent: only depends on the active mission and whether it has a
# contract. Echoes "allow" or "block:<message>".
mission_contract_decision() {
  local ACTIVE_JSON=".agent/memory/project/missions/active.json"

  if [ ! -f "$ACTIVE_JSON" ]; then
    echo "allow"
    return
  fi

  local MISSION_PATH
  MISSION_PATH=$(jq -r '.mission // ""' "$ACTIVE_JSON" 2>/dev/null || echo "")

  if [ -z "$MISSION_PATH" ]; then
    echo "allow"
    return
  fi

  # ── Derive slug from mission path ───────────────────────────────────────
  local SLUG="${MISSION_PATH##*/}"
  SLUG="${SLUG%.md}"
  # strip ALL leading YYYY-MM-DD- prefixes (handles double-date filenames)
  while [[ "$SLUG" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}- ]]; do
    SLUG="${SLUG#????-??-??-}"
  done

  if [ -z "$SLUG" ]; then
    echo "allow"
    return
  fi

  # ── Terminal-status mission guard (GH #1300) ────────────────────────────
  # active.json can linger pointing at a mission whose frontmatter status has
  # already reached a terminal state (complete/"done"/abandoned). Treat that
  # as not-active and fail open instead of blocking every write. Handles
  # both unquoted (status: complete) and quoted (status: "complete")
  # frontmatter. Capture the FULL status token, not just its leading word --
  # a narrower class would truncate a hyphenated value like
  # "abandoned-superseded" and false-match the terminal case. GH #1300
  # follow-up.
  if [ -f "$MISSION_PATH" ]; then
    local MISSION_STATUS
    MISSION_STATUS=$(grep -m1 '^status:' "$MISSION_PATH" 2>/dev/null \
      | sed -E 's/^status:[[:space:]]*"?([A-Za-z0-9_-]+)"?.*/\1/')
    case "$MISSION_STATUS" in
      complete|"done"|abandoned)
        echo "allow"
        return ;;
    esac
  fi

  # ── Check contract exists ───────────────────────────────────────────────
  local CONTRACT_PATH
  CONTRACT_PATH=$(find ".agent/memory/project/specs/${SLUG}" -name "contract*.yaml" 2>/dev/null | head -1 || echo "")

  if [ -f "$CONTRACT_PATH" ]; then
    echo "allow"
    return
  fi

  echo "block:⛔ CONTRACT GATE: No contract found for active mission '${SLUG}'.
   Expected at: .agent/memory/project/specs/${SLUG}/contract*.yaml
   Run @architect via the harness chain to produce it, then retry."
}

DECISION_COMPUTED=0
DECISION_RESULT=""

get_decision() {
  if [ "$DECISION_COMPUTED" -eq 0 ]; then
    DECISION_RESULT="$(mission_contract_decision)"
    DECISION_COMPUTED=1
  fi
  printf '%s' "$DECISION_RESULT"
}

# check_path <raw path> — 0 = allow, 2 = block (prints the block message)
check_path() {
  local raw="$1" p decision
  p="$(normalize_path "$raw")"

  # A path with /../ after normalization is a likely traversal attack.
  if is_traversal "$p"; then
    return 2
  fi

  if is_safe_zone "$p"; then
    return 0
  fi

  if [ -z "$p" ]; then
    return 0
  fi

  decision="$(get_decision)"
  case "$decision" in
    allow) return 0 ;;
    block:*)
      echo "${decision#block:}" >&2
      return 2 ;;
    *) return 0 ;;
  esac
}

# ── Bash-tool mutation gate ───────────────────────────────────────────────────
if [ "$TOOL_NAME" = "Bash" ]; then
  COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

  if [ -z "$COMMAND" ]; then
    exit 0
  fi

  CANDIDATES=$(printf '%s' "$COMMAND" | python3 "${HOOK_DIR}/lib/bash_mutation_paths.py" 2>/dev/null || echo "")

  if [ -z "$CANDIDATES" ]; then
    # No known mutation signature detected -- default allow.
    exit 0
  fi

  while IFS= read -r candidate; do
    [ -z "$candidate" ] && continue
    if ! check_path "$candidate"; then
      exit 2
    fi
  done <<< "$CANDIDATES"

  exit 0
fi

# ── Write/Edit path ────────────────────────────────────────────────────────
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || echo "")

if ! check_path "$FILE_PATH"; then
  exit 2
fi

exit 0
