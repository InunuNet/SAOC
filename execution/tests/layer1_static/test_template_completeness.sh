#!/usr/bin/env bash
# Layer 1: Verify the template/ tree ships every file downstream projects need,
# plus root init.sh and PostCompact hook scripts.
set -uo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "ERROR: must run from inside the Athanor git repo"; exit 1; }
cd "$REPO_ROOT"
source execution/tests/lib/assert.sh

echo "=== test_template_completeness.sh ==="

assert_file_exists "template mission.py"             "template/execution/mission.py"
assert_file_exists "template contract.py"            "template/execution/contract.py"
assert_file_exists "template handoff_check.py"       "template/execution/handoff_check.py"
assert_file_exists "template brain.py"               "template/execution/brain.py"
assert_file_exists "template sync_agents.sh"         "template/execution/sync_agents.sh"
assert_file_exists "template handoffs.yaml"          "template/.agent/handoffs.yaml"
assert_file_exists "template update-manifest.yaml"   "template/.agent/update-manifest.yaml"
assert_file_exists "template no-update marker"       "template/.agent/no-update"
assert_file_exists "template AGENTS.md"              "template/AGENTS.md"
assert_file_exists "root init.sh"                    "init.sh"
assert_file_exists "post_compact_restore.sh hook"    "execution/hooks/post_compact_restore.sh"
assert_file_exists "post_compact_inject.sh hook"     "execution/hooks/post_compact_inject.sh"

summary
