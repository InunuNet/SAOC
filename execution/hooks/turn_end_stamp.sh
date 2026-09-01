#!/usr/bin/env bash
# turn_end_stamp.sh — Stop hook
# Emits the END half of the turn-timestamps F1 pair. START rides
# inject_pressure.sh (UserPromptSubmit); this hook rides the Stop event,
# which fires per-turn (see SPEC.md "Confirmed mechanism" / DECISIONS.md
# D-Mechanism) -- distinct from StopFailure (reactive quota path only,
# quota_death_checkpoint.sh) and SessionEnd (whole-session, wrong
# granularity).
#
# Inputs (stdin JSON from Claude Code):
#   - session_id: correlates this END with the START written by
#     inject_pressure.sh into the same session_id-keyed file.
# Reads (read-only -- this hook NEVER writes .turn_ts_<session_id>.json;
#   only inject_pressure.sh's START may write it, so a duplicate/late Stop
#   firing can only ever recompute the same correct duration, never corrupt
#   the record START depends on):
#   - .agent/memory/scratch/.turn_ts_<session_id>.json -> last_start_epoch
# Writes:
#   - .agent/memory/scratch/.last_activity.json (cross-session, last-write-
#     wins -- an END is "activity" exactly like a START is)
# Output (stdout JSON):
#   {"systemMessage": "END HH:MM:SS <tz> [(<duration>)]"}
#
# Hard rules (same standard as inject_pressure.sh, written in from the
# start since this is a brand-new file, per SPEC.md "Clock source & edge
# cases"):
#   - ALWAYS exit 0 (never block a turn from stopping)
#   - Gracefully degrade: missing/corrupt state -> bare END line, never a
#     guessed duration
#   - Never emit "decision":"block" -- the stop_hook_active loop-guard does
#     not apply to this hook (DECISIONS.md D-Mechanism)
#   - All stderr suppressed; python work bounded by a short timeout
set +e
exec 2>/dev/null

# --- Private per-invocation temp directory (trailing X-run -- BSD mktemp
# does not substitute a mid-string X-run; see inject_pressure.sh's header
# comment / commit ef19402c for the defect this idiom fixes) -------------
_TMPD=$(mktemp -d "${TMPDIR:-/tmp}/athanor_hook.XXXXXX")
_cleanup_tmpd() { [ -n "$_TMPD" ] && [ -d "$_TMPD" ] && rm -rf "$_TMPD"; }
trap _cleanup_tmpd EXIT

# --- Read hook input from stdin ---
INPUT=$(cat)
SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty')

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd)"
SCRATCH_DIR="${REPO_ROOT:-.}/.agent/memory/scratch"

END_LINE=""
if [ -n "$_TMPD" ] && [ -f "${SCRIPT_DIR:-.}/lib/turn_timestamp.py" ]; then
  _PY="$_TMPD/turn_end.py"
  cat > "$_PY" <<'PYEOF'
import os, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[1])))
import turn_timestamp as ts

session_id = sys.argv[2]
scratch_dir = sys.argv[3]
now = int(time.time())

try:
    duration = None
    if session_id:
        started = ts.read_last_start_epoch(ts.session_state_path(session_id, scratch_dir))
        if started is not None:
            duration = now - started
    # Activity marker: an END is "activity" exactly like a START is (D2).
    ts.touch_last_activity(ts.last_activity_path(scratch_dir), now)
    print(ts.format_end_line(now, duration))
except Exception:
    pass
PYEOF
  END_LINE=$(timeout 4 python3 "$_PY" "${SCRIPT_DIR:-.}/lib/turn_timestamp.py" "$SESSION_ID" "$SCRATCH_DIR" 2>/dev/null)
  rm -f "$_PY"
fi

# Bare fallback if the lib/python path failed for any reason -- honesty
# over silence: still tell Brad the turn ended, just without a duration.
if [ -z "$END_LINE" ]; then
  END_LINE="END $(date +'%H:%M:%S %Z' 2>/dev/null)"
fi

jq -nc --arg msg "$END_LINE" '{"systemMessage":$msg}' || echo '{}'

exit 0
