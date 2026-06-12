#!/usr/bin/env bash
# Layer 2: contract.py gate exits 2 when a blocker assertion fails
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh

echo "=== test_contract_gate_fail.sh ==="

CONTRACT="execution/tests/layer2_fixture/fixtures/contract_failing.yaml"

# Clear previous results
python3 execution/contract.py clear "$CONTRACT" >/dev/null 2>&1 || true

# Check assertion A1 (file does not exist — should fail)
python3 execution/contract.py check "$CONTRACT" --assertion A1 >/dev/null 2>&1 || true

# Gate phase 1 — should exit 2 (blocker fails)
python3 execution/contract.py gate "$CONTRACT" --phase 1 >/dev/null 2>&1
ACTUAL_EXIT=$?

assert_exit "contract.py gate exits 2 for failing contract" 2 $ACTUAL_EXIT

summary
