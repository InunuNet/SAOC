#!/usr/bin/env bash
# GH #1297 — wrapping a command that itself emits output frequently must not
# hang, double-buffer, truncate, or duplicate lines. Wraps `seq 1 500` (500
# lines, fast) with a 1s heartbeat interval and enforces a hard wall-clock
# timeout via a manual watchdog (no dependency on GNU coreutils `timeout`,
# which is not guaranteed present on macOS).
set -uo pipefail
REPO_ROOT="${1:?usage: verify_hotfix1297_frequent_output_no_hang.sh <repo_root>}"
WRAPPER="$REPO_ROOT/execution/heartbeat_wrap.sh"
TIMEOUT_SECS=15

if [ ! -x "$WRAPPER" ]; then
  echo "FAIL: $WRAPPER missing or not executable"
  exit 1
fi

OUT=$(mktemp)
trap 'rm -f "$OUT"' EXIT

HEARTBEAT_INTERVAL=1 "$WRAPPER" seq 1 500 > "$OUT" 2>&1 &
WPID=$!

ELAPSED=0
while kill -0 "$WPID" 2>/dev/null; do
  if [ "$ELAPSED" -ge "$TIMEOUT_SECS" ]; then
    kill -9 "$WPID" 2>/dev/null
    echo "FAIL: wrapper hung wrapping a frequent-output command (>${TIMEOUT_SECS}s)"
    exit 1
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done
wait "$WPID"
RC=$?

if [ "$RC" -ne 0 ]; then
  echo "FAIL: wrapper around 'seq 1 500' exited nonzero (rc=$RC)"
  exit 1
fi

LINES=$(grep -Ev '^[[:space:]]*$' "$OUT" | grep -vic "heartbeat" | tr -d ' ')
UNIQUE=$(grep -Ev '^[[:space:]]*$' "$OUT" | grep -vi "heartbeat" | sort -n -u | wc -l | tr -d ' ')
FIRST=$(grep -Ev '^[[:space:]]*$' "$OUT" | grep -vi "heartbeat" | sort -n | head -1)
LAST=$(grep -Ev '^[[:space:]]*$' "$OUT" | grep -vi "heartbeat" | sort -n | tail -1)

FAIL=0
if [ "$LINES" -ne 500 ]; then
  echo "FAIL: expected exactly 500 non-heartbeat lines, got $LINES (possible truncation/duplication)"
  FAIL=1
fi
if [ "$UNIQUE" -ne 500 ]; then
  echo "FAIL: expected 500 unique values, got $UNIQUE unique (possible duplication)"
  FAIL=1
fi
if [ "$FIRST" != "1" ] || [ "$LAST" != "500" ]; then
  echo "FAIL: expected range 1..500, got first=$FIRST last=$LAST"
  FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
  echo "PASS: 500/500 lines intact, no hang, no duplication, completed in <=${ELAPSED}s"
fi

exit $FAIL
