#!/usr/bin/env bash
# Golden test: qa_guard.sh excludes template/ from print() detection

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
QA_GUARD="$PROJECT_ROOT/.agent/pulse/registry/qa_guard.sh"

fails=0; total=0

check() {
  local desc="$1"; shift; total=$((total+1))
  if "$@" >/dev/null 2>&1; then echo "PASS  $total. $desc"
  else echo "FAIL  $total. $desc"; fails=$((fails+1)); fi
}

[[ -f "$QA_GUARD" ]] || { echo "FAIL  qa_guard.sh not found"; exit 1; }

# 1. template/ pathspec exclusion present in git diff call
check "git diff excludes template/ via pathspec" \
  grep -q "':!template/'" "$QA_GUARD"

# 2. exclusion is on the same line as the print() grep
check "exclusion on same line as print detection" \
  grep -q "':!template/'.*print\|print.*':!template/'" "$QA_GUARD"

# 3. bash syntax check
check "bash -n syntax check passes" bash -n "$QA_GUARD"

# 4. template copy identical to canon
check "template copy identical to canon" \
  diff -q "$QA_GUARD" "$PROJECT_ROOT/template/.agent/pulse/registry/qa_guard.sh"

echo "---"
echo "Results: $((total-fails)) / $total passed"
(( fails > 0 )) && exit 1 || exit 0
