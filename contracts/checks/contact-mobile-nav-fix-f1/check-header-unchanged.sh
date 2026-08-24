#!/usr/bin/env bash
# A3 — components/chrome/Header.tsx is unchanged by this feature. Regression guard
# for the desktop Contact CTA button and the Zone 2 primary nav.
set -euo pipefail

FILE="components/chrome/Header.tsx"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE not found"
  exit 1
fi

if ! git diff --quiet HEAD -- "$FILE"; then
  echo "FAIL: $FILE differs from git HEAD — Header.tsx must be untouched by this feature"
  git diff HEAD -- "$FILE"
  exit 1
fi

if ! grep -qE 'hidden sm:inline-block rounded-sm bg-primary' "$FILE"; then
  echo "FAIL: desktop Contact CTA button (hidden sm:inline-block) missing or altered in $FILE"
  exit 1
fi

if ! grep -qE '<MobileMenu open=\{mobileOpen\} onClose=\{\(\) => setMobileOpen\(false\)\} nav=\{NAV\} />' "$FILE"; then
  echo "FAIL: <MobileMenu ... nav={NAV} /> call site changed in $FILE"
  exit 1
fi

echo "PASS: Header.tsx is byte-identical to git HEAD; Contact CTA and MobileMenu call site intact"
exit 0
