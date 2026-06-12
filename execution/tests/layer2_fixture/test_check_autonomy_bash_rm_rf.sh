#!/usr/bin/env bash
# Layer 2: check_autonomy.sh blocks rm -rf / at ANY autonomy level (floor denial)
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh

echo "=== test_check_autonomy_bash_rm_rf.sh ==="

FIXTURE="execution/tests/layer2_fixture/fixtures/pretooluse_bash_rm_rf.json"

# rm -rf / is a floor denial — blocked even at high autonomy
rm -f /tmp/athanor_autonomy_*
cat "$FIXTURE" | bash execution/hooks/check_autonomy.sh 2>/dev/null
ACTUAL_EXIT=$?

assert_exit "rm -rf / blocked at floor level (even at high)" 2 $ACTUAL_EXIT

summary
