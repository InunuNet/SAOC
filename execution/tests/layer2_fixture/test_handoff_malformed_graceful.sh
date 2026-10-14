#!/usr/bin/env bash
# Layer 2: handoffs.py handles malformed input gracefully — no crash, no traceback
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh
source execution/tests/lib/sandbox_repo.sh

echo "=== test_handoff_malformed_graceful.sh ==="

FIXTURE="execution/tests/layer2_fixture/fixtures/handoff_malformed.txt"
# In a sandbox repo: handoffs.py appends left_undone items to the cwd's
# backlog.md and remembers into its brain, so run from the host checkout it
# wrote a fake "Factory loop" item into that project's live backlog.
SB=$(make_sandbox_repo handoff_malformed_graceful "$FIXTURE")
cd "$SB" || exit 1

# Malformed fixture is not JSON — handoffs.py should catch the JSONDecodeError
STDOUT=$(cat "$FIXTURE" | python3 "$HARNESS_ROOT/execution/handoffs.py" 2>/dev/null)
STDERR=$(cat "$FIXTURE" | python3 "$HARNESS_ROOT/execution/handoffs.py" 2>&1 >/dev/null)
ACTUAL_EXIT=$?

# Exit must be 0 or 1 — not 2+ (which would indicate uncaught exception with weird exit)
if [ "$ACTUAL_EXIT" -le 1 ]; then
  echo "  PASS graceful exit (exit $ACTUAL_EXIT)"
  ((PASS++))
else
  echo "  FAIL unexpected exit code $ACTUAL_EXIT"
  ((FAIL++)); ERRORS+=("malformed input: unexpected exit $ACTUAL_EXIT")
fi

# No Python traceback in stderr
assert_output_not_contains "no Traceback in output" "Traceback" "$STDERR"

summary
