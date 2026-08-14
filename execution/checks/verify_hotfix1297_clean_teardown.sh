#!/usr/bin/env bash
# GH #1297 — after the wrapper exits (success path), NO heartbeat background
# process may remain alive. An orphaned heartbeat loop leaking on every build
# invocation would be a real, compounding bug. Tracks the wrapper's process
# group (pgid) and asserts nothing in that pgid survives past a grace period.
#
# Deliberately uses a LONG interval with a FAST wrapped command so the
# heartbeat loop's own `sleep $interval` is still in-flight (mid-syscall)
# at kill time. This is the adversarial case: a naive `kill "$hb_pid"` only
# signals the backgrounding subshell — if `sleep` runs as an external child
# of that subshell (common on macOS/bash), the subshell can die while the
# still-running `sleep` child is silently orphaned/reparented and keeps
# running (and keeps stdout/stderr pipes open) until it finishes on its
# own. A short interval masks this bug because the sleep would finish on
# its own before anyone checks. Correct teardown must kill the whole
# process group / actual sleep child, not just the subshell PID.
set -uo pipefail
set -m  # enable job control so the backgrounded wrapper gets its OWN process group
REPO_ROOT="${1:?usage: verify_hotfix1297_clean_teardown.sh <repo_root>}"
WRAPPER="$REPO_ROOT/execution/heartbeat_wrap.sh"

if [ ! -x "$WRAPPER" ]; then
  echo "FAIL: $WRAPPER missing or not executable"
  exit 1
fi

BASELINE=$(pgrep -f "heartbeat_wrap.sh" 2>/dev/null | wc -l | tr -d ' ')
if [ "$BASELINE" -ne 0 ]; then
  echo "FAIL: test precondition violated — heartbeat_wrap.sh already running before test ($BASELINE procs)"
  exit 1
fi

HEARTBEAT_INTERVAL=1000 "$WRAPPER" sh -c "echo hi" >/dev/null 2>&1 &
WPID=$!
PGID=$(ps -o pgid= -p "$WPID" 2>/dev/null | tr -d ' ')

wait "$WPID"
RC=$?

# Grace period for trap-based cleanup to finish reaping the heartbeat loop.
sleep 1

FAIL=0

if [ -n "$PGID" ]; then
  REMAINING=$(pgrep -g "$PGID" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$REMAINING" -gt 0 ]; then
    echo "FAIL: $REMAINING process(es) remain in wrapper's process group $PGID after exit (rc=$RC)"
    ps -o pid,ppid,pgid,command -g "$PGID" 2>/dev/null
    FAIL=1
  fi
fi

LEFTOVER=$(pgrep -f "heartbeat_wrap.sh" 2>/dev/null | wc -l | tr -d ' ')
if [ "$LEFTOVER" -gt 0 ]; then
  echo "FAIL: $LEFTOVER heartbeat_wrap.sh-matching process(es) still alive after wrapper exit"
  pgrep -fl "heartbeat_wrap.sh" 2>/dev/null
  FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
  echo "PASS: no orphaned heartbeat process after wrapper exit"
fi

exit $FAIL
