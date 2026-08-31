#!/usr/bin/env bash
# quota_death_detect.sh — sourceable quota-death checkpoint detector
#
# Extracted from full_boot.sh's QUOTA_CP block so it can be driven live
# (e.g. by execution/checks/verify_f3_death_detection.sh) without running
# the rest of full_boot.sh's network calls (gh api, Alembic health check,
# Pulse launchd).
#
# quota_death_detect: reads the quota-death checkpoint and the clean-exit
# marker (both path-overridable via ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH /
# ATHANOR_SESSION_CLEAN_EXIT_MARKER_PATH), prints to stdout exactly what
# full_boot.sh would print, and always does the one-shot rm -f on the
# checkpoint (consumed either way).
quota_death_detect() {
  local QUOTA_CP="${ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH:-.agent/memory/scratch/.quota_death_checkpoint.json}"
  local CLEAN_EXIT_MARKER="${ATHANOR_SESSION_CLEAN_EXIT_MARKER_PATH:-.agent/memory/scratch/.session_clean_exit_at}"
  if [ -f "$QUOTA_CP" ]; then
    local CP_TS CP_EPOCH MARKER_TS MARKER_EPOCH
    CP_TS="$(jq -r '.timestamp // empty' "$QUOTA_CP" 2>/dev/null)"
    CP_EPOCH=""
    if [ -n "$CP_TS" ]; then
      CP_EPOCH="$(python3 -c "import datetime,sys; s=sys.argv[1].replace('Z','+00:00'); print(int(datetime.datetime.fromisoformat(s).timestamp()))" "$CP_TS" 2>/dev/null)"
    fi
    MARKER_EPOCH=""
    if [ -f "$CLEAN_EXIT_MARKER" ]; then
      MARKER_TS="$(cat "$CLEAN_EXIT_MARKER" 2>/dev/null)"
      if [ -n "$MARKER_TS" ]; then
        MARKER_EPOCH="$(python3 -c "import datetime,sys; s=sys.argv[1].replace('Z','+00:00'); print(int(datetime.datetime.fromisoformat(s).timestamp()))" "$MARKER_TS" 2>/dev/null)"
      fi
    fi
    if [ -n "$CP_EPOCH" ] && [ -n "$MARKER_EPOCH" ] && [ "$MARKER_EPOCH" -ge "$CP_EPOCH" ]; then
      : # a clean exit happened after this checkpoint was written -- not a crash, suppress the banner
    else
      echo "--- QUOTA RECOVERY ---"
      jq -r '.recovery_message // "⚡ QUOTA RECOVERY: prior session died — see .quota_death_checkpoint.json"' "$QUOTA_CP" 2>/dev/null || echo "⚡ QUOTA RECOVERY: prior session died"
      local MISSION_NAME
      MISSION_NAME="$(jq -r '.active_mission // empty' "$QUOTA_CP" 2>/dev/null || true)"
      if [ -n "$MISSION_NAME" ] && [ "$MISSION_NAME" != "null" ]; then
        echo "   Active mission at death: $MISSION_NAME"
      fi
      echo ""
    fi
    rm -f "$QUOTA_CP" 2>/dev/null || true   # one-shot: consume so we never replay
  fi
}
