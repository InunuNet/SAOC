#!/usr/bin/env bash
# Layer 2: contract.py gate exits 0 when all assertions pass
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh
source execution/tests/lib/sandbox_repo.sh

echo "=== test_contract_gate_pass.sh ==="

# In a one-commit sandbox repo: the gate's deletion guard walks git history
# from the spec directory's first commit, so in the host checkout the verdict
# depended on every file that repository ever deleted.
FIXTURE="execution/tests/layer2_fixture/fixtures/contract_passing.yaml"
SB=$(make_sandbox_repo contract_gate_pass "$FIXTURE" execution/tests/contracts)
cd "$SB" || exit 1
CONTRACT="$FIXTURE"

# Clear previous results
python3 "$HARNESS_ROOT/execution/contract.py" clear "$CONTRACT" >/dev/null 2>&1 || true

# Check each assertion
python3 "$HARNESS_ROOT/execution/contract.py" check "$CONTRACT" --assertion A1 >/dev/null 2>&1
python3 "$HARNESS_ROOT/execution/contract.py" check "$CONTRACT" --assertion A2 >/dev/null 2>&1

# Gate phase 1 — should pass (exit 0)
python3 "$HARNESS_ROOT/execution/contract.py" gate "$CONTRACT" --phase 1 >/dev/null 2>&1
ACTUAL_EXIT=$?

assert_exit "contract.py gate exits 0 for passing contract" 0 $ACTUAL_EXIT

summary
