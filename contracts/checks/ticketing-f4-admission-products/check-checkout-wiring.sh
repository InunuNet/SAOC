#!/usr/bin/env bash
# A6 — app/api/tickets/checkout/route.ts must actually WIRE effectiveCapacity()/
# resolveEffectivePrice() (which applies isWithinEarlyBirdWindow()) into the per-ticketType validation loop, and the early-bird refusal
# must textually precede reserveTicket() — same anchor-ordering technique as
# contracts/checks/ticketing-checkout-orders/check-fail-closed-secret-guard.sh proves for
# RECOVERY_TOKEN_SECRET. A stored-but-ignored field (schema field exists, never read at checkout)
# is the exact failure mode the architect brief's non-negotiable #4 rules out — this check proves
# the wiring, not just the data's existence (A7/A8 already cover that).
#
# (Historical: written before the wiring existed; it now passes on the real tree.)
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

# RE-POINTED (ticketing-flow-redesign F1): the early-bird window is no longer tested inline in the
# route. The route calls resolveEffectivePrice() (lib/checkout-reservation.ts), which applies
# isWithinEarlyBirdWindow() and yields null when the window has closed and there is no regular
# price; the route refuses on that null. The protection is therefore proven in two halves, both
# matched on comment-stripped CODE (code_lines.py) so a comment cannot satisfy them:
#   route: calls resolveEffectivePrice(, refuses on `effectivePrice === null`, both textually
#          BEFORE `await reserveTicket(`;
#   lib:   resolveEffectivePrice applies isWithinEarlyBirdWindow(input.now, input.earlyBirdCutoff)
#          and, past the window, returns input.regularPrice (null when there is none) — never
#          input.price.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
LIB_FILE="$ROOT/lib/checkout-reservation.ts"
CODE_LINES="$ROOT/contracts/checks/payment-seam-f2/code_lines.py"

[[ -f "$LIB_FILE" ]] || { echo "FAIL: $LIB_FILE does not exist."; exit 1; }

# first_code FILE LITERAL [AFTER] -> line number of first CODE line containing LITERAL, or empty.
# code_lines.py exits 1 with no output for an absence; any other failure aborts the check.
first_code() {
  local out rc
  out=$(python3 "$CODE_LINES" --first "$1" "$2" "${3:-0}") && rc=0 || rc=$?
  if [[ "$rc" -gt 1 ]]; then
    echo "FAIL (INSTRUMENT): code_lines.py failed on $1 looking for '$2'."
    exit 1
  fi
  echo "$out"
}

CALL_LINE=$(first_code "$ROUTE_FILE" 'await reserveTicket(')
PRICE_LINE=$(first_code "$ROUTE_FILE" 'resolveEffectivePrice(')
REFUSE_LINE=$(first_code "$ROUTE_FILE" 'effectivePrice === null' "${PRICE_LINE:-0}")

if [[ -z "$CALL_LINE" ]]; then
  echo "FAIL: 'await reserveTicket(' is not called anywhere in $ROUTE_FILE — nothing to guard yet."
  exit 1
fi
if [[ -z "$PRICE_LINE" ]]; then
  echo "FAIL: $ROUTE_FILE never calls resolveEffectivePrice( — the early-bird cutoff is stored on"
  echo "      the ticketType document but never enforced at checkout."
  exit 1
fi
if [[ -z "$REFUSE_LINE" ]]; then
  echo "FAIL: $ROUTE_FILE calls resolveEffectivePrice( but never refuses on 'effectivePrice === null'"
  echo "      afterwards — a closed window would sail through instead of being refused."
  exit 1
fi
if (( REFUSE_LINE > CALL_LINE )); then
  echo "FAIL: the early-bird refusal (line $REFUSE_LINE) appears AFTER reserveTicket( is called"
  echo "      (line $CALL_LINE) — too late to prevent the reservation it's meant to block."
  exit 1
fi

# Lib half: resolveEffectivePrice must really apply the window and fall back to regularPrice.
DECL_LINE=$(first_code "$LIB_FILE" 'export function resolveEffectivePrice(')
WINDOW_DECL=$(first_code "$LIB_FILE" 'export function isWithinEarlyBirdWindow(')
if [[ -z "$DECL_LINE" || -z "$WINDOW_DECL" ]]; then
  echo "FAIL: lib/checkout-reservation.ts no longer exports resolveEffectivePrice and"
  echo "      isWithinEarlyBirdWindow."
  exit 1
fi
APPLY_LINE=$(first_code "$LIB_FILE" 'isWithinEarlyBirdWindow(input.now, input.earlyBirdCutoff)' "$DECL_LINE")
FALLBACK_LINE=$(first_code "$LIB_FILE" 'return input.regularPrice' "${APPLY_LINE:-$DECL_LINE}")
if [[ -z "$APPLY_LINE" ]]; then
  echo "FAIL: resolveEffectivePrice does not apply isWithinEarlyBirdWindow(input.now,"
  echo "      input.earlyBirdCutoff) — the early-bird window is no longer enforced."
  exit 1
fi
if [[ -z "$FALLBACK_LINE" ]]; then
  echo "FAIL: resolveEffectivePrice no longer falls back to 'return input.regularPrice' after the"
  echo "      window check — a closed window would keep the early-bird price."
  exit 1
fi
if ! python3 "$CODE_LINES" --first "$LIB_FILE" 'now.getTime() < cutoffEndExclusive.getTime()' \
    "$WINDOW_DECL" >/dev/null; then
  echo "FAIL: isWithinEarlyBirdWindow no longer compares now against the cutoff — it cannot close."
  exit 1
fi

echo "PASS: app/api/tickets/checkout/route.ts wires effectiveCapacity() into capacityByType, calls"
echo "      resolveEffectivePrice() (line $PRICE_LINE) and refuses on a null price (line $REFUSE_LINE)"
echo "      ahead of reserveTicket() (line $CALL_LINE); resolveEffectivePrice applies the early-bird"
echo "      window and falls back to regularPrice."
exit 0
