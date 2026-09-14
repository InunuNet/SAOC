#!/usr/bin/env bash
# GH #1297 — heartbeat lines MUST be emitted to stdout while the wrapped
# command is silent. Wraps `sleep 3` (produces zero output of its own) with a
# 1s heartbeat interval and requires >=2 heartbeat lines in the captured
# stdout. See goldens/heartbeat-marker-spec.md for the marker contract.
set -euo pipefail
REPO_ROOT="${1:?usage: verify_hotfix1297_heartbeat_emitted.sh <repo_root>}"
WRAPPER="$REPO_ROOT/execution/heartbeat_wrap.sh"

if [ ! -x "$WRAPPER" ]; then
  echo "FAIL: $WRAPPER missing or not executable"
  exit 1
fi

OUT=$(mktemp)
trap 'rm -f "$OUT"' EXIT

HEARTBEAT_INTERVAL=1 "$WRAPPER" sleep 3 > "$OUT" 2>&1
RC=$?

COUNT=$(grep -ic "heartbeat" "$OUT" || true)

if [ "$RC" -ne 0 ]; then
  echo "FAIL: wrapper around silent 'sleep 3' exited nonzero (rc=$RC)"
  cat "$OUT"
  exit 1
fi

if [ "$COUNT" -lt 2 ]; then
  echo "FAIL: expected >=2 heartbeat lines during a 3s silent sleep at 1s interval, got $COUNT"
  cat "$OUT"
  exit 1
fi

echo "PASS: $COUNT heartbeat line(s) emitted during silent command"
