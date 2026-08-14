#!/usr/bin/env bash
# heartbeat_wrap.sh — GH #1297
#
# Claude Code's own subagent stream-watchdog reaps a subagent after ~600s of
# no token-stream progress. It false-positives on long, silent-but-alive
# commands (Rust release builds, xcodebuild, etc.) that produce no output for
# minutes at a time even though they are making real progress. This wrapper
# backgrounds a periodic heartbeat line on stdout so the token stream never
# goes fully dark, while passing the wrapped command's real stdout/stderr and
# exit code through untouched.
#
# Usage:
#   HEARTBEAT_INTERVAL=30 execution/heartbeat_wrap.sh <command> [args...]
#
# Portability: this harness runs on macOS (BSD userland). Deliberately avoids
# GNU-only coreutils (e.g. `timeout`/`gtimeout`), which are not guaranteed
# present on macOS.
set -uo pipefail

# NOTE on the orphan-sleep bug: a plain `kill "$hb_pid"` only signals the
# backgrounding subshell below, NOT the `sleep` process it forks each loop
# iteration — that `sleep` can be reparented to PID 1 and keep running
# silently for up to the full interval instead of dying with the wrapper.
#
# Job control (`set -m` + killing the negative pgid) is the textbook fix,
# but it depends on a controlling terminal to actually place the
# background job in its own process group. This wrapper normally runs
# headless inside an agent harness with no controlling tty, where `set -m`
# is a silent no-op — the "fix" would leave the process-group kill
# targeting nothing, and the wrapped command itself can hang waiting to be
# handed a terminal that doesn't exist. So instead we track and kill the
# `sleep` child directly by PID, which works with or without a tty.
readonly HEARTBEAT_INTERVAL="${HEARTBEAT_INTERVAL:-30}"

if [ "$#" -eq 0 ]; then
  echo "usage: HEARTBEAT_INTERVAL=<seconds> $0 <command> [args...]" >&2
  exit 2
fi

(
  while true; do
    sleep "$HEARTBEAT_INTERVAL" &
    sleep_pid=$!
    wait "$sleep_pid" 2>/dev/null || exit 0
    printf '⏳ [heartbeat] still running (%ss elapsed, no output is normal for builds)\n' "$SECONDS"
  done
) &
hb_pid=$!

cleanup() {
  # Kill the currently in-flight `sleep` child directly (found by parent
  # PID, not by process group — no tty/job-control dependency), then the
  # loop subshell itself, so nothing orphans.
  pkill -P "$hb_pid" 2>/dev/null
  kill "$hb_pid" 2>/dev/null
  wait "$hb_pid" 2>/dev/null
  return 0
}

on_signal() {
  trap - EXIT INT TERM
  cleanup
  exit 130
}

trap cleanup EXIT
trap on_signal INT TERM

# Run the real command in the foreground via "$@" (never "$*", which would
# word-split/reflatten quoted args), streaming its own stdout/stderr on
# their correct file descriptors.
"$@"
rc=$?

exit "$rc"
