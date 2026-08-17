#!/usr/bin/env bash
# require_contract_for_write.sh — PreToolUse contract gate
# exit 0 = allow, exit 2 = block (no contract for active mission)
# Uses bash/jq only — avoids interpreter startup cost per hooks.md rule
# Fails OPEN on any internal error so a hook bug never paralyses the workspace.

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || echo "")

# ── Normalize FILE_PATH to eliminate .. traversal before safe-zone check ──────
# Uses cd/pwd/basename — works on macOS without extra interpreter startup cost.
# If the parent directory exists, resolve it fully; otherwise leave as-is and
# apply the /../ substring guard below as a fallback.
if [ -n "$FILE_PATH" ]; then
  _dir="$(dirname "$FILE_PATH")"
  _base="$(basename "$FILE_PATH")"
  _resolved_dir="$(cd "$_dir" 2>/dev/null && pwd)"
  if [ -n "$_resolved_dir" ]; then
    FILE_PATH="${_resolved_dir}/${_base}"
  fi
fi

# Secondary guard: reject any path that still contains /../ after normalization.
# A path with /../ after normalization is a likely traversal attack — block it.
case "$FILE_PATH" in
  */../*|*/..) exit 2 ;;  # block un-normalizable traversal paths
esac

# ── Safe-zone allow list ──────────────────────────────────────────────────────
# These paths always allow — no contract required.
# Match regardless of whether FILE_PATH is absolute or relative.
case "$FILE_PATH" in
  */.agent/memory/*|*.agent/memory/*)
    exit 0 ;;
  */docs/*|docs/*)
    exit 0 ;;
  */CHANGELOG.md|CHANGELOG.md)
    exit 0 ;;
  */WORKSPACE|WORKSPACE)
    exit 0 ;;
  */.agent/version|.agent/version)
    exit 0 ;;
  */.agent/profile.json|.agent/profile.json)
    exit 0 ;;
  */.agent/handoffs.yaml|.agent/handoffs.yaml)
    exit 0 ;;
  */comms.md|comms.md)
    exit 0 ;;
  README.md|*/README.md)
    exit 0 ;;
  /tmp/*|*/tmp/*)
    exit 0 ;;
  /private/tmp/*|*/private/tmp/*)
    exit 0 ;;
  */scratchpad/*)
    exit 0 ;;
esac

# ── FILE_PATH empty means we cannot determine target — fail open ──────────────
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# ── Resolve active mission ────────────────────────────────────────────────────
ACTIVE_JSON=".agent/memory/project/missions/active.json"

if [ ! -f "$ACTIVE_JSON" ]; then
  # No active mission — allow freely (warn-only)
  exit 0
fi

MISSION_PATH=$(jq -r '.mission // ""' "$ACTIVE_JSON" 2>/dev/null || echo "")

if [ -z "$MISSION_PATH" ]; then
  # Could not parse active.json — fail open
  exit 0
fi

# ── Derive slug from mission path ─────────────────────────────────────────────
# basename: strip directory
SLUG="${MISSION_PATH##*/}"
# strip trailing .md
SLUG="${SLUG%.md}"
# strip ALL leading YYYY-MM-DD- prefixes (handles double-date filenames)
while [[ "$SLUG" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}- ]]; do
  SLUG="${SLUG#????-??-??-}"
done

if [ -z "$SLUG" ]; then
  # Cannot derive slug — fail open
  exit 0
fi

# ── Terminal-status mission guard (GH #1300) ──────────────────────────────────
# active.json can linger pointing at a mission whose frontmatter status has
# already reached a terminal state (complete/"done"/abandoned). Treat that as
# not-active and fail open instead of blocking every write. Handles both
# unquoted (status: complete) and quoted (status: "complete") frontmatter.
if [ -f "$MISSION_PATH" ]; then
  # Capture the FULL status token (letters/digits/_/-), not just its leading
  # word — a narrower class here would truncate a hyphenated value like
  # "abandoned-superseded" down to "abandoned" and false-match the terminal
  # case below, fail-opening a write that should instead hit the contract
  # gate. GH #1300 follow-up.
  MISSION_STATUS=$(grep -m1 '^status:' "$MISSION_PATH" 2>/dev/null \
    | sed -E 's/^status:[[:space:]]*"?([A-Za-z0-9_-]+)"?.*/\1/')
  case "$MISSION_STATUS" in
    complete|"done"|abandoned)
      exit 0 ;;
  esac
fi

# ── KNOWN LIMITATION: this guard only fires on Write/Edit tool_input ─────────
# .claude/settings.json wires this hook only under the PreToolUse "Write" and
# "Edit" matchers — there is no Bash matcher entry for it. A Bash command that
# writes to disk via a redirect or file-mutating utility (>, >>, tee, sed -i,
# cp, mv, git checkout -- <path>, etc.) reaches the filesystem with zero
# contract-gate involvement. This is a real structural gap, not a deliberate
# scope boundary, but closing it safely requires a new hook that can detect
# file-mutating Bash command forms without false-positiving on the vast
# majority of read-only/non-file Bash calls — that is its own mission with
# its own adversarial QA, not a rider on this fix. See backlog.md.

# ── Check contract exists ─────────────────────────────────────────────────────
CONTRACT_PATH=$(find ".agent/memory/project/specs/${SLUG}" -name "contract*.yaml" 2>/dev/null | head -1 || echo "")

if [ -f "$CONTRACT_PATH" ]; then
  exit 0
fi

# Contract missing — block with actionable message
echo "⛔ CONTRACT GATE: No contract found for active mission '${SLUG}'." >&2
echo "   Expected at: ${CONTRACT_PATH}" >&2
echo "   Run @architect via the harness chain to produce it, then retry." >&2
exit 2
