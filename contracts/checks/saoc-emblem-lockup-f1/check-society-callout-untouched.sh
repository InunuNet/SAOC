#!/usr/bin/env bash
# A15 — components/societies/SocietyDetailsCallout.tsx stays OUT of scope:
# Brad answered "info@saoc.co.za header email" for the HEADER specifically
# (UtilityBar + MobileMenu, per team-lead's interpretation); this component
# is a society page's own council-contact callout, not part of the header,
# and he has not been asked about it. Byte-unchanged against the pinned base
# commit, so scope can't creep here without a deliberate contract change.
set -euo pipefail

BASE_COMMIT="67d35581"
FILE="components/societies/SocietyDetailsCallout.tsx"

if ! git merge-base --is-ancestor "$BASE_COMMIT" HEAD 2>/dev/null; then
  echo "pinned base $BASE_COMMIT is not an ancestor of HEAD — diff base is stale, fix the pin"
  exit 1
fi

if ! git diff --quiet "$BASE_COMMIT" -- "$FILE"; then
  echo "$FILE changed since $BASE_COMMIT — out of scope for this feature"
  exit 1
fi

echo "OK: $FILE unchanged since $BASE_COMMIT"
