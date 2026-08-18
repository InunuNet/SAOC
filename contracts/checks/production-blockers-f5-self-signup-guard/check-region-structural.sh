#!/usr/bin/env bash
# A-STRUCT-03 — 1st-gen Auth triggers are forced to us-central1 regardless of any .region() call
# (confirmed live: firebase/firebase-functions issue reports, Stack Overflow 79761627). This
# check fails if the auth trigger declares any other region explicitly. No .region() call at
# all is fine (defaults to us-central1).
set -euo pipefail

if [ ! -f functions/src/index.ts ]; then
  echo "FAIL: functions/src/index.ts does not exist"
  exit 1
fi

FAIL=0

# Find a .region(...) call chained onto the same statement as .auth.user().onCreate(.
# Extract the file with newlines collapsed around the trigger definition so a multi-line
# builder chain is still matched.
COLLAPSED=$(tr '\n' ' ' < functions/src/index.ts)

if echo "$COLLAPSED" | grep -qE '\.region\([^)]*\)[^;]*\.auth\.user\(\)\.onCreate\('; then
  REGION_ARG=$(echo "$COLLAPSED" | grep -oE '\.region\([^)]*\)[^;]*\.auth\.user\(\)\.onCreate\(' | grep -oE "\.region\([^)]*\)" | head -1)
  if ! echo "$REGION_ARG" | grep -q 'us-central1'; then
    echo "FAIL: the auth trigger's .region() call ($REGION_ARG) is not us-central1 — 1st-gen Auth triggers cannot deploy anywhere else"
    FAIL=1
  fi
fi

if [ "$FAIL" -eq 1 ]; then
  exit 1
fi
echo "PASS: the auth trigger either declares no region (defaults to us-central1) or declares us-central1 explicitly"
