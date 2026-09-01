#!/usr/bin/env bash
# quota_resume_notice.sh — mission quota-aware-pause-resume F2: zero-spend
# resume notice.
#
# Default ON (ATHANOR_PULSE_QUOTA_NOTICE=0 disables). When the quota window
# has reopened -- per execution/quota_resume_window.py, the single resolver
# shared with the flag-gated dispatch half -- writes exactly one item into
# the EXISTING Pulse inbox naming the paused mission, the milestone/feature,
# and the exact resume command. Combined with the boot recovery banner
# full_boot.sh already prints from the same checkpoint, this is a complete
# human-in-the-loop resume path with zero spend.
#
# Never writes .agent/memory/project/RESUME.md -- that file is
# hand-authored (DECISIONS D-8); a background job overwriting it would
# destroy human-written context. Never invokes a model, a provider CLI, or
# the ticket queue -- that is what the separate, flag-gated
# execution/pulse_quota_resume.sh is for (June 2026 token-burn incident).
# Putting a default-ON side effect inside THAT script would satisfy its
# ticket-counting check while violating quota-aware-execution F4/A5's
# requirement that the flag make it "COMPLETELY inert" -- hence this
# separate script.
#
# Idempotent per checkpoint timestamp: the dedupe key mirrors
# pulse_quota_resume.sh's own derivation, so one pause produces exactly one
# note and a genuinely new pause (a new checkpoint timestamp) produces a
# new one.
#
# Every internal failure (malformed checkpoint, unreadable resolver output,
# missing inbox dir) degrades to exit 0, no note, no traceback -- a Pulse
# job must never break the cycle.
set -u

# --- 1. Master switch — default ON, first, before any other read ----------
# Same fail-closed shape as pulse_quota_resume.sh's allowlist, mirrored for
# the opposite default: only an exact "0" or "false" (after trim +
# lowercase) turns this OFF. Everything else -- unset, malformed, or simply
# unanticipated -- stays ON, because this half cannot spend.
_flag_raw="${ATHANOR_PULSE_QUOTA_NOTICE:-1}"
_flag_trimmed="$(printf '%s' "$_flag_raw" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
_flag_lower="$(printf '%s' "$_flag_trimmed" | tr '[:upper:]' '[:lower:]')"
case "$_flag_lower" in
    "0"|"false")
        exit 0
        ;;
esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESOLVER="$REPO_ROOT/execution/quota_resume_window.py"

DEFAULT_CHECKPOINT_PATH=".agent/memory/scratch/.quota_death_checkpoint.json"
CHECKPOINT_PATH="${ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH:-$DEFAULT_CHECKPOINT_PATH}"
MIRROR_PATH="${ATHANOR_QUOTA_RESUME_MIRROR_PATH:-}"
DEFAULT_INBOX_DIR="$REPO_ROOT/.agent/memory/project/inbox"
INBOX_DIR="${ATHANOR_QUOTA_RESUME_INBOX_DIR:-$DEFAULT_INBOX_DIR}"
PROJECT_PATH="${ATHANOR_QUOTA_RESUME_PROJECT_PATH:-$(pwd)}"

[ -f "$CHECKPOINT_PATH" ] || exit 0

# --- 2. Ask the single resolver whether the window has reopened -----------
[ -f "$RESOLVER" ] || exit 0
resolver_args=(--checkpoint "$CHECKPOINT_PATH")
if [ -n "$MIRROR_PATH" ]; then
    resolver_args+=(--mirror-path "$MIRROR_PATH")
fi
resolver_out="$(python3 "$RESOLVER" "${resolver_args[@]}" 2>/dev/null)" || exit 0
verdict="$(printf '%s' "$resolver_out" | awk '{print $1}')"
[ "$verdict" = "READY" ] || exit 0

# --- 3. Pull the fields the note needs, straight from the checkpoint ------
checkpoint_json="$(cat "$CHECKPOINT_PATH" 2>/dev/null)" || exit 0
[ -n "$checkpoint_json" ] || exit 0

checkpoint_ts="$(printf '%s' "$checkpoint_json" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
    ts = data.get("timestamp")
    print(ts if isinstance(ts, str) else "")
except Exception:
    print("")
' 2>/dev/null)"
[ -n "$checkpoint_ts" ] || exit 0

active_mission="$(printf '%s' "$checkpoint_json" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
    m = data.get("active_mission")
    print(m if isinstance(m, str) else "")
except Exception:
    print("")
' 2>/dev/null)"

milestone="$(printf '%s' "$checkpoint_json" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
    cp = data.get("active_checkpoint") or {}
    v = cp.get("milestone")
    print(v if isinstance(v, str) else "")
except Exception:
    print("")
' 2>/dev/null)"

feature="$(printf '%s' "$checkpoint_json" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
    cp = data.get("active_checkpoint") or {}
    v = cp.get("feature")
    print(v if isinstance(v, str) else "")
except Exception:
    print("")
' 2>/dev/null)"

# --- 4. Deterministic dedupe, keyed on the checkpoint's own timestamp -----
# Same key shape pulse_quota_resume.sh derives for its dedupe_key, so the
# two halves agree on what "the same pause" means.
dedupe_key="quota-resume:${PROJECT_PATH}:${checkpoint_ts}"
dedupe_slug="$(printf '%s' "$dedupe_key" | shasum -a 256 2>/dev/null | awk '{print $1}')"
if [ -z "$dedupe_slug" ]; then
    dedupe_slug="$(printf '%s' "$dedupe_key" | tr -c 'A-Za-z0-9' '_')"
fi

mkdir -p "$INBOX_DIR" 2>/dev/null || exit 0
note_path="$INBOX_DIR/quota-resume-${dedupe_slug}.txt"
[ -f "$note_path" ] && exit 0   # already notified for this exact pause

cat > "$note_path" <<EOF
⚡ QUOTA RESUME — the 5h quota window has reopened.

Paused mission: ${active_mission}
Checkpoint: milestone ${milestone}, feature ${feature}

Resume with:
    python3 execution/mission.py resume
EOF

exit 0
