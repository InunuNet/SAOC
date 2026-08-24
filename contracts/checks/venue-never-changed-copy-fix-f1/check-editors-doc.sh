#!/usr/bin/env bash
# A5 — docs/show-visitor-info-for-editors.md quotes the researchLabel tag verbatim for
# Lee-Ann; it must move in lockstep with the researchLabel fix (A1/A2/A6) or the doc goes
# stale the moment the field changes. File-scoped only.
set -euo pipefail

FILE="docs/show-visitor-info-for-editors.md"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE not found"
  exit 1
fi

if grep -qiE 'against the working venue' "$FILE"; then
  echo "FAIL: $FILE still quotes the old researchLabel text ('against the working venue')"
  exit 1
fi

if ! grep -qF "Researched by the web team — not yet confirmed by the show committee" "$FILE"; then
  echo "FAIL: $FILE missing the corrected researchLabel quote"
  exit 1
fi

echo "PASS: $FILE's researchLabel quote matches the corrected field text"
exit 0
