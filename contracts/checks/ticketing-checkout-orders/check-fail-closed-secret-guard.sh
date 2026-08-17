#!/usr/bin/env bash
# ticketing-checkout-orders (architect contract) — structural proof that checkout fails closed
# (500, before any Firestore write) when RECOVERY_TOKEN_SECRET is missing, mirroring the EXISTING,
# already-shipped guard for PAYFAST_SANDBOX_MERCHANT_ID/_KEY in the same file.
#
# DEFEATING MUTATION this check kills: a implementation that reads
# `process.env.RECOVERY_TOKEN_SECRET` and passes it straight to mintRecoveryToken() with no
# preceding guard. `mintRecoveryToken({ secret: undefined as unknown as string, ... })` would not
# throw — HMAC-SHA256 over an undefined key coerces to the string "undefined" and silently mints a
# well-formed-looking but NEVER-VERIFIABLE-AGAIN token (a fresh empty-string/"undefined" secret
# generated on every cold start would make EVERY previously-minted token's signature comparison
# fail the moment the process restarts) instead of refusing the purchase outright. This is exactly
# the "fail closed, not silently degrade" posture this project's rules mandate, and the same
# posture the merchantId/merchantKey guard already established for this same route.
#
# This is a narrow, source-level check: it proves the GUARD EXISTS and is placed before the write
# path, not that a live request with the env var unset actually returns 500 over HTTP (that would
# require starting a real Next.js server against a live Sanity fetch this contract's hard
# offline/credential-free constraint forbids — see the golden README's "What this contract does NOT
# prove"). check-http-comp-fails-closed.sh (F8) is the precedent for how a HUMAN/future step could
# extend this to a real HTTP round trip if ever needed.
#
# Run as: bash contracts/checks/ticketing-checkout-orders/check-fail-closed-secret-guard.sh

set -euo pipefail

ROUTE_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)/app/api/tickets/checkout/route.ts"

if [[ ! -f "$ROUTE_FILE" ]]; then
  echo "FAIL: $ROUTE_FILE does not exist."
  exit 1
fi

if ! grep -q "RECOVERY_TOKEN_SECRET" "$ROUTE_FILE"; then
  echo "FAIL: app/api/tickets/checkout/route.ts never reads RECOVERY_TOKEN_SECRET — the recovery"
  echo "      token cannot be minted at order-creation time (see golden README 'recoveryToken"
  echo "      minting belongs here')."
  exit 1
fi

# A guard of the shape `if (!recoveryTokenSecret)` (or equivalent falsy check on a variable read
# from RECOVERY_TOKEN_SECRET) must exist and must textually precede the writeReservationPair() call
# site — reuses the same anchor-ordering technique as check-transaction-scope-structural.sh.
GUARD_LINE=$(grep -n 'if (!recoveryTokenSecret)' "$ROUTE_FILE" | head -1 | cut -d: -f1 || true)
CALL_LINE=$(grep -n 'writeReservationPair(' "$ROUTE_FILE" | head -1 | cut -d: -f1 || true)

if [[ -z "$GUARD_LINE" ]]; then
  echo "FAIL: no 'if (!recoveryTokenSecret)' fail-closed guard found in $ROUTE_FILE."
  echo "      Every existing checkout precondition (merchantId, merchantKey, salesOpen, ticket"
  echo "      type validity, active-show match) fails closed with an explicit guard BEFORE any"
  echo "      Firestore write is attempted — the new secret dependency must follow the same"
  echo "      pattern, not a truthy-cast or a try/catch around the mint call."
  exit 1
fi

if [[ -z "$CALL_LINE" ]]; then
  echo "FAIL: writeReservationPair() is not called anywhere in $ROUTE_FILE — nothing to guard yet."
  exit 1
fi

if (( GUARD_LINE > CALL_LINE )); then
  echo "FAIL: the 'if (!recoveryTokenSecret)' guard (line $GUARD_LINE) appears AFTER"
  echo "      writeReservationPair() is called (line $CALL_LINE) — a guard placed after the write"
  echo "      it's meant to prevent cannot prevent it."
  exit 1
fi

echo "PASS: app/api/tickets/checkout/route.ts reads RECOVERY_TOKEN_SECRET and has an"
echo "      'if (!recoveryTokenSecret)' fail-closed guard (line $GUARD_LINE) textually before the"
echo "      writeReservationPair() call site (line $CALL_LINE) — a missing secret refuses the"
echo "      purchase instead of silently minting an unverifiable recovery token."
exit 0
