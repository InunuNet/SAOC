#!/usr/bin/env bash
# Layer 3: brain.py remember/recall roundtrip (ChromaDB test)
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh

echo "=== test_brain_remember_recall.sh ==="

TESTTAG="athanor-factory-test-$(date +%s)"

# Store in brain
STORE_OUTPUT=$(python3 execution/brain.py remember \
  --summary "Factory test: $TESTTAG" \
  --tags "factory-selftest" 2>&1)
STORE_EXIT=$?

assert_exit "brain.py remember exits 0" 0 $STORE_EXIT

# Recall — ChromaDB search
RECALL_OUTPUT=$(python3 execution/brain.py recall "$TESTTAG" --n 1 2>&1)
RECALL_EXIT=$?

assert_exit "brain.py recall exits 0" 0 $RECALL_EXIT
assert_output_contains "recalled tag found in output" "factory" "$RECALL_OUTPUT"

summary
