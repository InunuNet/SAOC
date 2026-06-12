#!/usr/bin/env bash
# quota_death_checkpoint.sh — StopFailure command hook
# Claude Code fires StopFailure when a turn ends due to an API error
# (rate_limit, billing_error, authentication_failed, etc.).
# Output and exit code are IGNORED — this hook can only persist state to disk.
#
# We write a one-shot checkpoint that the next SessionStart (full_boot.sh) reads,
# announces, and deletes. This converts silent quota-death into a clean warm-restart.
#
# Filters: only act on rate_limit | billing_error. Other failures (auth, etc.) do not
# need recovery — they need user action, not a resume hint.

set -uo pipefail

# StopFailure payload is JSON on stdin. jq is a hard dependency on this system.
INPUT="$(cat)"

STOP_REASON="$(printf '%s' "$INPUT" | jq -r '.stop_reason // "unknown"' 2>/dev/null || echo unknown)"

case "$STOP_REASON" in
  rate_limit|billing_error) ;;  # proceed
  *) exit 0 ;;                  # ignore — not a quota death
esac

SCRATCH=".agent/memory/scratch"
mkdir -p "$SCRATCH" 2>/dev/null || exit 0
CHECKPOINT="$SCRATCH/.quota_death_checkpoint.json"

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Active mission snapshot (best-effort, never fatal)
ACTIVE_MISSION="null"
ACTIVE_CP="null"
if [ -f .agent/memory/project/missions/active.json ]; then
  ACTIVE_MISSION="$(jq -c '.mission // null' .agent/memory/project/missions/active.json 2>/dev/null || echo null)"
  ACTIVE_CP="$(jq -c '.checkpoint // null' .agent/memory/project/missions/active.json 2>/dev/null || echo null)"
fi

MSG="⚡ QUOTA RECOVERY: Session died ${TS} due to ${STOP_REASON}. Resume: python3 execution/mission.py resume"

# Compose checkpoint via jq so embedded quotes/unicode are safe.
jq -n \
  --arg ts "$TS" \
  --arg reason "$STOP_REASON" \
  --argjson mission "$ACTIVE_MISSION" \
  --argjson cp "$ACTIVE_CP" \
  --arg msg "$MSG" \
  '{timestamp:$ts, stop_reason:$reason, active_mission:$mission, active_checkpoint:$cp, recovery_message:$msg}' \
  > "$CHECKPOINT" 2>/dev/null || exit 0

exit 0
