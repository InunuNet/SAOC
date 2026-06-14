#!/usr/bin/env bash
# Golden test: a fleet_loop-* signal is silently archived with NO backlog item added.
# Uses a self-contained temp dir — does NOT touch production inbox or backlog.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../../.." && pwd)"

TMPDIR_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_ROOT"' EXIT

# Build a minimal project layout in the temp dir
mkdir -p "$TMPDIR_ROOT/.agent/memory/project/inbox"
mkdir -p "$TMPDIR_ROOT/.agent/memory/project/inbox/archive"
cat > "$TMPDIR_ROOT/.agent/memory/project/backlog.md" <<'EOF'
# Test Backlog
## Active
EOF

# Drop a fleet_loop-* signal in the temp inbox
SIGNAL="$TMPDIR_ROOT/.agent/memory/project/inbox/fleet_loop-20260101T000000.txt"
echo "fleet_loop test signal" > "$SIGNAL"

# Run ingest_pulse.sh against the temp project root
PROJECT_ROOT="$TMPDIR_ROOT" bash "$PROJECT_ROOT/execution/ingest_pulse.sh" test-project > /dev/null 2>&1

# Assert: the signal was moved to archive (not left in inbox)
if [ -f "$SIGNAL" ]; then
    echo "FAIL: fleet_loop signal was NOT archived — still in inbox" >&2
    exit 1
fi

# Assert: no backlog item was written
if grep -qF "fleet_loop" "$TMPDIR_ROOT/.agent/memory/project/backlog.md"; then
    echo "FAIL: fleet_loop signal was written to backlog (should be silently archived)" >&2
    exit 1
fi

echo "PASS: fleet_loop signal archived silently, no backlog item written"
exit 0
