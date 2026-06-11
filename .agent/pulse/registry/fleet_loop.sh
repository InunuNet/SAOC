#!/usr/bin/env bash
# fleet_loop.sh — Pulse registry job (Athanor-specific, NOT in template/).
# Headlessly boots each downstream fleet project so they read comms.md
# directives and reply autonomously. Idempotent via lock file.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LOCK_DIR="$PROJECT_ROOT/.agent/pulse/registry/processing"
LOG_DIR="$PROJECT_ROOT/.agent/pulse/logs"
LOCK_FILE="$LOCK_DIR/fleet-loop.lock"
LOG_FILE="$LOG_DIR/fleet-loop-$(date +%Y%m%d-%H%M%S).log"

mkdir -p "$LOCK_DIR" "$LOG_DIR" 2>/dev/null || true

# Concurrency guard — prevent two simultaneous Pulse runs from interleaving.
if [ -f "$LOCK_FILE" ]; then
    pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        echo "[fleet-loop] another instance running (pid=$pid) — exiting" >> "$LOG_FILE"
        exit 0
    fi
    # Stale lock — remove and proceed.
    rm -f "$LOCK_FILE"
fi
echo "$$" > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT INT TERM

# Fleet project table: "AGENT_NAME|PATH|PROVIDER"
# Paths with spaces must remain quoted when used as "$project_path".
PROJECTS=(
    "DEX|/Users/vetus/ai/Codex Harness|claude-code"
    "EVE|/Users/vetus/ai/Anti Harness|claude-code"
    "SAOC|/Users/vetus/ai/SAOC|claude-code"
    "GEMMA|/Users/vetus/ai|gemini-cli"
)

# Headless prompt — quoted heredoc preserves body literally (no expansion here).
# AGENT_NAME is substituted per-project at runtime via parameter expansion.
read -r -d '' PROMPT <<'PROMPT_EOF'
You are the primary agent for this project. Do NOT ask questions or wait for input.

1. Run: bash execution/hooks/full_boot.sh 2>/dev/null | head -5
2. Read: cat .agent/memory/project/comms.md | tail -80
3. Find the latest [CODI -> YOU] or [CODI -> ALL] directive (most recent = nearest top of file)
4. Execute it using your mandatory chain if it requires code work
5. Append your reply to comms.md:
   ## [AGENT_NAME -> CODI] YYYY-MM-DD HH:MM -- directive complete
   STATUS: done/blocked
   BOOT SIZE: $(bash execution/hooks/full_boot.sh 2>/dev/null | wc -c) bytes
   UPSTREAM ISSUE: none (or describe friction)
6. Run: python3 execution/brain.py wrap-up --summary "comms reply + directive executed" --tags "comms,fleet-loop"
7. Run: git add -A && git commit -m "chore: comms reply + fleet-loop session wrap"
PROMPT_EOF

for entry in "${PROJECTS[@]}"; do
    IFS='|' read -r agent_name project_path provider <<< "$entry"

    echo "===== $(date) $agent_name @ $project_path =====" >> "$LOG_FILE"

    if [ ! -d "$project_path" ]; then
        echo "[fleet-loop] SKIP $agent_name: path missing" >> "$LOG_FILE"
        continue
    fi

    cd "$project_path" || { echo "[fleet-loop] cd failed for $agent_name" >> "$LOG_FILE"; continue; }

    # Substitute AGENT_NAME placeholder into the prompt for this project.
    this_prompt="${PROMPT//AGENT_NAME/$agent_name}"

    case "$provider" in
        gemini-cli) bin="gemini" ;;
        *)          bin="claude" ;;
    esac

    if ! command -v "$bin" >/dev/null 2>&1; then
        echo "[fleet-loop] SKIP $agent_name: $bin not found" >> "$LOG_FILE"
        continue
    fi

    timeout 600 "$bin" -p "$this_prompt" >> "$LOG_FILE" 2>&1
    ec=$?
    echo "[fleet-loop] exit=$ec agent=$agent_name" >> "$LOG_FILE"
done
