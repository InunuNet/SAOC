#!/usr/bin/env bash
# A3 — regression guard: existing non-focus inputClass tokens (border colour,
# background, padding, text size, the pre-existing focus:border-ink/40 colour
# shift) remain present — this is an additive change only.
set -euo pipefail

FILE="components/vendors/VendorFormField.tsx"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE not found"
  exit 1
fi

BLOCK="$(awk '/const inputClass/,/;/' "$FILE")"

for token in "border-rule bg-ivory" "focus:border-ink/40" "px-3.5 py-2.5" "text-[15px]" "disabled:opacity-60"; do
  if ! echo "$BLOCK" | grep -qF "$token"; then
    echo "FAIL: inputClass missing pre-existing token: $token"
    exit 1
  fi
done

echo "PASS: existing non-focus inputClass styling preserved"
exit 0
