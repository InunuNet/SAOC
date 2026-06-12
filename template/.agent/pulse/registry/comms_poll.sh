#!/usr/bin/env bash
# comms_poll.sh — Pulse registry job (Athanor harness template).
# Detects new [CODI -> <AGENT>] or [CODI -> ALL] directives in this project's
# comms.md and queues them as inbox items so the next boot picks them up.
# Idempotent via per-directive hash lock. Auto-discovered by pulse_runner.sh.

set -uo pipefail

# Resolve project root from this script's location (.agent/pulse/registry/<this>).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

LOCK_DIR="$PROJECT_ROOT/.agent/pulse/registry/processing"
INBOX="$PROJECT_ROOT/.agent/memory/project/inbox"
PROFILE="$PROJECT_ROOT/.agent/profile.json"

mkdir -p "$LOCK_DIR" "$INBOX" 2>/dev/null || true

# Need jq for agent name extraction; silent no-op if unavailable.
command -v jq >/dev/null 2>&1 || exit 0
[ -f "$PROFILE" ] || exit 0

AGENT_NAME=$(jq -r '.identity.agent_name // .project_name // "UNKNOWN"' "$PROFILE" 2>/dev/null \
  | tr '[:lower:]' '[:upper:]')
[ -z "$AGENT_NAME" ] && exit 0

# comms.md location varies. Prefer canonical .agent/memory/project/comms.md,
# fall back to project-root comms.md (Codex/Gemini/Anti style).
COMMS="$PROJECT_ROOT/.agent/memory/project/comms.md"
[ -f "$COMMS" ] || COMMS="$PROJECT_ROOT/comms.md"
[ -f "$COMMS" ] || exit 0

# Extract the most recent [CODI -> <AGENT_NAME>] or [CODI -> ALL] block.
# Header forms accepted (case-insensitive on agent name):
#   ## [CODI -> DEX]
#   ## [CODI -> dex]
#   ## [CODI -> ALL]
#   ## [CODI -> DEX]   (UTF-8 right-arrow)
# Block ends at next "## [" header or EOF. We keep only the LAST matching block.
DIRECTIVE=$(awk -v agent="$AGENT_NAME" '
  BEGIN { IGNORECASE = 1; capture = 0; last = ""; cur = "" }
  /^##[[:space:]]*\[CODI[[:space:]]*(->|→)[[:space:]]*[A-Za-z]+\]/ {
    # New header — flush previous capture if it targeted us or ALL.
    if (capture) { last = cur }
    cur = $0 "\n"
    # Determine target by stripping prefix/suffix.
    line = $0
    sub(/^.*CODI[[:space:]]*(->|→)[[:space:]]*/, "", line)
    sub(/\].*$/, "", line)
    target = toupper(line)
    if (target == agent || target == "ALL") { capture = 1 } else { capture = 0 }
    next
  }
  /^##[[:space:]]*\[/ {
    # Different header — close any open capture.
    if (capture) { last = cur; capture = 0 }
    cur = ""
    next
  }
  { if (capture) { cur = cur $0 "\n" } }
  END { if (capture) { last = cur }; printf "%s", last }
' "$COMMS")

# Bail if no matching directive found.
[ -z "$(printf '%s' "$DIRECTIVE" | tr -d '[:space:]')" ] && exit 0

# Hash-lock so re-runs don't re-queue the same directive.
if command -v md5 >/dev/null 2>&1; then
  SIG=$(printf '%s' "$DIRECTIVE" | md5)
else
  SIG=$(printf '%s' "$DIRECTIVE" | md5sum | cut -d' ' -f1)
fi
LOCK="$LOCK_DIR/codi-directive-$SIG.lock"
[ -f "$LOCK" ] && exit 0

touch "$LOCK" 2>/dev/null || true
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
OUT="$INBOX/codi-directive-$TIMESTAMP.txt"

{
  printf '## CODI DIRECTIVE (auto-queued by comms_poll.sh at %s)\n' "$TIMESTAMP"
  printf 'Target: %s\n' "$AGENT_NAME"
  printf 'Source: %s\n\n' "$COMMS"
  printf '%s\n' "$DIRECTIVE"
} > "$OUT"

echo "[comms-poll] queued directive for $AGENT_NAME -> $OUT"
