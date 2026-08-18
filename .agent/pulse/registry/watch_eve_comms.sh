#!/usr/bin/env bash
# watch_agent_comms.sh — Pulse registry job
# Detects new agent replies in all harness comms.md files.
# On new message: fires push notification + logs to Athanor comms.md.
#
# Agents: Dex (Codex), Gemena (Gemini), Eve (Antigravity), Vex (Alembic)
# CADENCE: Pulse fires every 300s. No internal throttle — check every run.
# NOTE: bash 3.2 compatible (macOS) — no associative arrays.
set +e

# extract_latest_block <comms_file> <agent>
# Prints the full latest message block for <agent> from <comms_file>: the
# last line matching "\[<agent>" (case-insensitive) through end-of-file,
# stopping before the next "## [" header line. Output is capped at 200
# lines and trailing blank lines are trimmed. Prints "(new message)" when
# no matching line is found. Side-effect free; safe to source.
extract_latest_block() {
  local comms_file="$1"
  local agent="$2"
  local start_line

  start_line=$(grep -in "\[${agent}" "$comms_file" 2>/dev/null | tail -1 | cut -d: -f1)

  if [ -z "$start_line" ]; then
    printf '%s\n' "(new message)"
    return
  fi

  awk -v start="$start_line" -v cap=200 '
    NR < start { next }
    NR == start { print; c = 1; next }
    /^## \[/ { exit }
    { if (c < cap) { print; c++ } else { exit } }
  ' "$comms_file" | awk '
    { lines[NR] = $0 }
    END {
      n = NR
      while (n > 0 && lines[n] ~ /^[ \t]*$/) n--
      for (i = 1; i <= n; i++) print lines[i]
    }
  '
}

main() {
  PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
  LOCK_DIR="$PROJECT_ROOT/.agent/pulse/registry/processing"
  ATHANOR_COMMS="$PROJECT_ROOT/.agent/memory/project/comms.md"
  NOTIFY_URL="http://localhost:8888/notify"
  mkdir -p "$LOCK_DIR"

  AGENTS=("DEX" "GEMINI" "EVE" "AL")
  COMMS_PATHS=(
    "/Users/vetus/ai/Codex Harness/comms.md"
    "/Users/vetus/ai/Gemini Harness/comms.md"
    "/Users/vetus/ai/Anti Harness/comms.md"
    "/Users/vetus/ai/Alembic/comms.md"
  )

  i=0
  while [ $i -lt ${#AGENTS[@]} ]; do
    AGENT="${AGENTS[$i]}"
    COMMS="${COMMS_PATHS[$i]}"
    i=$((i + 1))

    [ -f "$COMMS" ] || continue

    AGENT_LOWER=$(printf '%s' "$AGENT" | tr '[:upper:]' '[:lower:]')
    HASH_FILE="$LOCK_DIR/agent-comms-${AGENT_LOWER}-hash.txt"
    COUNT_FILE="$LOCK_DIR/agent-comms-${AGENT_LOWER}-count.txt"

    CURRENT_HASH=$(md5 -q "$COMMS" 2>/dev/null || md5sum "$COMMS" 2>/dev/null | cut -d' ' -f1)
    LAST_HASH=$(cat "$HASH_FILE" 2>/dev/null || echo "")

    [ "$CURRENT_HASH" = "$LAST_HASH" ] && continue
    printf '%s' "$CURRENT_HASH" > "$HASH_FILE"

    MSG_COUNT=$(grep -ic "\[${AGENT}" "$COMMS" 2>/dev/null || echo 0)
    LAST_COUNT=$(cat "$COUNT_FILE" 2>/dev/null || echo "0")
    printf '%s' "$MSG_COUNT" > "$COUNT_FILE"

    if [ "$MSG_COUNT" -gt "$LAST_COUNT" ] 2>/dev/null; then
      LATEST=$(extract_latest_block "$COMMS" "$AGENT")

      # Push notification
      curl -s -X POST "$NOTIFY_URL" \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"${AGENT} has a new message. Check comms.\", \"voice_id\": \"fTtv3eikoepIosk8dTZ5\", \"voice_enabled\": true}" \
        >/dev/null 2>&1 || true

      # Log to Athanor comms.md
      printf '\n## [%s -> CODI] %s — new message\n%s\n\n' \
        "$AGENT" "$(date '+%Y-%m-%d %H:%M')" "$LATEST" >> "$ATHANOR_COMMS" 2>/dev/null || true

      echo "[watch-agent-comms] ${AGENT} has new message — notified."
    fi
  done

  exit 0
}

[ "${BASH_SOURCE[0]}" = "$0" ] && main
