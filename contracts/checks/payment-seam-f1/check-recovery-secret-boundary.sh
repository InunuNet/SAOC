#!/usr/bin/env bash
# A9 — RECOVERY_TOKEN_SECRET IS NOT A PAYMENT-PROVIDER CONCERN.
#
# It mints our own ticket-recovery token (HMAC-SHA256, lib/recovery-token.ts) and has nothing to do
# with any gateway. Its fail-closed guard is also load-bearing BY SOURCE POSITION — another
# contract (contracts/checks/ticketing-checkout-orders/check-fail-closed-secret-guard.sh) proves it
# sits textually before the reservation write. Dragging it across the seam during the move would
# both misplace the responsibility and break that already-green gate.
#
# WHAT MAKES THIS FAIL: lib/payments/ not existing (step 1 hard-fails, so this cannot pass
# vacuously pre-move); the secret name appearing anywhere under lib/payments/; the guard being
# removed from the checkout route.
#
# Run as: bash contracts/checks/payment-seam-f1/check-recovery-secret-boundary.sh
set -uo pipefail

# 1. Positive control FIRST: the directory must exist, or "not found there" is meaningless.
if [ ! -d lib/payments ]; then
  echo "FAIL A9: lib/payments/ does not exist — nothing to check, and a green here would be false."
  exit 1
fi
if [ ! -f lib/payments/payfast.ts ]; then
  echo "FAIL A9: lib/payments/payfast.ts does not exist."
  exit 1
fi

# 2. The secret must not have crossed the seam.
FOUND=$(grep -rn 'RECOVERY_TOKEN_SECRET\|recoveryToken\|mintRecoveryToken' lib/payments/ 2>/dev/null || true)
if [ -n "$FOUND" ]; then
  echo "FAIL A9: recovery-token material found under lib/payments/ — it is not a gateway concern:"
  echo "$FOUND"
  exit 1
fi

# 3. And it must still be guarded where it belongs — BY POSITION, not by presence.
#
#    A bare `grep -q RECOVERY_TOKEN_SECRET` (this step's earlier form) is satisfied by a COMMENT
#    that merely mentions the name. That was harmless while F1's A10 sha-pinned the whole route,
#    but F2 reopens that file and re-cuts the pin, and at that moment a presence grep would be the
#    only local guard left — so it is hardened here rather than inherited. The claim that actually
#    matters is the one contracts/checks/ticketing-checkout-orders/check-fail-closed-secret-guard.sh
#    makes: an unset secret must refuse BEFORE any Firestore write, never mint a
#    never-verifiable-again recovery token. Comment lines are excluded so prose cannot satisfy it.
code_line() {
  awk -v pat="$1" '
    { stripped = $0; sub(/^[ \t]*/, "", stripped)
      if (stripped ~ /^(\/\/|\*|\/\*)/) next
      if ($0 ~ pat) { print NR; exit } }' app/api/tickets/checkout/route.ts
}

GUARD_LINE=$(code_line 'RECOVERY_TOKEN_SECRET')
WRITE_LINE=$(code_line 'reserveTicket[(]')

if [ -z "$GUARD_LINE" ]; then
  echo "FAIL A9: no non-comment line of the checkout route reads RECOVERY_TOKEN_SECRET — the"
  echo "         fail-closed recovery guard is gone (a comment mentioning it does not count)."
  exit 1
fi
if [ -z "$WRITE_LINE" ]; then
  echo "FAIL A9: the checkout route no longer calls reserveTicket() — the guard's position cannot"
  echo "         be judged, so this assertion cannot pass."
  exit 1
fi
if [ "$GUARD_LINE" -ge "$WRITE_LINE" ]; then
  echo "FAIL A9: the RECOVERY_TOKEN_SECRET guard (line $GUARD_LINE) no longer precedes the"
  echo "         reservation write (reserveTicket at line $WRITE_LINE). An unset secret must refuse"
  echo "         before any Firestore write, never mint a never-verifiable-again recovery token."
  exit 1
fi

echo "PASS A9: recovery-token material stayed out of lib/payments/, and its guard sits at line"
echo "         $GUARD_LINE — before the reservation write at line $WRITE_LINE."
