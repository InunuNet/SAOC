#!/usr/bin/env bash
# A2 — regression guard: VendorCheckboxField.tsx's checkboxClass and
# VendorRadioGroupField.tsx's radioClass remain byte-identical to their
# polish-wave-2026-10-25 F2 values (out of scope for this mission, must be untouched).
set -euo pipefail

CHECKBOX_FILE="components/vendors/VendorCheckboxField.tsx"
RADIO_FILE="components/vendors/VendorRadioGroupField.tsx"

if [ ! -f "$CHECKBOX_FILE" ]; then
  echo "FAIL: $CHECKBOX_FILE not found"
  exit 1
fi
if [ ! -f "$RADIO_FILE" ]; then
  echo "FAIL: $RADIO_FILE not found"
  exit 1
fi

if ! grep -qF "size-6 rounded-sm border border-rule outline-none focus:ring-2 focus:ring-primary disabled:opacity-60" "$CHECKBOX_FILE"; then
  echo "FAIL: VendorCheckboxField.tsx's checkboxClass changed from expected value"
  exit 1
fi

if ! grep -qF "size-6 border border-rule outline-none focus:ring-2 focus:ring-primary disabled:opacity-60" "$RADIO_FILE"; then
  echo "FAIL: VendorRadioGroupField.tsx's radioClass changed from expected value"
  exit 1
fi

echo "PASS: checkbox/radio classNames are byte-identical to polish-wave-2026-10-25 F2 values"
exit 0
