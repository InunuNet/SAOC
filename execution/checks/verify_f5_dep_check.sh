#!/usr/bin/env bash
# F5 behavioral check — startup dependency stop condition.
# Exit 0 iff an autonomous (no-TTY) run with a missing dep exits 1 and names the dep.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNNER="$ROOT/execution/pulse_runner.sh"

if [ ! -f "$RUNNER" ]; then
  echo "FAIL: $RUNNER not found"
  exit 1
fi

# stdin = /dev/null => not a TTY => autonomous-run guard must fire.
OUT="$(cd "$ROOT" && ATHANOR_REQUIRED_DEPS="__missing_dep__" bash execution/pulse_runner.sh </dev/null 2>&1)"
RC=$?

if [ "$RC" -ne 1 ]; then
  echo "FAIL: expected exit 1 for missing dep + no TTY, got $RC"
  echo "--- output ---"
  echo "$OUT"
  exit 1
fi

if ! printf '%s' "$OUT" | grep -q "__missing_dep__"; then
  echo "FAIL: output should name the missing dep (__missing_dep__)"
  echo "--- output ---"
  echo "$OUT"
  exit 1
fi

echo "PASS: F5 dependency stop condition"
exit 0
