#!/usr/bin/env bash
# GH #1300 — /tmp, /private/tmp, and any */scratchpad/* path must NEVER be
# gated, even in the worst case: a genuinely active mission with a feature
# that has no contract yet (the case that legitimately blocks normal writes).
set -euo pipefail
REPO_ROOT="${1:?usage: verify_hotfix1300_tmp_scratchpad_always_allowed.sh <repo_root>}"
HOOK="$REPO_ROOT/execution/hooks/require_contract_for_write.sh"
GOLDEN="$REPO_ROOT/.agent/memory/project/specs/hotfix-1300-writegate/goldens/real-active-mission.md"

SANDBOX=$(mktemp -d)
trap 'rm -rf "$SANDBOX"' EXIT

mkdir -p "$SANDBOX/.agent/memory/project/missions"
MISSION="$SANDBOX/.agent/memory/project/missions/real-active-mission.md"
cp "$GOLDEN" "$MISSION"

cat > "$SANDBOX/.agent/memory/project/missions/active.json" <<EOF
{"mission": "$MISSION", "checkpoint": {"milestone": "M1", "feature": "F1"}, "activated_at": "2026-07-19T00:00:00+00:00"}
EOF

cd "$SANDBOX"

FAIL=0
for TARGET in \
  "/tmp/athanor-hotfix1300-$$/throwaway.txt" \
  "/private/tmp/athanor-hotfix1300-$$/throwaway.txt" \
  "$SANDBOX/.agent/memory/scratchpad/notes-$$.txt" \
  "/Users/anyone/some/deep/scratchpad/dir/file-$$.txt"
do
  INPUT=$(printf '{"tool_input":{"file_path":"%s"}}' "$TARGET")
  set +e
  OUT=$(echo "$INPUT" | "$HOOK" 2>&1)
  RC=$?
  set -e
  if [ "$RC" -ne 0 ]; then
    echo "FAIL: throwaway path was blocked despite a real active mission with no contract: $TARGET (rc=$RC)"
    echo "$OUT"
    FAIL=1
  fi
done

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

echo "PASS: /tmp, /private/tmp, and */scratchpad/* writes are never gated"
