#!/usr/bin/env bash
# A2 — success/failure branches reuse only existing brand tokens (no invented colors), keep
# their accessible pairing, keep the checkmark/name/reason content, and the success icon is
# visibly larger than the pre-fix 22-26px treatment. See
# contracts/golden/door-checkin-success-feedback-f1/overlay-spec.golden.md.
set -euo pipefail

FILE="components/admin/DoorResultBanner.tsx"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE not found"
  exit 1
fi

# No new hex/rgb color literals introduced.
if grep -qE '#[0-9a-fA-F]{3,8}\b|rgba?\(' "$FILE"; then
  echo "FAIL: raw hex/rgb color literal found in $FILE — reuse existing Tailwind tokens only"
  exit 1
fi

for token in bg-primary text-ivory bg-bone border-primary-800 text-primary-800; do
  if ! grep -q -- "$token" "$FILE"; then
    echo "FAIL: expected token '$token' not found in $FILE"
    exit 1
  fi
done

if ! grep -q 'role="status"' "$FILE"; then
  echo "FAIL: role=\"status\" missing from success branch"
  exit 1
fi

if ! grep -q 'role="alert"' "$FILE"; then
  echo "FAIL: role=\"alert\" missing from failure branch"
  exit 1
fi

if ! grep -q 'attendeeName' "$FILE"; then
  echo "FAIL: attendee name no longer rendered"
  exit 1
fi

if ! grep -q 'result.error' "$FILE"; then
  echo "FAIL: failure reason (result.error) no longer rendered"
  exit 1
fi

# Success icon must be sized larger than the pre-fix 22px/26px text treatment.
if ! grep -qE 'text-\[(4[89]|[5-9][0-9]|[1-9][0-9]{2,})px\]|<svg' "$FILE"; then
  echo "FAIL: no large checkmark icon/glyph (>= 48px) or <svg> icon found for the success state"
  exit 1
fi

echo "PASS: tokens, accessible pairing, and content all present"
