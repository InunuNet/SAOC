#!/bin/sh
# A6 -- inside buildShowOffers the buildHubCards call receives the function's own activeShowId
# parameter, and the page's call site passes resolveActiveShow(...) into buildShowOffers.
set -u
PAGE="app/(nos)/national-show/page.tsx"
FN=$(sed -n '/^function buildShowOffers(/,/^}/p' "$PAGE")
[ -n "$FN" ] || { echo "FAIL buildShowOffers not found"; exit 1; }
printf '%s\n' "$FN" | grep -q '^  activeShowId: string | null$' || { echo "FAIL buildShowOffers lost its activeShowId parameter"; exit 1; }
CALL=$(printf '%s\n' "$FN" | sed -n '/buildHubCards({/,/});/p')
[ -n "$CALL" ] || { echo "FAIL buildShowOffers no longer calls buildHubCards"; exit 1; }
printf '%s\n' "$CALL" | grep -q '^    activeShowId,$' || { echo "FAIL buildShowOffers does not forward activeShowId to buildHubCards"; exit 1; }
grep -qF "buildShowOffers(hubTicketTypes, new Date(), resolveActiveShow(shows ?? []))" "$PAGE" || { echo "FAIL page call site does not pass resolveActiveShow"; exit 1; }
echo "PASS A6 activeShowId forwarded"
