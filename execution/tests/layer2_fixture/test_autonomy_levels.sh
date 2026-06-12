#!/usr/bin/env bash
# Layer 2: check_autonomy.sh enforces autonomy levels + floor denials across the matrix.
# Mechanism: write level to /tmp/athanor_autonomy_$$ (child's PPID == this script's $$),
# then pipe a tool-input JSON into bash execution/hooks/check_autonomy.sh and assert exit.
set -uo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "ERROR: must run from inside the Athanor git repo"; exit 1; }
cd "$REPO_ROOT"
source execution/tests/lib/assert.sh

echo "=== test_autonomy_levels.sh ==="

CACHE="/tmp/athanor_autonomy_$$"
HOOK="execution/hooks/check_autonomy.sh"

run_row() {
  local level="$1" input="$2"
  rm -f "$CACHE"
  echo "$level" > "$CACHE"
  echo "$input" | bash "$HOOK" >/dev/null 2>&1
  local ec=$?
  rm -f "$CACHE"
  return $ec
}

# Row 1: off blocks Bash
run_row "off" '{"tool_name":"Bash","tool_input":{"command":"echo hello"}}'
assert_exit "level=off blocks Bash (echo hello)" 2 $?

# Row 2: off blocks Write
run_row "off" '{"tool_name":"Write","tool_input":{"file_path":"src/foo.py","content":"x"}}'
assert_exit "level=off blocks Write (src/foo.py)" 2 $?

# Row 3: low allows ls
run_row "low" '{"tool_name":"Bash","tool_input":{"command":"ls"}}'
assert_exit "level=low allows Bash (ls)" 0 $?

# Row 4: medium allows git add .
run_row "medium" '{"tool_name":"Bash","tool_input":{"command":"git add ."}}'
assert_exit "level=medium allows Bash (git add .)" 0 $?

# Row 5: high allows Makefile write
run_row "high" '{"tool_name":"Write","tool_input":{"file_path":"Makefile","content":"x"}}'
assert_exit "level=high allows Write (Makefile)" 0 $?

# Row 6: floor blocks rm -rf / even at high
run_row "high" '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}'
assert_exit "floor denial blocks Bash (rm -rf /) at level=high" 2 $?

# Row 7: floor blocks sudo even at medium
run_row "medium" '{"tool_name":"Bash","tool_input":{"command":"sudo rm"}}'
assert_exit "floor denial blocks Bash (sudo rm) at level=medium" 2 $?

rm -f "$CACHE"

summary
