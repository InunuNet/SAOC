#!/usr/bin/env bash
# Layer 1: Verify all critical files exist
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh

echo "=== test_files_exist.sh ==="

assert_file_exists "check_autonomy.sh exists"     "execution/hooks/check_autonomy.sh"
assert_file_exists "full_boot.sh exists"          "execution/hooks/full_boot.sh"
assert_file_exists "subagent_stop.sh exists"      "execution/hooks/subagent_stop.sh"
assert_file_exists "verify_workspace.sh exists"   "execution/hooks/verify_workspace.sh"
assert_file_exists "handoffs.py exists"           "execution/handoffs.py"
assert_file_exists "contract.py exists"           "execution/contract.py"
assert_file_exists "brain.py exists"              "execution/brain.py"
assert_file_exists ".agent/profile.json exists"   ".agent/profile.json"
assert_file_exists "autonomy_matrix.json exists"  ".agent/autonomy_matrix.json"
assert_file_exists "validation_contract.v1.json"  ".agent/schemas/validation_contract.v1.json"
assert_file_exists ".agent/workflows/spec.md"     ".agent/workflows/spec.md"
assert_file_exists ".claude/settings.json exists" ".claude/settings.json"
assert_file_exists "Makefile exists"              "Makefile"
assert_file_exists "AGENTS.md exists"             "AGENTS.md"
assert_file_exists "WORKSPACE exists"             "WORKSPACE"

summary
