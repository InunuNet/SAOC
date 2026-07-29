#!/usr/bin/env bash
# Shared start/stop helper for the m2-next16-upgrade rendered-output batteries.
# All server-dependent assertions in the contract run against the SAME dev
# server instance (started once by the "start" assertion, torn down by the
# "stop" assertion) instead of paying a ~15-20s cold-start cost per assertion
# for 62 routes. Assertions in between must run in contract-declared order —
# contract.py's gate executes phase assertions sequentially in file order.
#
# CONSTRAINT: never run `pnpm build` while this server is up — they share
# `.next` and a concurrent build corrupts the dev server's asset manifest.
# The contract sequences the build assertion(s) before "start" and never
# after it, until "stop" has run.
set -euo pipefail

PORT=3333
PIDFILE=/tmp/saoc-m2-server.pid
LOGFILE=/tmp/saoc-m2-server.log

start() {
  # Refuse to start if a build is plausibly in-flight (best-effort guard).
  if pgrep -f "next build" >/dev/null 2>&1; then
    echo "REFUSING to start dev server: a 'next build' process is currently running" >&2
    exit 1
  fi
  # Clean up any stray server on the port from a prior aborted run.
  lsof -ti:"$PORT" | xargs -r kill -9 2>/dev/null || true
  sleep 1
  rm -f "$LOGFILE"
  cd "$(git rev-parse --show-toplevel)"
  # nohup + disown + redirected stdin: each contract assertion runs in its
  # own short-lived subprocess (this tool's Bash invocations are not a
  # persistent shell), so a plain `cmd &` backgrounds the server as a child
  # of that subprocess and it dies with it. nohup+disown detaches it fully
  # so it survives past this command returning, for A15-A18 to hit.
  nohup npx next dev --port "$PORT" >"$LOGFILE" 2>&1 </dev/null &
  disown
  echo $! >"$PIDFILE"
  CODE=000
  for _ in $(seq 1 60); do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" 2>/dev/null) || true; CODE=${CODE:-000}
    if [ "$CODE" != "000" ]; then break; fi
    sleep 1
  done
  if [ "$CODE" = "000" ]; then
    echo "dev server on port $PORT never came up within 60s" >&2
    cat "$LOGFILE" >&2
    exit 1
  fi
  echo "dev server up on port $PORT (http $CODE), pid $(cat "$PIDFILE")"
}

status() {
  if [ ! -f "$PIDFILE" ]; then
    echo "no PIDFILE — server not started by this harness" >&2
    exit 1
  fi
  PID=$(cat "$PIDFILE")
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "server process $PID is not running (crashed?) — see $LOGFILE" >&2
    tail -n 80 "$LOGFILE" >&2 || true
    exit 1
  fi
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" 2>/dev/null) || true; CODE=${CODE:-000}
  if [ "$CODE" = "000" ]; then
    echo "server process $PID is alive but port $PORT is not answering" >&2
    exit 1
  fi
  echo "server alive: pid $PID, http $CODE"
}

stop() {
  if [ -f "$PIDFILE" ]; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE"
  fi
  lsof -ti:"$PORT" | xargs -r kill -9 2>/dev/null || true
  echo "dev server on port $PORT stopped"
}

case "${1:-}" in
  start) start ;;
  status) status ;;
  stop) stop ;;
  *) echo "usage: server-ctl.sh {start|status|stop}" >&2; exit 2 ;;
esac
