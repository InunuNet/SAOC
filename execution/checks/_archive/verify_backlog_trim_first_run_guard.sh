#!/usr/bin/env bash
# verify_backlog_trim_first_run_guard.sh — contract-f2 assertion A7.
#
# Synthesizes a header-less backlog.md with 60 open items and MAX_OPEN=50
# (default): first run must truncate zero items and print the first-run
# notice. A second run against the now-headered output must then truncate
# down to exactly 50 (guard is one-shot, not permanent).
#
# Exit codes:
#   0 — both invariants held
#   1 — either invariant violated

set -uo pipefail

SRC="$(pwd)"

TMP=""
cleanup() { [ -n "$TMP" ] && rm -rf "$TMP"; }
trap cleanup EXIT INT TERM
TMP="$(mktemp -d)"

BACKLOG="${TMP}/backlog.md"
{
  echo "# Backlog"
  echo ""
  for i in $(seq 1 60); do
    echo "- [ ] synthetic item number ${i}"
  done
} > "$BACKLOG"

# --- First run: no header, 60 open items, MAX_OPEN=50 ---
FIRST_OUT=$(BACKLOG_TRIM_PATH="$BACKLOG" BACKLOG_TRIM_DATA_DIR="${TMP}/data" \
  python3 "${SRC}/execution/backlog_trim.py" 2>&1) || {
    echo "FAIL: backlog_trim.py exited non-zero on first (header-less) run" >&2
    echo "$FIRST_OUT" >&2
    exit 1
  }

FIRST_OPEN=$(grep -c '^- \[ \]' "$BACKLOG" || true)
if [ "$FIRST_OPEN" -ne 60 ]; then
  echo "FAIL: first run truncated items — expected 60 open, got ${FIRST_OPEN}" >&2
  exit 1
fi

if ! printf '%s' "$FIRST_OUT" | grep -q "first trim run"; then
  echo "FAIL: first-run notice not printed" >&2
  echo "$FIRST_OUT" >&2
  exit 1
fi

if ! grep -q '^_Last compacted:' "$BACKLOG"; then
  echo "FAIL: header not stamped after first run" >&2
  exit 1
fi

# --- Second run: header now present, still 60 open items, MAX_OPEN=50 ---
SECOND_OUT=$(BACKLOG_TRIM_PATH="$BACKLOG" BACKLOG_TRIM_DATA_DIR="${TMP}/data" \
  python3 "${SRC}/execution/backlog_trim.py" 2>&1) || {
    echo "FAIL: backlog_trim.py exited non-zero on second (headered) run" >&2
    echo "$SECOND_OUT" >&2
    exit 1
  }

SECOND_OPEN=$(grep -c '^- \[ \]' "$BACKLOG" || true)
if [ "$SECOND_OPEN" -ne 50 ]; then
  echo "FAIL: second run did not truncate to 50 — got ${SECOND_OPEN}" >&2
  exit 1
fi

if ! grep -q '^> Truncated' "$BACKLOG"; then
  echo "FAIL: truncation marker missing after second (headered) run" >&2
  exit 1
fi

echo "OK: first run untouched (60 open, notice printed), second run truncated to 50"
exit 0
