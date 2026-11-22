#!/usr/bin/env bash
# A6 — app/api/tickets/checkout/route.ts must actually WIRE computeShowDays()/
# isValidChosenDay()/isNamedAttendeeSatisfied() into its per-line-item validation pass, read
# requiresDaySelection/requiresAttendeeNames from the fetched ticketType doc, source the show's
# date window from activeShowWindowQuery, and both new guards must textually precede
# reserveTicket( — same anchor-ordering technique
# contracts/checks/ticketing-checkout-orders/check-fail-closed-secret-guard.sh already proves for
# RECOVERY_TOKEN_SECRET, and contracts/checks/ticketing-f4-admission-products/
# check-checkout-wiring.sh already proves for the early-bird guard. A stored-but-ignored field is
# the same failure mode F4's non-negotiable #4 already ruled out for this route.
#
# (Historical: written before the wiring existed; it now passes on the real tree.)
#
# Run as: bash contracts/checks/ticketing-f5-day-attendees/check-checkout-wiring.sh

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

grep -q 'activeShowWindowQuery' "$ROUTE_FILE" || fail \
  "app/api/tickets/checkout/route.ts never references activeShowWindowQuery — the route cannot obtain the active show's startDate/endDate to validate a chosenDay against."

grep -q 'buildShowWindow' "$ROUTE_FILE" || fail \
  "app/api/tickets/checkout/route.ts never references buildShowWindow() — the show's raw date fields are never turned into a ShowWindow."

grep -q 'computeShowDays\|isValidChosenDay' "$ROUTE_FILE" || fail \
  "app/api/tickets/checkout/route.ts never references computeShowDays()/isValidChosenDay() — requiresDaySelection is stored on the ticketType document but never enforced at checkout."

grep -q 'isNamedAttendeeSatisfied' "$ROUTE_FILE" || fail \
  "app/api/tickets/checkout/route.ts never references isNamedAttendeeSatisfied() — requiresAttendeeNames is stored on the ticketType document but never enforced at checkout."

grep -q 'requiresDaySelection' "$ROUTE_FILE" || fail \
  "app/api/tickets/checkout/route.ts never reads requiresDaySelection off the fetched ticketType document."

grep -q 'requiresAttendeeNames' "$ROUTE_FILE" || fail \
  "app/api/tickets/checkout/route.ts never reads requiresAttendeeNames off the fetched ticketType document."

# Both refusal guards must appear (as negated calls) textually BEFORE reserveTicket( is called —
# a guard placed after the reservation attempt cannot prevent it.
# Matched on comment-stripped CODE with code_lines.py, and the call anchor is the real
# `await reserveTicket(`: the first plain `reserveTicket(` in the file is a doc comment (the
# line-item type's JSDoc), far above both guards, so the old anchor reported every guard as "after"
# the reservation. A comment can satisfy neither a guard nor the call anchor now.
CODE_LINES="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)/contracts/checks/payment-seam-f2/code_lines.py"
first_code() {  # echoes the first CODE line number containing the literal, or nothing
  local out rc
  out=$(python3 "$CODE_LINES" --first "$ROUTE_FILE" "$1") && rc=0 || rc=$?
  [[ "$rc" -le 1 ]] || fail "(INSTRUMENT) code_lines.py failed while scanning for '$1'."
  echo "$out"
}
DAY_GUARD_LINE=$(first_code '!isValidChosenDay(')
NAME_GUARD_LINE=$(first_code '!isNamedAttendeeSatisfied(')
CALL_LINE=$(first_code 'await reserveTicket(')

[[ -n "$DAY_GUARD_LINE" ]] || fail \
  "no negated '!isValidChosenDay(' guard found — an out-of-window chosenDay must actively REFUSE the request, not merely be referenced."

[[ -n "$NAME_GUARD_LINE" ]] || fail \
  "no negated '!isNamedAttendeeSatisfied(' guard found — a missing required attendee name must actively REFUSE the request, not merely be referenced."

[[ -n "$CALL_LINE" ]] || fail "'await reserveTicket(' is not called anywhere in $ROUTE_FILE — nothing to guard yet."

if (( DAY_GUARD_LINE > CALL_LINE )); then
  fail "the '!isValidChosenDay(' guard (line $DAY_GUARD_LINE) appears AFTER reserveTicket( (line $CALL_LINE) — too late to prevent the reservation it's meant to block."
fi

if (( NAME_GUARD_LINE > CALL_LINE )); then
  fail "the '!isNamedAttendeeSatisfied(' guard (line $NAME_GUARD_LINE) appears AFTER reserveTicket( (line $CALL_LINE) — too late to prevent the reservation it's meant to block."
fi

echo "PASS: app/api/tickets/checkout/route.ts sources the show window from activeShowWindowQuery/buildShowWindow(), reads requiresDaySelection/requiresAttendeeNames per ticket type, and refuses (lines $DAY_GUARD_LINE/$NAME_GUARD_LINE) ahead of reserveTicket() (line $CALL_LINE) when a chosenDay is invalid or a required attendee name is missing."
exit 0
