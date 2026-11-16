#!/usr/bin/env bash
# Layer 3: Behavioral — init.sh must scaffold a complete workspace in a temp dir.
# Invokes init.sh against mktemp -d and verifies key files/dirs exist.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: must run from inside the Athanor git repo"
  exit 1
}
cd "$REPO_ROOT"

source execution/tests/lib/assert.sh

echo "=== test_init_smoke.sh ==="

TEST_TMPDIR=$(mktemp -d)
trap 'rm -rf "$TEST_TMPDIR"' EXIT

bash init.sh --name "SmokeTest" --path "$TEST_TMPDIR" >/dev/null 2>&1
INIT_EXIT=$?

assert_exit "init.sh exits 0" 0 $INIT_EXIT

assert_file_exists "WORKSPACE file exists" "$TEST_TMPDIR/WORKSPACE"

grep -q "SmokeTest" "$TEST_TMPDIR/WORKSPACE" 2>/dev/null
assert_exit "WORKSPACE contains project name 'SmokeTest'" 0 $?

assert_file_exists ".agent/profile.json exists" "$TEST_TMPDIR/.agent/profile.json"

# The path goes in as an argument: Git Bash converts /c/... arguments for native Windows python,
# but not a path embedded in the -c string (Athanor Win 2026-11-07).
python3 -c "
import json, sys
d = json.load(open(sys.argv[1], encoding='utf-8'))
assert d.get('project_name') == 'SmokeTest', f'project_name={d.get(\"project_name\")!r}'
assert d.get('onboarding_complete') == False, 'onboarding_complete not false'
" "$TEST_TMPDIR/.agent/profile.json" 2>/dev/null
assert_exit "profile.json has correct project_name and onboarding_complete=false" 0 $?

assert_file_exists "execution/handoff_check.py exists" "$TEST_TMPDIR/execution/handoff_check.py"

assert_file_exists "execution/mission.py exists" "$TEST_TMPDIR/execution/mission.py"

assert_file_exists ".agent/handoffs.yaml exists" "$TEST_TMPDIR/.agent/handoffs.yaml"

test -d "$TEST_TMPDIR/.claude"
assert_exit ".claude/ directory exists" 0 $?

summary
