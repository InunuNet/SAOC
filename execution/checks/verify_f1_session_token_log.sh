#!/usr/bin/env bash
# QA verification harness for F1 (token-accounting-hardening).
# One subcommand per contract-f1.yaml assertion A1-A4, A6, A7 (A5 is a static
# grep, A8 is a python one-liner already inline in the contract).
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$REPO_ROOT/execution/hooks/session_token_log.sh"
SUBAGENT_HOOK="$REPO_ROOT/execution/hooks/subagent_start.sh"
GOLDENS="$REPO_ROOT/.agent/memory/project/specs/token-accounting-hardening/goldens"
TRANSCRIPT="$GOLDENS/f1_transcript_fixture.jsonl"
DISPATCH_FIXTURE="$GOLDENS/f1_dispatch_events_fixture.jsonl"

SUBCMD="${1:-}"

WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }

run_hook() {
  # run_hook <session_id> <transcript_path> <log_path> <dispatch_path>
  local sid="$1" transcript="$2" log="$3" dispatch="$4"
  local stdin
  stdin=$(python3 -c "import json,sys; print(json.dumps({'session_id': sys.argv[1], 'transcript_path': sys.argv[2], 'reason': 'exit'}))" "$sid" "$transcript")
  printf '%s' "$stdin" | ATHANOR_SESSION_TOKEN_LOG_PATH="$log" ATHANOR_DISPATCH_EVENTS_PATH="$dispatch" bash "$HOOK"
  echo $?
}

case "$SUBCMD" in

  golden_record_matches)
    LOG="$WORK/session_usage.jsonl"
    : > "$LOG"
    EXIT_CODE=$(run_hook "sess-fixture-001" "$TRANSCRIPT" "$LOG" "$DISPATCH_FIXTURE" | tail -1)
    [ "$EXIT_CODE" = "0" ] || fail "hook exited $EXIT_CODE, expected 0"
    [ -s "$LOG" ] || fail "no line written to output log"
    LINES=$(wc -l < "$LOG" | tr -d ' ')
    [ "$LINES" = "1" ] || fail "expected exactly 1 line, got $LINES"

    python3 - "$LOG" <<'PYEOF' || exit 1
import json, re, sys
with open(sys.argv[1]) as f:
    rec = json.loads(f.readline())

expected = {
    "session_id": "sess-fixture-001",
    "model": "claude-opus-5",
    "agent_dispatch_count": 4,
    "input_tokens": 4500,
    "output_tokens": 2500,
    "cache_creation_input_tokens": 3000,
    "cache_read_input_tokens": 3000,
    "total_tokens": 13000,
}
for k, v in expected.items():
    if rec.get(k) != v:
        print(f"FAIL: field {k} = {rec.get(k)!r}, expected {v!r}", file=sys.stderr)
        sys.exit(1)

ts = rec.get("ts", "")
if not re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$", ts):
    print(f"FAIL: ts {ts!r} does not match expected ISO8601 pattern", file=sys.stderr)
    sys.exit(1)
PYEOF
    echo "PASS"
    ;;

  no_crash_on_non_usage_lines)
    LOG="$WORK/session_usage.jsonl"
    : > "$LOG"
    STDIN=$(python3 -c "import json; print(json.dumps({'session_id':'sess-fixture-001','transcript_path':'$TRANSCRIPT','reason':'exit'}))")
    STDERR_OUT=$(printf '%s' "$STDIN" | ATHANOR_SESSION_TOKEN_LOG_PATH="$LOG" ATHANOR_DISPATCH_EVENTS_PATH="$DISPATCH_FIXTURE" bash "$HOOK" 2>&1 >/dev/null)
    EXIT_CODE=$?
    [ "$EXIT_CODE" = "0" ] || fail "hook exited $EXIT_CODE against fixture with embedded summary line"
    if printf '%s' "$STDERR_OUT" | grep -qi "traceback"; then
      fail "stderr contained a traceback: $STDERR_OUT"
    fi
    echo "PASS"
    ;;

  dispatch_count_isolated_by_session)
    LOG="$WORK/session_usage.jsonl"
    : > "$LOG"
    run_hook "sess-other-999" "$TRANSCRIPT" "$LOG" "$DISPATCH_FIXTURE" >/dev/null
    [ -s "$LOG" ] || fail "no record written for sess-other-999"
    COUNT=$(python3 -c "import json; print(json.load(open('$LOG')).get('agent_dispatch_count'))" 2>/dev/null || python3 -c "
import json
with open('$LOG') as f:
    rec = json.loads(f.readline())
print(rec.get('agent_dispatch_count'))
")
    [ "$COUNT" = "2" ] || fail "agent_dispatch_count for sess-other-999 = $COUNT, expected 2"
    echo "PASS"
    ;;

  graceful_degradation_no_record)
    # Sub-case 1: transcript_path missing/nonexistent
    LOG="$WORK/log1.jsonl"
    : > "$LOG"
    STDIN=$(python3 -c "import json; print(json.dumps({'session_id':'sess-x','transcript_path':'$WORK/does-not-exist.jsonl','reason':'exit'}))")
    printf '%s' "$STDIN" | ATHANOR_SESSION_TOKEN_LOG_PATH="$LOG" ATHANOR_DISPATCH_EVENTS_PATH="$DISPATCH_FIXTURE" bash "$HOOK"
    EXIT_CODE=$?
    [ "$EXIT_CODE" = "0" ] || fail "sub-case missing-transcript: exit $EXIT_CODE, expected 0"
    [ ! -s "$LOG" ] || fail "sub-case missing-transcript: log has content, expected zero new lines"

    # Sub-case 2: transcript_path points at an empty file
    LOG="$WORK/log2.jsonl"
    : > "$LOG"
    EMPTY_TRANSCRIPT="$WORK/empty_transcript.jsonl"
    : > "$EMPTY_TRANSCRIPT"
    STDIN=$(python3 -c "import json; print(json.dumps({'session_id':'sess-x','transcript_path':'$EMPTY_TRANSCRIPT','reason':'exit'}))")
    printf '%s' "$STDIN" | ATHANOR_SESSION_TOKEN_LOG_PATH="$LOG" ATHANOR_DISPATCH_EVENTS_PATH="$DISPATCH_FIXTURE" bash "$HOOK"
    EXIT_CODE=$?
    [ "$EXIT_CODE" = "0" ] || fail "sub-case empty-transcript: exit $EXIT_CODE, expected 0"
    [ ! -s "$LOG" ] || fail "sub-case empty-transcript: log has content, expected zero new lines"

    # Sub-case 3: stdin with no session_id
    LOG="$WORK/log3.jsonl"
    : > "$LOG"
    STDIN=$(python3 -c "import json; print(json.dumps({'transcript_path':'$TRANSCRIPT','reason':'exit'}))")
    printf '%s' "$STDIN" | ATHANOR_SESSION_TOKEN_LOG_PATH="$LOG" ATHANOR_DISPATCH_EVENTS_PATH="$DISPATCH_FIXTURE" bash "$HOOK"
    EXIT_CODE=$?
    [ "$EXIT_CODE" = "0" ] || fail "sub-case no-session-id: exit $EXIT_CODE, expected 0"
    [ ! -s "$LOG" ] || fail "sub-case no-session-id: log has content, expected zero new lines"

    echo "PASS"
    ;;

  default_log_path_outside_scratch)
    DEFAULT_LINE=$(grep -n 'DEFAULT_LOG=' "$HOOK" | grep -v DISPATCH)
    [ -n "$DEFAULT_LINE" ] || fail "could not find DEFAULT_LOG= assignment in $HOOK"
    if printf '%s' "$DEFAULT_LINE" | grep -q '/scratch/'; then
      fail "default output log path contains /scratch/: $DEFAULT_LINE"
    fi
    echo "PASS"
    ;;

  append_only_no_truncation)
    LOG="$WORK/session_usage.jsonl"
    : > "$LOG"
    run_hook "sess-fixture-001" "$TRANSCRIPT" "$LOG" "$DISPATCH_FIXTURE" >/dev/null
    run_hook "sess-fixture-001" "$TRANSCRIPT" "$LOG" "$DISPATCH_FIXTURE" >/dev/null
    LINES=$(wc -l < "$LOG" | tr -d ' ')
    [ "$LINES" = "2" ] || fail "expected 2 lines after 2 runs, got $LINES"
    python3 - "$LOG" <<'PYEOF' || exit 1
import json, sys
with open(sys.argv[1]) as f:
    lines = [l for l in f if l.strip()]
if len(lines) != 2:
    print(f"FAIL: expected 2 non-empty lines, got {len(lines)}", file=sys.stderr)
    sys.exit(1)
expected = {
    "session_id": "sess-fixture-001",
    "model": "claude-opus-5",
    "agent_dispatch_count": 4,
    "input_tokens": 4500,
    "output_tokens": 2500,
    "cache_creation_input_tokens": 3000,
    "cache_read_input_tokens": 3000,
    "total_tokens": 13000,
}
for i, line in enumerate(lines):
    try:
        rec = json.loads(line)
    except Exception as e:
        print(f"FAIL: line {i} is not valid JSON: {e}", file=sys.stderr)
        sys.exit(1)
    for k, v in expected.items():
        if rec.get(k) != v:
            print(f"FAIL: line {i} field {k} = {rec.get(k)!r}, expected {v!r}", file=sys.stderr)
            sys.exit(1)
PYEOF
    echo "PASS"
    ;;

  subagent_start_appends_dispatch_event)
    DISPATCH="$WORK/dispatch_probe.jsonl"
    : > "$DISPATCH"
    STDIN='{"session_id":"sess-probe-1","agent_type":"dev"}'
    OUT=$(printf '%s' "$STDIN" | ATHANOR_DISPATCH_EVENTS_PATH="$DISPATCH" bash "$SUBAGENT_HOOK")
    EXIT_CODE=$?
    [ "$EXIT_CODE" = "0" ] || fail "subagent_start.sh exited $EXIT_CODE, expected 0"

    HOOK_EVENT_NAME=$(printf '%s' "$OUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('hookSpecificOutput',{}).get('hookEventName',''))" 2>/dev/null)
    [ "$HOOK_EVENT_NAME" = "SubagentStart" ] || fail "stdout hookEventName = '$HOOK_EVENT_NAME', expected 'SubagentStart' (stdout was: $OUT)"

    [ -s "$DISPATCH" ] || fail "no line appended to dispatch-events log"
    LINES=$(wc -l < "$DISPATCH" | tr -d ' ')
    [ "$LINES" = "1" ] || fail "expected exactly 1 new dispatch-event line, got $LINES"
    python3 - "$DISPATCH" <<'PYEOF' || exit 1
import json, sys
with open(sys.argv[1]) as f:
    rec = json.loads(f.readline())
if rec.get("session_id") != "sess-probe-1":
    print(f"FAIL: session_id = {rec.get('session_id')!r}, expected 'sess-probe-1'", file=sys.stderr)
    sys.exit(1)
if rec.get("agent_type") != "dev":
    print(f"FAIL: agent_type = {rec.get('agent_type')!r}, expected 'dev'", file=sys.stderr)
    sys.exit(1)
PYEOF
    echo "PASS"
    ;;

  *)
    echo "Usage: $0 {golden_record_matches|no_crash_on_non_usage_lines|dispatch_count_isolated_by_session|graceful_degradation_no_record|default_log_path_outside_scratch|append_only_no_truncation|subagent_start_appends_dispatch_event}" >&2
    exit 2
    ;;
esac
