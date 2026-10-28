#!/usr/bin/env bash
# Rendered gate: starts the built site on the gate port, runs the vendored A13 survey at 8 widths (24 +/-2) and the chrome probe, always stops the server by exact PID.
set -uo pipefail
SPEC=".agent/memory/project/specs/nos-anchor-landings/checks"
bash "$SPEC/serve.sh" || exit 1
export NOS_BASE_URL="http://nos.localhost:${NOS_ANCHOR_PORT:-3961}"
node "$SPEC/run-a13-8w.mjs"; a=$?
node "$SPEC/probe-chrome.mjs"; b=$?
bash "$SPEC/serve.sh" stop
echo "a13=$a probe=$b"
[ "$a" -eq 0 ] && [ "$b" -eq 0 ]
