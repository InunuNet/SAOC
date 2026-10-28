#!/usr/bin/env bash
# Start `next start` on the gate port, pidfile .tmp/sandbox/nos-anchor-landings-run/serve.pid, wait for ready. Stop: serve.sh stop (exact PID only).
set -euo pipefail
RUN=".tmp/sandbox/nos-anchor-landings-run"; mkdir -p "$RUN"
if [ "${1:-}" = "stop" ]; then [ -f "$RUN/serve.pid" ] && kill "$(cat "$RUN/serve.pid")" 2>/dev/null || true; exit 0; fi
. .agent/memory/project/specs/nos-anchor-landings/checks/env.sh
export SANITY_FIXTURE_LOGDIR="$PWD/$RUN/fixture-logs"
node node_modules/next/dist/bin/next start --port "$PORT" > "$RUN/serve.log" 2>&1 &
echo $! > "$RUN/serve.pid"
for i in $(seq 1 60); do curl -s -o /dev/null "http://nos.localhost:${PORT}/national-show/faq" && { echo "serving :$PORT"; exit 0; }; sleep 1; done
echo "server did not come up" >&2; exit 1
