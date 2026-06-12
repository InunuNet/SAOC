#!/usr/bin/env bash
# claude-loop.sh — Mission-aware autonomous Claude Code session loop.
# First turn: claude -p CLAUDE_LOOP_PROMPT (if set); subsequent: claude -c.
# Handles quota (exit 3 -> sleep), INT/TERM signals, mission done/BLOCKED.
#
# Env vars:
#   CLAUDE_LOOP_MAX          Max turns (0 = unlimited, default 0)
#   CLAUDE_LOOP_QUOTA_SLEEP  Seconds to sleep on quota exhaustion (default 10800)
#   CLAUDE_LOOP_PROMPT       Prompt for first turn (optional; if unset, uses -c from turn 0)

CLAUDE_LOOP_MAX=${CLAUDE_LOOP_MAX:-0}
CLAUDE_LOOP_QUOTA_SLEEP=${CLAUDE_LOOP_QUOTA_SLEEP:-10800}

# Parse --max N and --dry-run flags; remaining args forwarded to claude
while [ $# -gt 0 ]; do
    case "$1" in
        --max) CLAUDE_LOOP_MAX="$2"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        --) shift; break ;;
        *) break ;;
    esac
done

_log() { printf 'claude-loop: %s\n' "$*" >&2; }
DRY_RUN=${DRY_RUN:-false}

_child_pid=""
_shutdown() {
    _log "shutting down"
    if [ -n "$_child_pid" ]; then
        kill "$_child_pid" 2>/dev/null
    fi
    exit 0
}
trap _shutdown INT TERM

_get_mission_status() {
    local ACTIVE_PATH
    ACTIVE_PATH=$(python3 -c "
import json, pathlib
p = pathlib.Path('.agent/memory/project/missions/active.json')
if p.exists():
    d = json.loads(p.read_text())
    print(d.get('mission') or 'null')
else:
    print('null')
" 2>/dev/null || echo "null")
    if [[ "$ACTIVE_PATH" == "null" || -z "$ACTIVE_PATH" ]]; then
        echo "no active mission"
        return
    fi
    python3 execution/mission.py status "$ACTIVE_PATH" --json 2>/dev/null \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null \
        || echo "unknown"
}

_count=0
while true; do
    # Check mission status before each turn
    _status=$(_get_mission_status 2>/dev/null || echo "unknown")
    case "$_status" in
        completed|done|close_out|paused|abandoned|"mission complete"|"no active mission")
            _log "mission complete — exiting"
            exit 0
            ;;
        *BLOCKED*)
            _log "mission BLOCKED — human intervention required"
            exit 2
            ;;
    esac

    # First turn with prompt, subsequent turns continue session
    if [[ $_count -eq 0 && -n "${CLAUDE_LOOP_PROMPT:-}" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            _log "DRY-RUN: would run claude -p '${CLAUDE_LOOP_PROMPT:0:60}...' --dangerously-skip-permissions"
        else
            claude -p "$CLAUDE_LOOP_PROMPT" --dangerously-skip-permissions "$@" &
        fi
    else
        if [[ "$DRY_RUN" == "true" ]]; then
            _log "DRY-RUN: would run claude -c --dangerously-skip-permissions (turn $((_count+1)))"
        else
            claude -c --dangerously-skip-permissions "$@" &
        fi
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        _count=$((_count + 1))
        if [ "$CLAUDE_LOOP_MAX" -gt 0 ] && [ "$_count" -ge "$CLAUDE_LOOP_MAX" ]; then
            _log "max turns (${CLAUDE_LOOP_MAX}) reached — exiting"
            exit 0
        elif [ "$CLAUDE_LOOP_MAX" -eq 0 ]; then
            _log "DRY-RUN: use --max N to limit iterations (defaulting to 3 in dry-run)"
            if [ "$_count" -ge 3 ]; then exit 0; fi
        fi
        sleep 0.1
        continue
    fi

    _child_pid=$!
    wait "$_child_pid"
    _exit=$?
    _child_pid=""

    case $_exit in
        0)
            _count=$((_count + 1))
            _log "session ended (turn #${_count})"
            ;;
        3)
            _log "quota exhausted — sleeping ${CLAUDE_LOOP_QUOTA_SLEEP}s"
            sleep "$CLAUDE_LOOP_QUOTA_SLEEP"
            _count=$((_count + 1))
            ;;
        *)
            _log "exit ${_exit} — retrying in 5s"
            sleep 5
            _count=$((_count + 1))
            ;;
    esac

    if [ "$CLAUDE_LOOP_MAX" -gt 0 ] && [ "$_count" -ge "$CLAUDE_LOOP_MAX" ]; then
        _log "max turns (${CLAUDE_LOOP_MAX}) reached — exiting"
        exit 0
    fi
done
