#!/usr/bin/env bash
# Layer 3: full_boot.sh fails gracefully without WORKSPACE file
set -uo pipefail
PROJ_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
source "$PROJ_ROOT/execution/tests/lib/assert.sh"

echo "=== test_boot_missing_workspace.sh ==="

# Create a temp dir WITHOUT a WORKSPACE file
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Copy minimal profile.json so boot doesn't hard-fail on missing profile
mkdir -p "$TMPDIR/.agent"
cp "$PROJ_ROOT/.agent/profile.json" "$TMPDIR/.agent/profile.json"

# Run full_boot.sh from the temp dir (it reads WORKSPACE from cwd)
OUTPUT=$(cd "$TMPDIR" && bash "$PROJ_ROOT/execution/hooks/full_boot.sh" 2>&1)
BOOT_EXIT=$?

# The script doesn't exit non-zero but should output a warning
if [ $BOOT_EXIT -ne 0 ] || echo "$OUTPUT" | grep -q "MISSING\|missing\|run bash init.sh"; then
  echo "  PASS full_boot.sh handles missing WORKSPACE gracefully"
  ((PASS++))
else
  echo "  FAIL full_boot.sh did not warn about missing WORKSPACE"
  echo "  Output snippet: $(echo "$OUTPUT" | head -10)"
  ((FAIL++)); ERRORS+=("boot missing WORKSPACE not warned")
fi

summary
