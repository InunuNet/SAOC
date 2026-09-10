#!/usr/bin/env bash
# verify_f3_death_detection.sh — live verification for F3 clean-exit vs crash
# disambiguation. Runs entirely inside an isolated mktemp scratch dir via
# ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH / ATHANOR_SESSION_CLEAN_EXIT_MARKER_PATH
# overrides — never touches the real repo's .agent/memory/scratch/ state.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LIB="$REPO_ROOT/execution/hooks/lib/quota_death_detect.sh"
MARKER_HOOK="$REPO_ROOT/execution/hooks/session_clean_exit_marker.sh"

fail() { echo "FAIL: $1" >&2; exit 1; }

SUBCOMMAND="${1:-}"
[ -n "$SUBCOMMAND" ] || fail "usage: verify_f3_death_detection.sh <subcommand>"

SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

export ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH="$SCRATCH/.quota_death_checkpoint.json"
export ATHANOR_SESSION_CLEAN_EXIT_MARKER_PATH="$SCRATCH/.session_clean_exit_at"

write_checkpoint() {
  # $1 = ISO8601 UTC timestamp for the checkpoint's own .timestamp field
  jq -n --arg ts "$1" \
    '{timestamp:$ts, stop_reason:"quota_high_water", active_mission:null, active_checkpoint:null, recovery_message:"⚡ QUOTA RECOVERY: prior session died"}' \
    > "$ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH"
}

write_marker() {
  # $1 = ISO8601 UTC timestamp
  printf '%s\n' "$1" > "$ATHANOR_SESSION_CLEAN_EXIT_MARKER_PATH"
}

iso_offset() {
  # $1 = seconds offset from now (may be negative)
  python3 -c "import datetime,sys; print((datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=int(sys.argv[1]))).strftime('%Y-%m-%dT%H:%M:%SZ'))" "$1"
}

# shellcheck source=execution/hooks/lib/quota_death_detect.sh
source "$LIB"

case "$SUBCOMMAND" in
  clean_exit_after_proactive_checkpoint_suppresses_banner)
    write_checkpoint "$(iso_offset -120)"
    write_marker "$(iso_offset 0)"
    OUT="$(quota_death_detect)"
    if printf '%s' "$OUT" | grep -qi "prior session died"; then
      fail "banner should have been suppressed, got: $OUT"
    fi
    if printf '%s' "$OUT" | grep -q "QUOTA RECOVERY"; then
      fail "QUOTA RECOVERY header should have been suppressed, got: $OUT"
    fi
    echo "PASS: banner suppressed after clean exit following proactive checkpoint"
    ;;

  crash_with_no_marker_still_announces)
    write_checkpoint "$(iso_offset 0)"
    # No marker file at all.
    OUT="$(quota_death_detect)"
    printf '%s' "$OUT" | grep -q "QUOTA RECOVERY" || fail "expected recovery banner, got: $OUT"
    echo "PASS: banner announced with no marker present (genuine crash)"
    ;;

  crash_with_stale_marker_still_announces)
    write_checkpoint "$(iso_offset 0)"
    write_marker "$(iso_offset -600)"
    OUT="$(quota_death_detect)"
    printf '%s' "$OUT" | grep -q "QUOTA RECOVERY" || fail "expected recovery banner, got: $OUT"
    echo "PASS: banner announced with stale marker predating checkpoint"
    ;;

  checkpoint_is_one_shot_in_both_paths)
    # Suppressed branch.
    write_checkpoint "$(iso_offset -120)"
    write_marker "$(iso_offset 0)"
    quota_death_detect > /dev/null
    [ -f "$ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH" ] && fail "checkpoint not consumed in suppress branch"
    # Announce branch.
    rm -f "$ATHANOR_SESSION_CLEAN_EXIT_MARKER_PATH"
    write_checkpoint "$(iso_offset 0)"
    quota_death_detect > /dev/null
    [ -f "$ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH" ] && fail "checkpoint not consumed in announce branch"
    echo "PASS: checkpoint one-shot consumed in both branches"
    ;;

  session_clean_exit_marker_writes_atomically)
    rm -f "$ATHANOR_SESSION_CLEAN_EXIT_MARKER_PATH"
    bash "$MARKER_HOOK"
    [ -f "$ATHANOR_SESSION_CLEAN_EXIT_MARKER_PATH" ] || fail "marker file not created"
    MARKER_TS="$(cat "$ATHANOR_SESSION_CLEAN_EXIT_MARKER_PATH")"
    python3 -c "import datetime,sys; datetime.datetime.fromisoformat(sys.argv[1].replace('Z','+00:00'))" "$MARKER_TS" \
      || fail "marker timestamp not parseable UTC ISO8601: $MARKER_TS"
    if ls "$SCRATCH"/.session_clean_exit_at.tmp.* > /dev/null 2>&1; then
      fail "leftover .tmp.* file found after atomic write"
    fi
    echo "PASS: marker written atomically with parseable UTC ISO8601 timestamp, no leftover tmp file"
    ;;

  *)
    fail "unknown subcommand: $SUBCOMMAND"
    ;;
esac
