#!/usr/bin/env bash
# verify_backlog_hygiene_gate_passes_clean.sh — contract-f1 assertion A13 (T5).
#
# A clean, compliant backlog.md (no stale items, open count at or under
# MAX_OPEN) must not trip the gate — both backlog_audit.sh and
# backlog_trim.py must exit 0, so the exit-0 path through wrap_mission.sh's
# hygiene block is actually reachable.
#
# Exit codes:
#   0 — both checks passed clean (exit 0)
#   1 — gate incorrectly blocked a clean backlog

set -uo pipefail

SRC="$(pwd)"

TMP=""
cleanup() { [ -n "$TMP" ] && rm -rf "$TMP"; }
trap cleanup EXIT INT TERM
TMP="$(mktemp -d)"

mkdir -p "${TMP}/.agent/memory/project/missions"
BACKLOG="${TMP}/.agent/memory/project/backlog.md"
cat > "$BACKLOG" <<'EOF'
# Backlog

- [ ] a perfectly normal, non-stale open item with no slug reference
- [ ] another clean open item
EOF

set +e
(cd "$TMP" && bash "${SRC}/execution/backlog_audit.sh")
AUDIT_RC=$?
set -e

if [ "$AUDIT_RC" -ne 0 ]; then
  echo "FAIL: backlog_audit.sh exited ${AUDIT_RC} on a clean backlog (expected 0)" >&2
  exit 1
fi

TRIM_RC=0
BACKLOG_TRIM_PATH="$BACKLOG" BACKLOG_TRIM_DATA_DIR="${TMP}/data" \
  python3 "${SRC}/execution/backlog_trim.py" >/dev/null 2>&1 || TRIM_RC=$?

if [ "$TRIM_RC" -ne 0 ]; then
  echo "FAIL: backlog_trim.py exited ${TRIM_RC} on a clean backlog (expected 0)" >&2
  exit 1
fi

echo "OK: clean/compliant backlog.md passes both backlog_audit.sh and backlog_trim.py with exit 0 — gate would not block"
exit 0
