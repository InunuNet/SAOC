#!/usr/bin/env bash
# update-fallback-silent regression: with gh unreachable, update_template.py must
# end on a NOT UPDATED line and exit 3, never report a stale re-apply as success.
set -u
SB=.tmp/sandbox/update-fallback-test
mkdir -p "$SB/bin"
PY="$(command -v python3)"
ln -sf "$PY" "$SB/bin/python3"
LOG="$SB/run.log"

PATH="$PWD/$SB/bin:/usr/bin:/bin" python3 execution/update_template.py --dry-run >"$LOG" 2>&1
rc=$?
last="$(tail -n 1 "$LOG")"
python3 execution/safe_delete.py "$SB" >/dev/null 2>&1

fail=0
[ "$rc" -eq 3 ] || { echo "FAIL: exit $rc, want 3"; fail=1; }
case "$last" in
  "NOT UPDATED:"*) ;;
  *) echo "FAIL: last line is not NOT UPDATED: $last"; fail=1 ;;
esac
case "$last" in
  *"--source"*) ;;
  *) echo "FAIL: NOT UPDATED line does not offer --source"; fail=1 ;;
esac
[ "$fail" -eq 0 ] && echo "PASS: gh-less run ends NOT UPDATED, exit 3"
exit "$fail"
