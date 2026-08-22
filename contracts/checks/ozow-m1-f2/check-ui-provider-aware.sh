#!/usr/bin/env bash
# A9 — THE UI ACTUALLY SENDS providerId, AND STOPS HARDCODING "PayFast" UNCONDITIONALLY. A2 proves
# the route rejects a missing/invalid providerId; that is only a real fix for a buyer if the
# checkout POST body actually carries one. Reading components/tickets/ for this contract also
# found two pre-existing strings hardcoded to PayFast's name that F2 must not leave unconditional
# once a second gateway is choosable — see contracts/golden/ozow-m1-f2/README.md §6.
#
# WHAT MAKES THIS FAIL: useTicketCart.ts's checkout POST body never mentioning `providerId`
# (buyers could never reach 'ozow' no matter what the route allows); CheckoutRedirectNotice.tsx's
# hand-off copy or TicketPurchaseForm.tsx's submit-button label still containing the literal
# string "PayFast" with no surrounding conditional/parametrisation (a template literal or ternary
# referencing a provider-name variable is fine; a bare string is not).
#
# Run as: bash contracts/checks/ozow-m1-f2/check-ui-provider-aware.sh

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

FAIL=0
fail() { echo "FAIL: $1"; FAIL=1; }

CART="components/tickets/useTicketCart.ts"
NOTICE="components/tickets/CheckoutRedirectNotice.tsx"
FORM="components/tickets/TicketPurchaseForm.tsx"

[ -f "$CART" ] || { fail "$CART does not exist"; }
if [ -f "$CART" ]; then
  grep -q 'providerId' "$CART" || fail "$CART's checkout POST body never mentions providerId — the UI can never select a gateway"
fi

for f in "$NOTICE" "$FORM"; do
  [ -f "$f" ] || { fail "$f does not exist"; continue; }
  # A bare/unconditional "PayFast" string: present, and NOT parametrised by a provider-name
  # variable. Heuristic: flag any line containing the literal "PayFast" that does NOT also
  # reference `providerId` or a template `${` interpolation on the same line — deliberately NOT
  # exempting a bare ternary (`cond ? 'Redirecting to PayFast…' : label` still hardcodes the
  # string on one branch; only a ternary/template that substitutes a PROVIDER NAME counts).
  hits=$(grep -n 'PayFast' "$f" || true)
  if [ -n "$hits" ]; then
    bad=$(echo "$hits" | grep -vE 'providerId|\$\{' || true)
    if [ -n "$bad" ]; then
      echo "$bad"
      fail "$f still hardcodes 'PayFast' unconditionally (see line(s) above)"
    fi
  fi
done

if [ "$FAIL" -ne 0 ]; then
  echo "OVERALL: FAIL"
  exit 1
fi
echo "OVERALL: PASS — UI sends providerId and no longer hardcodes PayFast unconditionally."
