#!/usr/bin/env bash
# A7 — Header.tsx: new emblem asset wired in, old asset gone, accessible home
# link preserved, derived size (67px) applied, and a new divider-rule element
# exists between the mark and the text block (none exists today — this is
# the single biggest "must fail now" check in this contract).
set -euo pipefail

FILE="components/chrome/Header.tsx"

grep -q "saoc-emblem-lockup" "$FILE" || { echo "Header.tsx does not reference the new emblem asset"; exit 1; }
grep -q "saoc-logo-ink-paper" "$FILE" && { echo "Header.tsx still references the old asset"; exit 1; }
grep -q 'aria-label="South African Orchid Council' "$FILE" || { echo "home link lost its accessible name"; exit 1; }
grep -qE 'width=\{?67\}?' "$FILE" || { echo "Header emblem is not sized to the derived 67px"; exit 1; }

# A new divider rule: some element between the mark and the text block,
# marked decorative (aria-hidden), distinct from the pre-existing markup.
grep -qE 'aria-hidden="true"[^>]*(divider|rule)|(divider|rule)[^>]*aria-hidden="true"' "$FILE" \
  || { echo "no divider-rule element found in Header.tsx"; exit 1; }

echo "OK: Header.tsx wired to new asset, old asset gone, home link accessible, 67px, divider rule present"
