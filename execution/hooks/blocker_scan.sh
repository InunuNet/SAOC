#!/usr/bin/env bash
# blocker_scan.sh — Stop hook (blocker-status-line F1, SPEC.md D3/D4)
#
# The ONLY hook site with transcript access for the two transcript-derived
# blocker codes (AWAITING_ANSWER / AWAITING_PLAN_APPROVAL, D1). Fires on
# every successful Stop; a bounded tail-read of the transcript (never a
# full-file scan — session_token_log.sh's whole-file summing pattern is
# explicitly the wrong model to copy here, D4) looks for a trailing
# AskUserQuestion or ExitPlanMode tool_use with no matching tool_result —
# the shape of "the turn just ended because Claude is now waiting on Brad".
#
# Inputs (stdin JSON from Claude Code):
#   - transcript_path: path to the current session transcript (JSONL)
#   - session_id: keys .blocker_transcript_signal.json (same Pulse-label
#     collision reasoning as turn-timestamps D2 — many concurrent sessions
#     can share one workspace)
# Reads (read-only — this hook NEVER writes to the transcript itself,
#   verified by goldens/verify_scope_boundary.sh):
#   - transcript_path, last TAIL_LINES lines only
# Writes:
#   - .agent/memory/scratch/.blocker_transcript_signal.json, via
#     `execution/blocker_status.py record-transcript-signal` (the only
#     writer of that file — this hook never touches it directly)
#
# Hard rules (same standard as inject_pressure.sh / turn_end_stamp.sh):
#   - ALWAYS exit 0 (never block a stop)
#   - Fails closed: any error, missing data, or ambiguous shape -> no
#     signal written, never a guessed one
#   - All stderr suppressed; python work bounded by a short timeout
set +e
exec 2>/dev/null

TAIL_LINES=200

# Private per-invocation temp directory, trailing X-run (BSD mktemp does
# not substitute a mid-string X-run — see inject_pressure.sh's header /
# commit ef19402c for the defect class this idiom fixes).
_TMPD=$(mktemp -d "${TMPDIR:-/tmp}/athanor_hook.XXXXXX")
_cleanup_tmpd() { [ -n "$_TMPD" ] && [ -d "$_TMPD" ] && rm -rf "$_TMPD"; }
trap _cleanup_tmpd EXIT

INPUT=$(cat)
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty')
SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty')

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd)"
SCRATCH_DIR="${REPO_ROOT:-.}/.agent/memory/scratch"
BLOCKER_STATUS="${SCRIPT_DIR:-.}/../blocker_status.py"

if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ] && [ -n "$_TMPD" ] && [ -n "$SESSION_ID" ]; then
  _TAIL="$_TMPD/tail.jsonl"
  tail -n "$TAIL_LINES" "$TRANSCRIPT" > "$_TAIL" 2>/dev/null
  _PY="$_TMPD/blocker_scan.py"
  cat > "$_PY" <<'PYEOF'
import json, sys

tail_path = sys.argv[1]
WATCHED = {"AskUserQuestion": "answer", "ExitPlanMode": "plan"}
# tool_use_id -> awaiting kind, insertion-ordered so the LAST surviving
# entry (after tool_result pops matched ones) is the most recent unmatched
# tool_use in file order -- an earlier unmatched entry a later one
# supersedes is stale history the tail happened to include, not "the turn
# that just ended".
pending = {}
try:
    with open(tail_path, "rb") as f:
        for raw in f:
            try:
                line = raw.decode("utf-8").strip()
            except Exception:
                continue
            if not line:
                continue
            try:
                rec = json.loads(line)
            except Exception:
                continue
            if not isinstance(rec, dict):
                continue
            msg = rec.get("message")
            content = msg.get("content") if isinstance(msg, dict) else None
            if not isinstance(content, list):
                continue
            for block in content:
                if not isinstance(block, dict):
                    continue
                btype = block.get("type")
                if btype == "tool_use" and block.get("name") in WATCHED:
                    tool_id = block.get("id")
                    if tool_id:
                        pending[tool_id] = WATCHED[block["name"]]
                elif btype == "tool_result":
                    pending.pop(block.get("tool_use_id"), None)
except Exception:
    sys.exit(0)

if pending:
    print(list(pending.values())[-1])
PYEOF
  AWAITING=$(timeout 4 python3 "$_PY" "$_TAIL" 2>/dev/null)
  rm -f "$_PY" "$_TAIL"
  if [ "$AWAITING" = "answer" ] || [ "$AWAITING" = "plan" ]; then
    if [ -f "$BLOCKER_STATUS" ]; then
      timeout 4 python3 "$BLOCKER_STATUS" record-transcript-signal \
        --awaiting "$AWAITING" --session-id "$SESSION_ID" --scratch-dir "$SCRATCH_DIR" >/dev/null 2>&1
    fi
  fi
fi

exit 0
