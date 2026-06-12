#!/usr/bin/env bash
# Ghost project discovery runner — runs run_tests.sh in every ghost project directory.
# Usage: bash execution/tests/layer3_behavioral/test_ghost_projects.sh
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
GHOST_ROOT="$REPO_ROOT/execution/tests/ghost-project"

PASS=0; FAIL=0

for test_script in "$GHOST_ROOT"/*/tests/run_tests.sh; do
    [ -f "$test_script" ] || continue
    project="$(basename "$(dirname "$(dirname "$test_script")")")"
    printf "  [ghost/%s] " "$project"
    if bash "$test_script" > /tmp/ghost_${project}.log 2>&1; then
        echo "PASS"
        ((PASS++))
    else
        echo "FAIL"
        ((FAIL++))
        tail -10 /tmp/ghost_${project}.log
    fi
done

echo ""
echo "----------------------------"
echo "Results: $PASS passed, $FAIL failed"

[ "$FAIL" -eq 0 ]
