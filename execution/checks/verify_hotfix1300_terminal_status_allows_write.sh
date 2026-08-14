#!/usr/bin/env bash
# GH #1300 — a mission whose frontmatter status has already reached a terminal
# state (complete/done/abandoned) must NOT block writes, even if active.json
# still points at it. Verifies require_contract_for_write.sh fails OPEN.
set -euo pipefail
REPO_ROOT="${1:?usage: verify_hotfix1300_terminal_status_allows_write.sh <repo_root>}"
HOOK="$REPO_ROOT/execution/hooks/require_contract_for_write.sh"
GOLDEN="$REPO_ROOT/.agent/memory/project/specs/hotfix-1300-writegate/goldens/terminal-mission.md"

SANDBOX=$(mktemp -d)
trap 'rm -rf "$SANDBOX"' EXIT

mkdir -p "$SANDBOX/.agent/memory/project/missions"
MISSION="$SANDBOX/.agent/memory/project/missions/terminal-mission.md"
cp "$GOLDEN" "$MISSION"

cat > "$SANDBOX/.agent/memory/project/missions/active.json" <<EOF
{"mission": "$MISSION", "checkpoint": {"milestone": null, "feature": null}, "activated_at": "2026-07-19T00:00:00+00:00"}
EOF

cd "$SANDBOX"
TARGET="$SANDBOX/src/some_normal_file.py"
INPUT=$(printf '{"tool_input":{"file_path":"%s"}}' "$TARGET")

set +e
OUT=$(echo "$INPUT" | "$HOOK" 2>&1)
RC=$?
set -e

if [ "$RC" -ne 0 ]; then
  echo "FAIL: terminal-status mission (status: complete) blocked a normal write. rc=$RC"
  echo "$OUT"
  exit 1
fi

echo "PASS: terminal-status mission did not block a normal repo write (rc=0)"
