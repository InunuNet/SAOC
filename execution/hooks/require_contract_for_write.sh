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
# Path-independent: only depends on the active mission and whether its CURRENT
# feature (active.json's checkpoint.feature) has a contract. Delegates the
# actual resolution to lib/resolve_feature_contract.py, which calls
# mission.py's own parse_mission_file() and _existing_contract_for_feature()
# -- so this hook and `mission.py gate` read mission files and resolve
# contracts identically and can never disagree about whether a feature has
# a contract. Echoes "allow" or "block:<message>".
#
# Fails CLOSED, not open: a guard that cannot understand its own resolver's
# answer does not know the write is safe -- it knows nothing, and "I know
# nothing" must not read as "allow". So a nonzero exit from the resolver, or
# any stdout line other than the ones it documents, blocks.
mission_contract_decision() {
  local RESULT RC
  RESULT=$(python3 "${HOOK_DIR}/lib/resolve_feature_contract.py" 2>/dev/null)
  RC=$?

  if [ "$RC" -ne 0 ]; then
    echo "block:⛔ CONTRACT GATE: resolve_feature_contract.py exited ${RC} — cannot determine whether the current feature has a contract.
   Raw output: ${RESULT:-<empty>}
   This is a hook-internal failure, not a missing contract — diagnose lib/resolve_feature_contract.py before retrying."
    return
  fi

  case "$RESULT" in
    allow)
      echo "allow" ;;
    contract:*)
      echo "allow" ;;
    noncontract)
      echo "block:⛔ CONTRACT GATE: No contract found for the active mission's current feature.
   Checked: the feature's attach-spec contract: field, then
   .agent/memory/project/specs/<mission-slug>/contract-f<N>.yaml, then
   .agent/memory/project/specs/<mission-slug>/contract.yaml.
   Run @architect via the harness chain to produce it, then retry." ;;
    invalid:*)
      echo "block:⛔ CONTRACT GATE: contract fails to validate: ${RESULT#invalid:}
   Fix the contract (run: python3 execution/contract.py validate <path>), then retry." ;;
    missing:*)
      echo "block:⛔ CONTRACT GATE: feature's attach-spec contract: field names a file that does not exist: ${RESULT#missing:}
   Fix the attached path (mission.py attach-spec) or restore the missing contract file, then retry." ;;
    *)
      # Unrecognised stdout from the resolver despite a zero exit -- an
      # unreadable answer is not a green light. Blocks.
      echo "block:⛔ CONTRACT GATE: resolve_feature_contract.py produced an unrecognised result: '${RESULT}'.
   This is a hook-internal failure, not a missing contract — diagnose lib/resolve_feature_contract.py before retrying." ;;
  esac
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
