#!/usr/bin/env bash
# A1 — VendorFormField.tsx's inputClass constant carries all four site-default
# focus-visible ring tokens verbatim.
set -euo pipefail

FILE="components/vendors/VendorFormField.tsx"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE not found"
  exit 1
fi

BLOCK="$(awk '/const inputClass/,/;/' "$FILE")"

for token in "focus-visible:ring-2" "focus-visible:ring-ink/40" "focus-visible:ring-offset-2" "focus-visible:ring-offset-ivory"; do
  if ! echo "$BLOCK" | grep -qF "$token"; then
    echo "FAIL: inputClass missing token: $token"
    exit 1
  fi
done

echo "PASS: inputClass carries all four focus-visible ring tokens"
exit 0
