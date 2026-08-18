#!/usr/bin/env bash
# A-STRUCT-04 — existing accounts (including brad@inunu.net's, uid NhSVXoMlT2bl6h4gDoyr5NZ1VW52)
# can never be at risk from this deploy: onCreate only fires at creation time. This check fails
# if any scheduled function, onUpdate/onWrite trigger, or periodic sweep over Auth users exists
# anywhere under functions/ — any such thing could re-evaluate an already-existing uid, which
# this design deliberately does not do. See README.md section 4.
set -euo pipefail

if [ ! -d functions/src ]; then
  echo "FAIL: functions/src does not exist"
  exit 1
fi

FAIL=0
FORBIDDEN='pubsub\.schedule|onSchedule|\.auth\.user\(\)\.onUpdate|onWrite\(|onDocumentWritten|listUsers\('

if grep -rqE "$FORBIDDEN" functions/src/; then
  echo "FAIL: functions/src/ contains a scheduled/sweep/onUpdate pattern that could re-evaluate an existing account ($(grep -rniE "$FORBIDDEN" functions/src/ | head -3))"
  FAIL=1
fi

# Self-test.
TMPDIR=$(mktemp -d)
echo "exports.sweep = functions.pubsub.schedule('every 5 minutes').onRun(async () => {});" > "$TMPDIR/bad.ts"
if ! grep -rqE "$FORBIDDEN" "$TMPDIR/"; then
  echo "FAIL: self-test — the sweep-pattern grep did not fire on a known scheduled-function shape; this check cannot be trusted"
  FAIL=1
fi
rm -rf "$TMPDIR"

if [ "$FAIL" -eq 1 ]; then
  exit 1
fi
echo "PASS: no scheduled sweep or update-triggered re-evaluation of existing accounts exists"
