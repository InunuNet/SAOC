#!/usr/bin/env bash
# A1 — scripts/seed-show-visitor-info.ts must (a) contain none of the "venue changed"
# narrative phrases anywhere in the file OUTSIDE the one protected comment block below,
# and (b) contain the exact corrected text for the six live prose fields plus the one
# rewritten code comment. File-scoped only — never grep -r. See
# contracts/golden/venue-never-changed-copy-fix-f1/corrected-fields.golden.md.
set -euo pipefail

FILE="scripts/seed-show-visitor-info.ts"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE not found"
  exit 1
fi

# (a) denylist — case-insensitive, file-scoped, with ONE exclusion: the comment block
# above `const AIRPORT_ROUTES` (currently lines ~163-168) is a NEGATIVE CONTROL owned by
# contracts/contract-venue-prose-residue.yaml's A10, which pins it verbatim — including
# the phrase "city-centre convention centre" — as a dated historical record of the CTICC
# research phase. It is a `//` code comment, never rendered on the live site, so it is
# out of scope for "take any reference to the venue changing off the website." Strip that
# exact block (start marker through its closing "same way" line, inclusive) before
# scanning so A1 and A10 don't fight over the same lines. See
# contracts/golden/venue-never-changed-copy-fix-f1/README.md, "Out of scope".
SCAN_CONTENT="$(awk '
  /^\/\/ The venue changed from the previous working-venue assumption/ { skip=1 }
  skip { if (/^\/\/ same way/) { skip=0 }; next }
  { print }
' "$FILE")"

DENYLIST='venue (has )?changed|no longer applies|previous (guidance|list|working venue)|working venue|for the new venue|against the working venue'
if echo "$SCAN_CONTENT" | grep -inE "$DENYLIST"; then
  echo "FAIL: $FILE still contains 'venue changed' narrative framing outside the A10-protected comment (see matches above)"
  exit 1
fi

# (b) exact corrected strings present
declare -a REQUIRED=(
  "Researched by the web team — not yet confirmed by the show committee"
  "Travel and accommodation guidance for the venue is still being put together; the show committee will confirm the final details."
  "Travel, parking and accommodation guidance for the Stellenbosch Flying Club has not been worked out yet. It will be published here once it is ready."
  "Parking arrangements have not been confirmed."
  "Accommodation guidance for the Stellenbosch area is still being put together."
  "Accessibility details have not been confirmed."
  "travel and accommodation research for the venue has not"
)

for needle in "${REQUIRED[@]}"; do
  if ! grep -qF "$needle" "$FILE"; then
    echo "FAIL: $FILE missing required corrected text: $needle"
    exit 1
  fi
done

echo "PASS: $FILE holds no 'venue changed' framing and contains the corrected text"
exit 0
