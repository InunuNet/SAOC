#!/usr/bin/env bash
# A1 — DoorResultBanner (or wherever the door check-in result renders) is a fixed,
# full-viewport overlay, not a block appended to normal document flow. See
# contracts/golden/door-checkin-success-feedback-f1/overlay-spec.golden.md "Positioning".
set -euo pipefail

FILE="components/admin/DoorResultBanner.tsx"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE not found"
  exit 1
fi

if ! grep -qE '\bfixed\b' "$FILE"; then
  echo "FAIL: no 'fixed' positioning class found in $FILE"
  exit 1
fi

if ! grep -qE 'inset-0|inset:\s*0|top-0.*right-0.*bottom-0.*left-0' "$FILE"; then
  echo "FAIL: no full-coverage inset found in $FILE"
  exit 1
fi

if ! grep -qE '\bz-[0-9]+\b' "$FILE"; then
  echo "FAIL: no z-index utility class found in $FILE — overlay must stack above the scanner UI"
  exit 1
fi

# If any explicit viewport-relative height/width sizing is present, it must use dvh/dvw,
# never bare vh/vw (mobile browser chrome makes vh wrong — established project convention).
if grep -qE '[0-9](vh|vw)\b' "$FILE" && ! grep -qE '[0-9]d(vh|vw)\b' "$FILE"; then
  echo "FAIL: bare vh/vw unit found in $FILE — use dvh/dvw"
  exit 1
fi

echo "PASS: $FILE is a fixed, full-viewport, z-stacked overlay"
