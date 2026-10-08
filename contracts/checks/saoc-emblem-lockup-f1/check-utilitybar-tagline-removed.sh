#!/usr/bin/env bash
# A13 — Brad, 2026-10-08 (relayed by the NOS design peer), verbatim: "remove
# Making a difference since 1968 from the header its already in the logo,
# small changes". The centred tagline span in UtilityBar.tsx goes; the email
# (left) and the two right-side pills ("National Show" pill + "Join a
# society") stay exactly where they are — this check guards that the rest of
# the bar's layout mechanism (the flex row + justify-between) is untouched,
# not just that the tagline string disappeared.
set -euo pipefail

FILE="components/chrome/UtilityBar.tsx"

grep -q "Making a difference since 1968" "$FILE" && {
  echo "UtilityBar.tsx still contains the centred tagline — must be removed"
  exit 1
}

grep -qE 'href="mailto:' "$FILE" || { echo "email link missing from UtilityBar.tsx"; exit 1; }
grep -q "Join a society" "$FILE" || { echo "'Join a society' pill missing"; exit 1; }
grep -q "showPillLabel" "$FILE" || { echo "National Show pill missing"; exit 1; }
grep -q "justify-between" "$FILE" || { echo "layout row (justify-between) missing — layout mechanism regressed"; exit 1; }

echo "OK: UtilityBar.tsx tagline removed, email/pills/layout unchanged"
