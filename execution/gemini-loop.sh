#!/usr/bin/env bash
# gemini-loop.sh — Autonomous mission loop for Gemini CLI projects on the Athanor harness.
#
# Usage:
#   ./execution/gemini-loop.sh                  # loop until active mission complete
#   ./execution/gemini-loop.sh --max 10         # limit to 10 turns
#   ./execution/gemini-loop.sh --dry-run        # print what would be sent, don't invoke
#
# The Gemini CLI turn-based model returns to the user after each response.
# This script re-invokes `gemini -p` with a resume prompt after each turn,
# enabling autonomous chain progression without manual re-prompting.
#
# Termination conditions:
#   - Mission status = completed or null (no active mission)
#   - Mission status = BLOCKED
#   - MAX_ITERATIONS reached
#   - gemini not found on PATH

set -euo pipefail

MAX_ITERATIONS=${ATHANOR_LOOP_MAX:-20}
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --max) MAX_ITERATIONS="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# Verify gemini is available
if ! command -v gemini &>/dev/null; then
  echo "[gemini-loop] ERROR: gemini not found on PATH. Install Gemini CLI first." >&2
  exit 1
fi

# Verify we're in an Athanor workspace
if [[ ! -f "WORKSPACE" ]]; then
  echo "[gemini-loop] ERROR: WORKSPACE file not found. Run from project root." >&2
  exit 1
fi

PROJECT=$(cat WORKSPACE)
echo "[gemini-loop] Project: $PROJECT | Max iterations: $MAX_ITERATIONS"

# Build the resume prompt
RESUME_PROMPT="You are the primary agent on the Athanor harness. \
At the start of this turn: run python3 execution/mission.py resume to get the current checkpoint. \
Then proceed through ALL remaining chain steps (@architect→@dev→@qa→@docs→gate→@maintainer) \
without stopping or asking for confirmation between steps. \
Chain Continuous: never pause at step boundaries. \
Only stop when the mission is DONE (gate green + brain wrapped) or BLOCKED."

for i in $(seq 1 "$MAX_ITERATIONS"); do
  echo ""
  echo "[gemini-loop] ── Turn $i / $MAX_ITERATIONS ──────────────────────────"

  # Check mission status before each turn
  STATUS=$(python3 execution/mission.py status 2>/dev/null || echo "unknown")
  echo "[gemini-loop] Mission status: $STATUS"

  case "$STATUS" in
    *completed*|*"mission complete"*|*"no active mission"*|null)
      echo "[gemini-loop] Mission complete — loop exiting."
      exit 0
      ;;
    *BLOCKED*)
      echo "[gemini-loop] Mission BLOCKED — human intervention required. Loop exiting." >&2
      exit 2
      ;;
  esac

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[gemini-loop] DRY-RUN — would invoke: gemini -p \"${RESUME_PROMPT:0:80}...\""
    continue
  fi

  # Invoke Gemini CLI headlessly
  gemini -p "$RESUME_PROMPT" || {
    echo "[gemini-loop] WARN: gemini exited non-zero on turn $i — continuing loop." >&2
  }
done

echo "[gemini-loop] MAX_ITERATIONS ($MAX_ITERATIONS) reached without completion." >&2
exit 1
