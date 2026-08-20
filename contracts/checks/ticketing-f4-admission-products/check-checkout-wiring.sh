#!/usr/bin/env bash
# A6 — app/api/tickets/checkout/route.ts must actually WIRE effectiveCapacity()/
# isWithinEarlyBirdWindow() into the per-ticketType validation loop, and the early-bird refusal
# must textually precede reserveTicket() — same anchor-ordering technique as
# contracts/checks/ticketing-checkout-orders/check-fail-closed-secret-guard.sh proves for
# RECOVERY_TOKEN_SECRET. A stored-but-ignored field (schema field exists, never read at checkout)
# is the exact failure mode the architect brief's non-negotiable #4 rules out — this check proves
# the wiring, not just the data's existence (A7/A8 already cover that).
#
# On the CURRENT, unmodified tree this fails: neither function is imported/called in route.ts yet.
#
# Run as: bash contracts/checks/ticketing-f4-admission-products/check-checkout-wiring.sh

set -euo pipefail

ROUTE_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)/app/api/tickets/checkout/route.ts"

if [[ ! -f "$ROUTE_FILE" ]]; then
  echo "FAIL: $ROUTE_FILE does not exist."
  exit 1
fi

if ! grep -q 'effectiveCapacity' "$ROUTE_FILE"; then
  echo "FAIL: app/api/tickets/checkout/route.ts never references effectiveCapacity() — the"
  echo "      released-quantity ceiling is stored on the ticketType document but never enforced"
  echo "      at checkout (non-negotiable #4: 'stored and ignored' is not enforcement)."
  exit 1
fi

if ! grep -q 'isWithinEarlyBirdWindow' "$ROUTE_FILE"; then
  echo "FAIL: app/api/tickets/checkout/route.ts never references isWithinEarlyBirdWindow() — the"
  echo "      early-bird cutoff is stored on the ticketType document but never enforced at"
  echo "      checkout."
  exit 1
fi

# The early-bird refusal must appear (as a negated call — `!isWithinEarlyBirdWindow(`) textually
# BEFORE reserveTicket( is called, same as every other precondition in this route (salesOpen,
# gateway readiness, RECOVERY_TOKEN_SECRET) — a guard placed after the reservation attempt cannot
# prevent it.
GUARD_LINE=$(grep -n '!isWithinEarlyBirdWindow(' "$ROUTE_FILE" | head -1 | cut -d: -f1 || true)
CALL_LINE=$(grep -n 'reserveTicket(' "$ROUTE_FILE" | head -1 | cut -d: -f1 || true)

if [[ -z "$GUARD_LINE" ]]; then
  echo "FAIL: no negated '!isWithinEarlyBirdWindow(' guard found — the cutoff must actively REFUSE"
  echo "      the request when the window has closed, not merely be referenced."
  exit 1
fi

if [[ -z "$CALL_LINE" ]]; then
  echo "FAIL: reserveTicket( is not called anywhere in $ROUTE_FILE — nothing to guard yet."
  exit 1
fi

if (( GUARD_LINE > CALL_LINE )); then
  echo "FAIL: the '!isWithinEarlyBirdWindow(' guard (line $GUARD_LINE) appears AFTER reserveTicket("
  echo "      is called (line $CALL_LINE) — too late to prevent the reservation it's meant to block."
  exit 1
fi

echo "PASS: app/api/tickets/checkout/route.ts wires effectiveCapacity() into capacityByType AND"
echo "      refuses (line $GUARD_LINE) ahead of reserveTicket() (line $CALL_LINE) when the"
echo "      early-bird window has closed."
exit 0
