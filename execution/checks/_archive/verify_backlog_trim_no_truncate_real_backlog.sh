#!/usr/bin/env bash
# verify_backlog_trim_no_truncate_real_backlog.sh — contract-f2 assertion A6.
#
# Mission QA check #2: dry-run backlog_trim.py against a COPY of the real
# current backlog.md with the default MAX_OPEN=50. Athanor's real backlog has
# 47 open items (< 50) — must truncate zero items either way, but this proves
# it against the actual live file content, not a synthetic stand-in.
#
# Exit codes:
#   0 — zero open items were truncated
#   1 — truncation occurred (data-loss regression)

set -uo pipefail

SRC="$(pwd)"
REAL_BACKLOG="${SRC}/.agent/memory/project/backlog.md"

if [ ! -f "$REAL_BACKLOG" ]; then
  echo "FAIL: real backlog.md not found at ${REAL_BACKLOG}" >&2
  exit 1
fi

TMP=""
cleanup() { [ -n "$TMP" ] && rm -rf "$TMP"; }
trap cleanup EXIT INT TERM
TMP="$(mktemp -d)"

cp "$REAL_BACKLOG" "${TMP}/backlog.md"

BEFORE_OPEN=$(grep -c '^- \[ \]' "${TMP}/backlog.md" || true)

BACKLOG_TRIM_PATH="${TMP}/backlog.md" BACKLOG_TRIM_DATA_DIR="${TMP}/data" \
  python3 "${SRC}/execution/backlog_trim.py" >/dev/null 2>&1 || {
    echo "FAIL: backlog_trim.py exited non-zero against real backlog copy" >&2
    exit 1
  }

AFTER_OPEN=$(grep -c '^- \[ \]' "${TMP}/backlog.md" || true)

if grep -q '^> Truncated' "${TMP}/backlog.md"; then
  echo "FAIL: truncation marker present — real backlog was truncated" >&2
  exit 1
fi

if [ "$AFTER_OPEN" -lt "$BEFORE_OPEN" ]; then
  echo "FAIL: open item count dropped from closed-item removal alone would be expected, but check truncation: before=${BEFORE_OPEN} after=${AFTER_OPEN}" >&2
  # closed [x] items being removed doesn't reduce open [ ] count, so any drop here is truncation
  exit 1
fi

echo "OK: real backlog.md (before=${BEFORE_OPEN} open, after=${AFTER_OPEN} open) truncated zero items"
exit 0
