#!/usr/bin/env bash
# A1 — components/chrome/MobileMenu.tsx renders a real next/link Link with
# href="/contact" inside the "Mobile primary" nav, distinct from the nav.map(...)
# loop's output, that calls onClose on click.
set -euo pipefail

FILE="components/chrome/MobileMenu.tsx"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE not found"
  exit 1
fi

# Find the line where the nav.map(...) loop closes ("})}"), then only inspect
# markup between that line and the closing </ul> — i.e. outside the loop's output.
MAP_START_LINE=$(grep -n 'nav\.map(' "$FILE" | head -1 | cut -d: -f1)
LOOP_END_LINE=$(grep -n '})}' "$FILE" | awk -F: -v start="$MAP_START_LINE" '$1 > start {print $1; exit}')

if [ -z "$LOOP_END_LINE" ]; then
  echo "FAIL: could not locate end of nav.map(...) loop in $FILE"
  exit 1
fi

UL_END_LINE=$(grep -n '</ul>' "$FILE" | awk -F: -v start="$LOOP_END_LINE" '$1 > start {print $1; exit}')

TAIL=$(sed -n "${LOOP_END_LINE},${UL_END_LINE}p" "$FILE")

if ! echo "$TAIL" | grep -qE 'href="/contact"'; then
  echo "FAIL: no href=\"/contact\" found outside the nav.map(...) loop in $FILE"
  exit 1
fi

if ! echo "$TAIL" | grep -qE '<Link'; then
  echo "FAIL: /contact reference outside the loop is not a next/link <Link>"
  exit 1
fi

if ! echo "$TAIL" | grep -qE 'onClick=\{onClose\}'; then
  echo "FAIL: the /contact Link outside the loop does not wire onClick to onClose"
  exit 1
fi

# Confirm Link is imported from next/link (should already be true for the file).
if ! grep -qE "^import Link from 'next/link';" "$FILE"; then
  echo "FAIL: next/link Link import missing from $FILE"
  exit 1
fi

echo "PASS: MobileMenu.tsx renders a next/link Link href=\"/contact\" outside nav.map(...), wired to onClose"
exit 0
