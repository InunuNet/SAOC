#!/usr/bin/env bash
# verify_harness_untouched.sh -- the gate-hooks change may alter only the harness-owned paths
# named in goldens/harness-untouched.allowlist.txt, measured against the base commit (staged and
# unstaged changes both count: this diffs the working tree against BASE, not against HEAD).
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BASE="5165668d"
ALLOWLIST="$REPO_ROOT/.agent/memory/project/specs/harness-gate-hooks/goldens/harness-untouched.allowlist.txt"
HARNESS_PATHS=(execution template init.sh Makefile .claude/hooks .agent/agents .agent/rules .agent/skills .agent/workflows)

if [ ! -f "$ALLOWLIST" ]; then
  echo "FAIL: allowlist not found: $ALLOWLIST"
  exit 2
fi

changed="$(git -C "$REPO_ROOT" diff --name-only "$BASE" -- "${HARNESS_PATHS[@]}")" || {
  echo "FAIL: git diff against $BASE failed"
  exit 2
}
allowed="$(grep -v '^[[:space:]]*#' "$ALLOWLIST" | grep -v '^[[:space:]]*$')"
offenders="$(printf '%s\n' "$changed" | grep -v '^$' | grep -vxF -f <(printf '%s\n' "$allowed"))"

if [ -n "$offenders" ]; then
  echo "FAIL: harness-owned paths changed versus $BASE outside the allowlist:"
  printf '%s\n' "$offenders"
  exit 1
fi
echo "PASS: no harness-owned path changed versus $BASE beyond the allowlist"
