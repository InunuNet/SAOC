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

# Real StopFailure payload field is .error (docs.claude.com/en/docs/claude-code/hooks),
# not .stop_reason -- there is no such field, so the old read always fell through.
STOP_REASON="$(printf '%s' "$INPUT" | jq -r '.error // "unknown"' 2>/dev/null || echo unknown)"
ERROR_DETAILS="$(printf '%s' "$INPUT" | jq -r '.error_details // empty' 2>/dev/null || true)"

case "$STOP_REASON" in
  rate_limit|billing_error) ;;  # proceed
  *) exit 0 ;;                  # ignore — not a quota death
esac

CHECKPOINT="${ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH:-.agent/memory/scratch/.quota_death_checkpoint.json}"
mkdir -p "$(dirname "$CHECKPOINT")" 2>/dev/null || exit 0
ACTIVE_MISSION_PATH="${ATHANOR_ACTIVE_MISSION_PATH:-.agent/memory/project/missions/active.json}"

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Active mission snapshot (best-effort, never fatal)
ACTIVE_MISSION="null"
ACTIVE_CP="null"
if [ -f "$ACTIVE_MISSION_PATH" ]; then
  ACTIVE_MISSION="$(jq -c '.mission // null' "$ACTIVE_MISSION_PATH" 2>/dev/null || echo null)"
  ACTIVE_CP="$(jq -c '.checkpoint // null' "$ACTIVE_MISSION_PATH" 2>/dev/null || echo null)"
fi

MSG="⚡ QUOTA RECOVERY: Session died ${TS} due to ${STOP_REASON}."
[ -n "$ERROR_DETAILS" ] && MSG="${MSG} (${ERROR_DETAILS})"
MSG="${MSG} Resume: python3 execution/mission.py resume"

# Compose checkpoint via jq so embedded quotes/unicode are safe.
# Write to a temp file in the same directory, then rename into place, so the
# checkpoint is only ever absent or complete -- never truncated by a mid-write kill.
CHECKPOINT_TMP="${CHECKPOINT}.tmp.$$"
jq -n \
  --arg ts "$TS" \
  --arg reason "$STOP_REASON" \
  --argjson mission "$ACTIVE_MISSION" \
  --argjson cp "$ACTIVE_CP" \
  --arg msg "$MSG" \
  '{timestamp:$ts, stop_reason:$reason, active_mission:$mission, active_checkpoint:$cp, recovery_message:$msg}' \
  > "$CHECKPOINT_TMP" 2>/dev/null \
  && mv -f "$CHECKPOINT_TMP" "$CHECKPOINT" 2>/dev/null \
  || { rm -f "$CHECKPOINT_TMP" 2>/dev/null; exit 0; }

exit 0
