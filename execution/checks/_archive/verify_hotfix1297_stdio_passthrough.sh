#!/usr/bin/env bash
# GH #1297 — the wrapped command's own stdout AND stderr must still reach the
# caller, on their respective streams, unswallowed and unmixed by the
# heartbeat wrapper.
#
# Uses FILE redirection (not `$(...)` command substitution) to capture
# output. Command substitution creates a pipe that only returns once every
# process holding the write end (including any orphaned heartbeat-loop
# child) closes it — if the wrapper leaks an orphaned sleep process (see
# verify_hotfix1297_clean_teardown.sh), a `$(...)`-based check would hang
# indefinitely instead of failing fast. File redirection has no such
# dependency: the invoking shell returns as soon as its direct child exits.
set -uo pipefail
REPO_ROOT="${1:?usage: verify_hotfix1297_stdio_passthrough.sh <repo_root>}"
WRAPPER="$REPO_ROOT/execution/heartbeat_wrap.sh"

if [ ! -x "$WRAPPER" ]; then
  echo "FAIL: $WRAPPER missing or not executable"
  exit 1
fi

OUTFILE=$(mktemp)
ERRFILE=$(mktemp)
trap 'rm -f "$OUTFILE" "$ERRFILE"' EXIT

HEARTBEAT_INTERVAL=1000 "$WRAPPER" sh -c 'echo OUT_MARK_1297; echo ERR_MARK_1297 >&2' >"$OUTFILE" 2>"$ERRFILE"

FAIL=0

if ! grep -q "OUT_MARK_1297" "$OUTFILE"; then
  echo "FAIL: wrapped command's stdout was swallowed (OUT_MARK_1297 missing)"
  FAIL=1
else
  echo "PASS: stdout passthrough confirmed"
fi

if grep -q "ERR_MARK_1297" "$OUTFILE"; then
  echo "FAIL: stderr marker leaked onto stdout — streams incorrectly merged"
  FAIL=1
fi

if ! grep -q "ERR_MARK_1297" "$ERRFILE"; then
  echo "FAIL: wrapped command's stderr was swallowed (ERR_MARK_1297 missing)"
  FAIL=1
else
  echo "PASS: stderr passthrough confirmed"
fi

exit $FAIL
