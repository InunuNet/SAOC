#!/usr/bin/env bash
# verify_backlog_hygiene_gate_blocks_stale.sh — contract-f1 assertion A12.
#
# End-to-end simulation: a backlog.md with a stale open [ ] item whose
# **slug** matches a mission file with status: done must cause the new
# wrap_mission.sh hygiene gate to abort BEFORE any brain entry is written.
#
# We simulate directly against backlog_audit.sh (the exact command
# wrap_mission.sh runs and hard-fails on) rather than running the real
# wrap_mission.sh end to end, since the latter would commit/push against
# the live repo. This isolates the gate's actual decision logic.
#
# Exit codes:
#   0 — gate correctly detects the stale item and aborts (non-zero exit)
#   1 — gate failed to detect the stale item (would NOT have blocked close-out)

set -uo pipefail

SRC="$(pwd)"

TMP=""
cleanup() { [ -n "$TMP" ] && rm -rf "$TMP"; }
trap cleanup EXIT INT TERM
TMP="$(mktemp -d)"

MISSIONS_DIR="${TMP}/.agent/memory/project/missions"
mkdir -p "$MISSIONS_DIR"

cat > "${MISSIONS_DIR}/2026-01-01-stale-example.md" <<'EOF'
---
schema: athanor.mission/v1
slug: stale-example
status: done
---
# Mission: stale example
EOF

BACKLOG="${TMP}/.agent/memory/project/backlog.md"
cat > "$BACKLOG" <<'EOF'
# Backlog

- [ ] **stale-example** this item's mission is already done but row was never closed
EOF

# Run backlog_audit.sh with its relative paths pointed at our scratch tree by
# cd-ing into it (the script hardcodes ".agent/memory/project/backlog.md" and
# ".agent/memory/project/missions" relative to cwd).
set +e
(cd "$TMP" && bash "${SRC}/execution/backlog_audit.sh")
AUDIT_RC=$?
set -e

if [ "$AUDIT_RC" -eq 0 ]; then
  echo "FAIL: backlog_audit.sh exited 0 for a stale item — gate would NOT have blocked close-out" >&2
  exit 1
fi

echo "OK: backlog_audit.sh correctly exited non-zero (rc=${AUDIT_RC}) for stale item — wrap_mission.sh's gate would abort before brain wrap-up"
exit 0
