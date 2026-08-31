#!/usr/bin/env bash
# pulse_quota_resume.sh — mission quota-aware-execution F4: durable
# quota-window resume primitive. Default-OFF, gated by
# ATHANOR_PULSE_QUOTA_RESUME (unset/0/false/False/FALSE all mean off).
#
# When explicitly enabled, reads F3's death checkpoint
# (.agent/memory/scratch/.quota_death_checkpoint.json), consults F1's quota
# oracle (execution/quota.py status) to confirm the 5-hour window has
# actually reset, and if so enqueues a resume ticket through the existing
# execution/pulse_ticket.py enqueue machinery. The resulting ticket flows
# through pulse_dispatcher.py's ordinary budget_block_reason /
# check_provider_backoff / dedupe / lease gates exactly like any other
# ticket — this script adds no bypass, no new scheduling infrastructure.
#
# NOT wired into the live Pulse mission loop, the Pulse runner, the Pulse
# service-management entrypoint, or the launchd unit by this feature.
# Enabling the flag persistently anywhere is out of scope and requires
# separate, explicit operator sign-off (June 2026 token-burn incident).
#
# Every internal failure (malformed checkpoint, unknown quota state, enqueue
# failure) degrades to exit 0, no ticket, no traceback — a Pulse job failure
# must never break the cycle.
set -u

# --- 1. Master switch — first, before any other read or side effect -------
# Fail-closed ALLOWLIST: only an exact "1" or "true" (after trim + lowercase)
# means ON. Every other value -- unset, empty, malformed, whitespace-padded,
# or simply unanticipated -- means OFF. Do not lengthen this into a blocklist.
_flag_raw="${ATHANOR_PULSE_QUOTA_RESUME:-}"
_flag_trimmed="$(printf '%s' "$_flag_raw" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
_flag_lower="$(printf '%s' "$_flag_trimmed" | tr '[:upper:]' '[:lower:]')"
case "$_flag_lower" in
    "1"|"true")
        ;;
    *)
        exit 0
        ;;
esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DEFAULT_CHECKPOINT_PATH=".agent/memory/scratch/.quota_death_checkpoint.json"
CHECKPOINT_PATH="${ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH:-$DEFAULT_CHECKPOINT_PATH}"
MAX_CHECKPOINT_AGE_SECONDS="${ATHANOR_QUOTA_RESUME_MAX_CHECKPOINT_AGE_SECONDS:-21600}"
MIRROR_PATH="${ATHANOR_QUOTA_RESUME_MIRROR_PATH:-}"
QUEUE_DIR="${ATHANOR_QUOTA_RESUME_QUEUE_DIR:-}"
PROJECT_PATH="${ATHANOR_QUOTA_RESUME_PROJECT_PATH:-$(pwd)}"
PROVIDER="${ATHANOR_QUOTA_RESUME_PROVIDER:-claude-code}"

# --- 2. Read + validate the checkpoint -------------------------------------
[ -f "$CHECKPOINT_PATH" ] || exit 0

checkpoint_json="$(cat "$CHECKPOINT_PATH" 2>/dev/null)" || exit 0
[ -n "$checkpoint_json" ] || exit 0

checkpoint_ts="$(printf '%s' "$checkpoint_json" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
    ts = data.get("timestamp")
    if not isinstance(ts, str) or not ts:
        raise ValueError
    print(ts)
except Exception:
    sys.exit(1)
' 2>/dev/null)"
[ -n "$checkpoint_ts" ] || exit 0

checkpoint_epoch="$(python3 -c '
import datetime, sys
try:
    ts = sys.argv[1].replace("Z", "+00:00")
    dt = datetime.datetime.fromisoformat(ts)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    print(int(dt.timestamp()))
except Exception:
    sys.exit(1)
' "$checkpoint_ts" 2>/dev/null)"
[ -n "$checkpoint_epoch" ] || exit 0

now_epoch="$(date -u +%s)"

# --- 3. Staleness bound ------------------------------------------------------
checkpoint_age=$((now_epoch - checkpoint_epoch))
if [ "$checkpoint_age" -lt 0 ]; then
    echo "WARN: pulse_quota_resume: checkpoint timestamp is in the future (clock skew or impossible/corrupted state) -- rejecting" >&2
    exit 0
fi
if [ "$checkpoint_age" -gt "$MAX_CHECKPOINT_AGE_SECONDS" ]; then
    exit 0
fi

# --- 4. Consult F1's quota oracle -------------------------------------------
quota_args=(status --json)
if [ -n "$MIRROR_PATH" ]; then
    quota_args+=(--mirror-path "$MIRROR_PATH")
fi

quota_json="$(cd "$REPO_ROOT" && python3 execution/quota.py "${quota_args[@]}" 2>/dev/null)"
[ -n "$quota_json" ] || exit 0

quota_state="$(printf '%s' "$quota_json" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get("state", ""))
except Exception:
    print("")
' 2>/dev/null)"
[ "$quota_state" = "ok" ] || exit 0

resets_at="$(printf '%s' "$quota_json" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get("resets_at") or "")
except Exception:
    print("")
' 2>/dev/null)"
[ -n "$resets_at" ] || exit 0

resets_epoch="$(python3 -c '
import datetime, sys
try:
    ts = sys.argv[1].replace("Z", "+00:00")
    dt = datetime.datetime.fromisoformat(ts)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    print(int(dt.timestamp()))
except Exception:
    sys.exit(1)
' "$resets_at" 2>/dev/null)"
[ -n "$resets_epoch" ] || exit 0

# --- 5. Boundary — only proceed once the window has actually reset ---------
now_epoch="$(date -u +%s)"
if [ "$now_epoch" -lt "$resets_epoch" ]; then
    exit 0
fi

# --- 6. Deterministic dedupe_key, derived from the checkpoint's own ts -----
dedupe_key="quota-resume:${PROJECT_PATH}:${checkpoint_ts}"

# --- 7. Enqueue through the shared ticket writer, never hand-composed JSON -
enqueue_args=(
    enqueue
    --source pulse_quota_resume
    --kind quota-resume
    --requires-model true
    --provider "$PROVIDER"
    --dedupe-key "$dedupe_key"
    --project-path "$PROJECT_PATH"
    --prompt "Resume work: the Anthropic quota window has reset. Recover from the last quota-death checkpoint and continue the active mission."
)
if [ -n "$QUEUE_DIR" ]; then
    enqueue_args+=(--queue-dir "$QUEUE_DIR")
fi

(cd "$REPO_ROOT" && python3 execution/pulse_ticket.py "${enqueue_args[@]}" >/dev/null 2>&1)
enqueue_exit=$?
[ "$enqueue_exit" -eq 0 ] || exit 0

exit 0
