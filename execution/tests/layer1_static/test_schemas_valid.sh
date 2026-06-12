#!/usr/bin/env bash
# Layer 1: Verify JSON files are valid JSON
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh

echo "=== test_schemas_valid.sh ==="

_check_json() {
  local desc="$1" path="$2"
  jq . "$path" >/dev/null 2>&1
  assert_exit "$desc is valid JSON" 0 $?
}

_check_json ".agent/profile.json"                 ".agent/profile.json"
_check_json ".agent/autonomy_matrix.json"         ".agent/autonomy_matrix.json"
_check_json ".agent/schemas/validation_contract"  ".agent/schemas/validation_contract.v1.json"
_check_json ".claude/settings.json"              ".claude/settings.json"
_check_json ".agent/providers/claude-code.json"  ".agent/providers/claude-code.json"

summary
