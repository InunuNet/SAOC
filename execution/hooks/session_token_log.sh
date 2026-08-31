#!/usr/bin/env bash
# session_token_log.sh — SessionEnd command hook
# Best-effort per-session token accounting. Reads the FULL transcript at
# SessionEnd, sums usage across every assistant usage block, and appends one
# durable JSONL record to .agent/memory/project/telemetry/session_usage.jsonl.
#
# Inputs (stdin JSON from Claude Code SessionEnd payload):
#   - session_id, transcript_path, reason
# Reads:
#   - transcript_path (full file, not tail — must sum every usage block)
#   - dispatch-events log (ATHANOR_DISPATCH_EVENTS_PATH, same default as
#     subagent_start.sh) filtered to this session_id for agent_dispatch_count
# Output:
#   - one JSON line appended (flock-guarded) to the durable log, default
#     .agent/memory/project/telemetry/session_usage.jsonl
#     (override: ATHANOR_SESSION_TOKEN_LOG_PATH)
#
# Hard rules:
#   - ALWAYS exit 0 (never block session close)
#   - Never fabricate a zeroed/garbage record — if transcript is missing,
#     unreadable, empty, or session_id is absent, write nothing
#   - Append only — never overwrite/truncate the output log
set +e
exec 2>/dev/null

INPUT=$(cat)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd)"

DEFAULT_LOG="${REPO_ROOT:-.}/.agent/memory/project/telemetry/session_usage.jsonl"
LOG_PATH="${ATHANOR_SESSION_TOKEN_LOG_PATH:-$DEFAULT_LOG}"

DEFAULT_DISPATCH_LOG="${REPO_ROOT:-.}/.agent/memory/scratch/.session_dispatch_events.jsonl"
DISPATCH_LOG="${ATHANOR_DISPATCH_EVENTS_PATH:-$DEFAULT_DISPATCH_LOG}"

mkdir -p "$(dirname "$LOG_PATH")" 2>/dev/null

SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty')

if [ -z "$SESSION_ID" ] || [ -z "$TRANSCRIPT" ] || [ ! -s "$TRANSCRIPT" ]; then
  exit 0
fi

RECORD=$(SESSION_ID="$SESSION_ID" DISPATCH_LOG="$DISPATCH_LOG" timeout 20 python3 - "$TRANSCRIPT" <<'PYEOF'
import json, os, sys, datetime

transcript_path = sys.argv[1]
session_id = os.environ.get("SESSION_ID", "")
dispatch_log = os.environ.get("DISPATCH_LOG", "")

input_tokens = 0
output_tokens = 0
cache_creation_input_tokens = 0
cache_read_input_tokens = 0
last_model = ""
saw_usage = False

try:
    with open(transcript_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except Exception:
                continue
            msg = rec.get("message")
            if not isinstance(msg, dict):
                continue
            usage = msg.get("usage")
            if not isinstance(usage, dict):
                continue
            saw_usage = True
            input_tokens += int(usage.get("input_tokens", 0) or 0)
            output_tokens += int(usage.get("output_tokens", 0) or 0)
            cache_creation_input_tokens += int(usage.get("cache_creation_input_tokens", 0) or 0)
            cache_read_input_tokens += int(usage.get("cache_read_input_tokens", 0) or 0)
            model = msg.get("model")
            if model:
                last_model = model
except Exception:
    sys.exit(0)

if not saw_usage:
    sys.exit(0)

dispatch_count = 0
if dispatch_log and os.path.isfile(dispatch_log):
    try:
        with open(dispatch_log) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    ev = json.loads(line)
                except Exception:
                    continue
                if ev.get("session_id") == session_id:
                    dispatch_count += 1
    except Exception:
        dispatch_count = 0

total_tokens = (
    input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens
)

record = {
    "session_id": session_id,
    "ts": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "model": last_model,
    "agent_dispatch_count": dispatch_count,
    "input_tokens": input_tokens,
    "output_tokens": output_tokens,
    "cache_creation_input_tokens": cache_creation_input_tokens,
    "cache_read_input_tokens": cache_read_input_tokens,
    "total_tokens": total_tokens,
}
print(json.dumps(record))
PYEOF
)

if [ -z "$RECORD" ]; then
  exit 0
fi

: >> "$LOG_PATH"
if command -v flock >/dev/null 2>&1; then
  (
    flock -x 200
    printf '%s\n' "$RECORD" >> "$LOG_PATH"
  ) 200>>"$LOG_PATH.lock"
else
  # flock not installed: rely on POSIX PIPE_BUF/O_APPEND atomicity. A single
  # write() under PIPE_BUF (record is well under the 512-byte guaranteed
  # minimum) to an O_APPEND-opened file (>>) never interleaves with a
  # concurrent writer's write(), so the append stays a safe fallback.
  printf '%s\n' "$RECORD" >> "$LOG_PATH"
fi

exit 0
