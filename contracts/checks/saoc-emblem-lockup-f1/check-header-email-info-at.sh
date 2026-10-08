#!/usr/bin/env bash
# A14 — Brad's final ruling, 2026-10-08, verbatim: "info@saoc.co.za header
# email" — "the header is info@ everywhere the header shows it. The mobile
# menu is the header on phones, so it's in scope." UtilityBar.tsx and
# MobileMenu.tsx both get the mailto href AND the visible text changed from
# council@saoc.co.za to info@saoc.co.za; neither file may still contain the
# old address. components/societies/SocietyDetailsCallout.tsx is explicitly
# OUT of scope (Brad has not answered for it yet) — guarded separately by A15.
set -euo pipefail

FAIL=0
for f in "components/chrome/UtilityBar.tsx" "components/chrome/MobileMenu.tsx"; do
  if [ ! -f "$f" ]; then
    echo "missing: $f"
    FAIL=1
    continue
  fi
  grep -q "info@saoc.co.za" "$f" || { echo "$f: missing info@saoc.co.za"; FAIL=1; }
  grep -qE 'href="mailto:info@saoc\.co\.za"' "$f" || { echo "$f: mailto href not updated to info@saoc.co.za"; FAIL=1; }
  grep -q "council@saoc.co.za" "$f" && { echo "$f: still contains the old council@saoc.co.za"; FAIL=1; }
done

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

echo "OK: UtilityBar.tsx and MobileMenu.tsx both use info@saoc.co.za (href + text), no council@ remaining"
