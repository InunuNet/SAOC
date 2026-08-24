#!/usr/bin/env bash
# A3 — Header.tsx's desktop nav (Zone 2), search button, and Contact CTA (Zone 3)
# markup are unchanged apart from the hamburger-ref wiring. Header.tsx IS expected
# to differ from git HEAD by this feature (a ref threaded to the hamburger button
# and passed to MobileMenu as triggerRef) — unlike contact-mobile-nav-fix-f1's
# check-header-unchanged.sh, this check allows exactly that change and fails on
# anything else.
set -euo pipefail

FILE="components/chrome/Header.tsx"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE not found"
  exit 1
fi

DIFF=$(git diff HEAD -- "$FILE" || true)

if [ -z "$DIFF" ]; then
  echo "FAIL: $FILE has no diff against HEAD — expected the hamburger-ref wiring change"
  exit 1
fi

# Every added/removed line in the diff must be explainable by the permitted change:
# threading a ref to the hamburger button (useRef import/declaration, ref={hamburgerRef}
# on the button, triggerRef={hamburgerRef} on <MobileMenu>). Any other changed line fails.
CHANGED_LINES=$(echo "$DIFF" | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)')
UNEXPECTED=$(echo "$CHANGED_LINES" | grep -vE \
  "(useRef|hamburgerRef|triggerRef|<MobileMenu$|open=\{mobileOpen\}|onClose=\{\(\) => setMobileOpen\(false\)\}|nav=\{NAV\}|^[+-][[:space:]]*/>$|import \{ use)" \
  || true)

if [ -n "$UNEXPECTED" ]; then
  echo "FAIL: $FILE has changes beyond the permitted hamburger-ref wiring:"
  echo "$UNEXPECTED"
  exit 1
fi

# Structural regression guards: the desktop nav, search button, and Contact CTA must
# still be present and intact.
if ! grep -qE '<nav aria-label="Primary" className="hidden min-\[1240px\]:flex items-center gap-7">' "$FILE"; then
  echo "FAIL: desktop Zone 2 primary nav block missing or altered in $FILE"
  exit 1
fi

if ! grep -qE 'aria-label="Open search"' "$FILE"; then
  echo "FAIL: desktop search button missing in $FILE"
  exit 1
fi

if ! grep -qE 'hidden sm:inline-block rounded-sm bg-primary' "$FILE"; then
  echo "FAIL: desktop Contact CTA button (hidden sm:inline-block) missing or altered in $FILE"
  exit 1
fi

if ! grep -qE 'aria-label="Open menu"' "$FILE"; then
  echo "FAIL: hamburger trigger button missing in $FILE"
  exit 1
fi

if ! grep -qE 'ref=\{hamburgerRef\}' "$FILE"; then
  echo "FAIL: hamburger button is not wired to hamburgerRef in $FILE"
  exit 1
fi

if ! grep -qE 'triggerRef=\{hamburgerRef\}' "$FILE"; then
  echo "FAIL: <MobileMenu> is not passed triggerRef={hamburgerRef} in $FILE"
  exit 1
fi

echo "PASS: Header.tsx changed only by the permitted hamburger-ref wiring; desktop nav/search/CTA intact"
exit 0
