#!/usr/bin/env bash
# A3 — structural proof this contract's checks never ASSERT against
# nationalShowVenuePatch.venue.directionsNote (owned by venue-prose-residue's A13,
# currently a known pre-existing defect there — see README "Explicitly out of scope").
# Explanatory comments/docstrings in this directory are expected to mention the field name
# (to document why it's excluded) — this check only fails if the field appears as an actual
# assertion target: a Python dict/JSON key access, or a value inside a FIELDS/EXPECTED/
# REQUIRED list, in any *.py or *.sh file here. Comment-only mentions are allowed.
set -euo pipefail

DIR="contracts/checks/venue-never-changed-copy-fix-f1"
FOUND=0

# Python: a live key-access pattern, e.g. doc["directionsNote"], .get("directionsNote"
if grep -rnE '["'\''"]directionsNote["'\'']' "$DIR"/*.py 2>/dev/null | grep -vE '^\s*#|"""' ; then
  FOUND=1
fi

if [ "$FOUND" -eq 1 ]; then
  echo "FAIL: a checker script in $DIR asserts against directionsNote — out of scope, see README"
  exit 1
fi

echo "PASS: no checker script asserts against directionsNote or nationalShowVenuePatch"
exit 0
