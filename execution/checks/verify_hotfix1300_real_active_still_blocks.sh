#!/usr/bin/env bash
# GH #1300 regression guard — the hotfix must NOT open a hole in the real
# contract gate. A genuinely active, in-progress mission with a feature that
# has no contract attached must still block writes to normal repo paths.
set -euo pipefail
REPO_ROOT="${1:?usage: verify_hotfix1300_real_active_still_blocks.sh <repo_root>}"
HOOK="$REPO_ROOT/execution/hooks/require_contract_for_write.sh"
GOLDEN="$REPO_ROOT/.agent/memory/project/specs/hotfix-1300-writegate/goldens/real-active-mission.md"

SANDBOX=$(mktemp -d)
trap 'rm -rf "$SANDBOX"' EXIT

mkdir -p "$SANDBOX/.agent/memory/project/missions"
MISSION="$SANDBOX/.agent/memory/project/missions/real-active-mission.md"
cp "$GOLDEN" "$MISSION"

# Sanity: make sure no contract exists for this slug in the sandbox.
if [ -d "$SANDBOX/.agent/memory/project/specs/real-active-mission-1300" ]; then
  echo "FAIL: fixture setup invalid — a contract dir already exists for the fixture slug"
  exit 1
fi

cat > "$SANDBOX/.agent/memory/project/missions/active.json" <<EOF
{"mission": "$MISSION", "checkpoint": {"milestone": "M1", "feature": "F1"}, "activated_at": "2026-07-19T00:00:00+00:00"}
EOF

cd "$SANDBOX"
TARGET="$SANDBOX/src/some_normal_file.py"
INPUT=$(printf '{"tool_input":{"file_path":"%s"}}' "$TARGET")

set +e
OUT=$(echo "$INPUT" | "$HOOK" 2>&1)
RC=$?
set -e

if [ "$RC" -ne 2 ]; then
  echo "FAIL: a genuinely active mission with no contract should block (exit 2) but got rc=$RC"
  echo "$OUT"
  exit 1
fi

echo "PASS: genuinely active mission with no contract still blocks normal repo writes (no regression)"
