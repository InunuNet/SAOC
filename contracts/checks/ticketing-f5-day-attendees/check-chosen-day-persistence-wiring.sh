#!/usr/bin/env bash
# A14 — Codex GPT-5.5 cross-model finding (2026-08-20), F5 gap 1 (wiring half). Proving
# resolveChosenDayForPosition() exists (A13) is not enough — it must actually be called at the
# ONE place a line item's chosenDay is written into what reserveTicket() persists, or the field
# is stored-but-derived-wrong exactly like the failure mode F4's non-negotiable #4 already ruled
# out for this route. Same anchor-ordering/source-position proof technique as
# check-checkout-wiring.sh (A6).
#
# On the CURRENT, unmodified tree this fails: route.ts's reserveTicket() call still maps
# `chosenDay: lineItem.chosenDay ?? null` unconditionally, never through
# resolveChosenDayForPosition() and never consulting requiresDaySelectionByType.
#
# Run as: bash contracts/checks/ticketing-f5-day-attendees/check-chosen-day-persistence-wiring.sh

set -euo pipefail

ROUTE_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)/app/api/tickets/checkout/route.ts"

if [[ ! -f "$ROUTE_FILE" ]]; then
  echo "FAIL: $ROUTE_FILE does not exist."
  exit 1
fi

fail() {
  echo "FAIL: $1"
  exit 1
}

grep -q 'resolveChosenDayForPosition' "$ROUTE_FILE" || fail \
  "app/api/tickets/checkout/route.ts never references resolveChosenDayForPosition() — a non-day-selection line item's chosenDay can still flow straight through to persistence unstripped."

# The old unconditional pattern must be gone — its presence means the guard was added
# alongside the raw passthrough rather than replacing it.
if grep -qE 'chosenDay:\s*lineItem\.chosenDay\s*\?\?\s*null' "$ROUTE_FILE"; then
  fail "app/api/tickets/checkout/route.ts still contains the unconditional 'chosenDay: lineItem.chosenDay ?? null' passthrough — resolveChosenDayForPosition() must replace it, not sit alongside it unused."
fi

# resolveChosenDayForPosition( must appear at or before the point where the reserveTicket()
# call statement finishes constructing its input — either as a preceding statement (its result
# assigned to a variable that's then passed in) or, as this route does, inline as the chosenDay
# argument INSIDE the reserveTicket({...}) call itself. The latter is the strongest possible
# form of wiring (the raw value cannot structurally reach reserveTicket() without passing through
# the stripping call first), so a strip line that falls textually AFTER 'reserveTicket(' but
# still inside that same call's argument list must PASS, not fail. We bound "inside the call"
# by the try block's 'catch (' line — reserveTicket() is always invoked inside a try, and nothing
# after the call statement but before its catch can be a persistence write that bypassed the
# strip.
STRIP_LINE=$(grep -n 'resolveChosenDayForPosition(' "$ROUTE_FILE" | head -1 | cut -d: -f1 || true)
CALL_LINE=$(grep -n 'await reserveTicket(' "$ROUTE_FILE" | head -1 | cut -d: -f1 || true)

[[ -n "$STRIP_LINE" ]] || fail "no 'resolveChosenDayForPosition(' call found."
[[ -n "$CALL_LINE" ]] || fail "await reserveTicket( is not called anywhere in $ROUTE_FILE — nothing to guard yet."

CATCH_LINE=$(awk -v start="$CALL_LINE" 'NR > start && /catch[[:space:]]*\(/ { print NR; exit }' "$ROUTE_FILE")
[[ -n "$CATCH_LINE" ]] || fail "await reserveTicket( at line $CALL_LINE is not wrapped in a try/catch — cannot bound its call statement."

if (( STRIP_LINE > CATCH_LINE )); then
  fail "the 'resolveChosenDayForPosition(' call (line $STRIP_LINE) appears AFTER the reserveTicket() call statement has finished (catch at line $CATCH_LINE) — too late to prevent an unstripped chosenDay reaching persistence."
fi

echo "PASS: app/api/tickets/checkout/route.ts calls resolveChosenDayForPosition() (line $STRIP_LINE) ahead of or inline within the reserveTicket() call statement (lines $CALL_LINE-$CATCH_LINE), replacing the old unconditional passthrough."
exit 0
