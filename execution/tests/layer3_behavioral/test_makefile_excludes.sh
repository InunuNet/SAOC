#!/usr/bin/env bash
# Layer 3: Regression — Makefile update-template target must delegate to update_template.py
# (rsync was replaced by update_template.py in v3.5; this test tracks the new implementation)
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh

echo "=== test_makefile_excludes.sh ==="

# update-template Makefile target calls update_template.py
grep -q "update_template\.py" Makefile 2>/dev/null
assert_exit "Makefile update-template target calls update_template.py" 0 $?

# The script itself must exist
assert_file_exists "execution/update_template.py exists" "execution/update_template.py"

# WORKSPACE self-update guard must be present (exact-match '== "Athanor"')
grep -q '== "Athanor"' execution/update_template.py 2>/dev/null
assert_exit "update_template.py contains WORKSPACE self-update guard" 0 $?

summary
