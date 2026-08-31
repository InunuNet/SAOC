#!/usr/bin/env bash
# verify_backlog_trim_env_override.sh — contract-f2 assertion A8.
#
# Confirms BACKLOG_TRIM_MAX_OPEN is honored: a headered file with 10 open
# items and BACKLOG_TRIM_MAX_OPEN=5 must truncate to exactly 5.
#
# Exit codes:
#   0 — override honored
#   1 — override ignored

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
  echo "_Last compacted: 2020-01-01 by backlog_trim.py. Full history: git log on this file._"
  echo ""
  for i in $(seq 1 10); do
    echo "- [ ] synthetic item number ${i}"
  done
} > "$BACKLOG"

BACKLOG_TRIM_PATH="$BACKLOG" BACKLOG_TRIM_DATA_DIR="${TMP}/data" BACKLOG_TRIM_MAX_OPEN=5 \
  python3 "${SRC}/execution/backlog_trim.py" >/dev/null 2>&1 || {
    echo "FAIL: backlog_trim.py exited non-zero with BACKLOG_TRIM_MAX_OPEN=5" >&2
    exit 1
  }

OPEN_COUNT=$(grep -c '^- \[ \]' "$BACKLOG" || true)
if [ "$OPEN_COUNT" -ne 5 ]; then
  echo "FAIL: expected 5 open items after override truncation, got ${OPEN_COUNT}" >&2
  exit 1
fi

echo "OK: BACKLOG_TRIM_MAX_OPEN=5 honored — truncated to 5 open items"
exit 0
