#!/usr/bin/env bash
# GH #1297 — the wrapper MUST propagate the wrapped command's real exit code,
# not just "0 vs nonzero". Tests success (0), the common failure code (1 via
# `false`), and an arbitrary non-1 code (7) to catch naive `$?`-swallowing or
# hardcoded exit(1)-on-failure bugs.
set -uo pipefail
REPO_ROOT="${1:?usage: verify_hotfix1297_exitcode_passthrough.sh <repo_root>}"
WRAPPER="$REPO_ROOT/execution/heartbeat_wrap.sh"

if [ ! -x "$WRAPPER" ]; then
  echo "FAIL: $WRAPPER missing or not executable"
  exit 1
fi

FAIL=0

HEARTBEAT_INTERVAL=1000 "$WRAPPER" true
RC=$?
if [ "$RC" -ne 0 ]; then
  echo "FAIL: success case — expected rc=0, got rc=$RC"
  FAIL=1
else
  echo "PASS: success case rc=0"
fi

HEARTBEAT_INTERVAL=1000 "$WRAPPER" false
RC=$?
if [ "$RC" -ne 1 ]; then
  echo "FAIL: failure case ('false') — expected rc=1, got rc=$RC"
  FAIL=1
else
  echo "PASS: failure case rc=1"
fi

HEARTBEAT_INTERVAL=1000 "$WRAPPER" sh -c 'exit 7'
RC=$?
if [ "$RC" -ne 7 ]; then
  echo "FAIL: arbitrary exit code case — expected rc=7, got rc=$RC"
  FAIL=1
else
  echo "PASS: arbitrary exit code rc=7"
fi

exit $FAIL
