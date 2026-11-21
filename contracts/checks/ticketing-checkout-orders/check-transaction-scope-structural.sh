#!/usr/bin/env bash
# ticketing-checkout-orders (architect contract) — structural (source-level) proof that the
# order/position pair-write stays INSIDE the same already-open, capacity-and-duplicate-guarded
# transaction the reservation logic uses, and is reachable ONLY from the fresh-reservation branch
# — never from the idempotent-replay branch.
#
# What this proves, and only this: every CALL to a reservation pair writer
# (writeMultiReservationPair(), the one checkout uses, and the legacy writeReservationPair(),
# which lib/checkout-reservation.ts still exports) in app/ and lib/ is in
# app/api/tickets/checkout/route.ts, textually inside the `db.runTransaction(async (transaction)
# => { ... })` callback that performs the capacity read and the idempotencyKey duplicate probe, and
# textually AFTER the `if (!duplicate.empty)` early-return block (i.e. unreachable on a replay).
# writeMultiReservationPair() must be called exactly once there.
#
# DEFEATING MUTATION #1 this check kills: pulling the order/position write OUT of the transaction
# (a direct `.create(...)` after `db.runTransaction(...)` resolves, or a call to either writer
# placed outside the callback). That reintroduces the unguarded read-then-write race.
#
# DEFEATING MUTATION #2 this check kills: a call added to the replay branch, or a second call
# anywhere (a duplicate order for one retried checkout).
#
# DEFEATING MUTATION #3 this check kills: a call to either writer from some other file in app/ or
# lib/, which would write reservations outside the route's guarded transaction.
#
# NOTE (repaired 2026-11-22): checkout moved from writeReservationPair() to the multi-line-item
# writeMultiReservationPair() (multi-line-item-cart); the property is unchanged, and the legacy
# writer is now covered too.
#
# Run as: bash contracts/checks/ticketing-checkout-orders/check-transaction-scope-structural.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ROUTE_FILE="$ROOT/app/api/tickets/checkout/route.ts"
DEFINITION_FILE="lib/checkout-reservation.ts"
# A call, not an import or a name in prose: the writer name directly followed by "(", not part of a
# longer identifier. Comment lines are dropped before matching.
CALL_PATTERN='(^|[^A-Za-z0-9_])write(Multi)?ReservationPair\('

if [[ ! -f "$ROUTE_FILE" ]]; then
  echo "FAIL: $ROUTE_FILE does not exist."
  exit 1
fi

# Calls anywhere in app/ and lib/ other than the writers' own definitions.
OTHER_CALLS=$(cd "$ROOT" && grep -rnE "$CALL_PATTERN" app lib --include='*.ts' --include='*.tsx' \
  | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' \
  | grep -v "^$DEFINITION_FILE:" \
  | grep -v '^app/api/tickets/checkout/route.ts:' || true)
if [[ -n "$OTHER_CALLS" ]]; then
  echo "FAIL: a reservation pair writer is called outside app/api/tickets/checkout/route.ts:"
  echo "$OTHER_CALLS" | sed 's/^/      /'
  echo "      Reservations must only be written inside the checkout route's guarded transaction."
  exit 1
fi

ROUTE_CALLS=$(grep -nE "$CALL_PATTERN" "$ROUTE_FILE" | grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' || true)
if [[ -z "$ROUTE_CALLS" ]]; then
  echo "FAIL: no call to writeMultiReservationPair() in $ROUTE_FILE (the write was never wired in)."
  exit 1
fi

TOTAL_COUNT=$(echo "$ROUTE_CALLS" | grep -c . || true)
MULTI_COUNT=$(echo "$ROUTE_CALLS" | grep -c 'writeMultiReservationPair(' || true)
if [[ "$TOTAL_COUNT" -ne 1 || "$MULTI_COUNT" -ne 1 ]]; then
  echo "FAIL: expected exactly one writer call in $ROUTE_FILE, and it must be writeMultiReservationPair();"
  echo "      found $TOTAL_COUNT call(s) of either writer, $MULTI_COUNT of writeMultiReservationPair()."
  echo "      (A legacy writeReservationPair() or a second call may sit in the replay branch or a second"
  echo "      branch, writing a duplicate order for one retried checkout.)"
  exit 1
fi

TRANSACTION_OPEN_LINE=$(grep -n 'db\.runTransaction(' "$ROUTE_FILE" | head -1 | cut -d: -f1)
DUPLICATE_GUARD_LINE=$(grep -n 'if (!duplicate\.empty)' "$ROUTE_FILE" | head -1 | cut -d: -f1)
TRANSACTION_CLOSE_LINE=$(grep -n '{ maxAttempts: TRANSACTION_MAX_ATTEMPTS }' "$ROUTE_FILE" | head -1 | cut -d: -f1)

if [[ -z "$TRANSACTION_OPEN_LINE" || -z "$DUPLICATE_GUARD_LINE" || -z "$TRANSACTION_CLOSE_LINE" ]]; then
  echo "FAIL: could not locate one of the expected anchor lines (db.runTransaction( / if (!duplicate.empty) /"
  echo "      the TRANSACTION_MAX_ATTEMPTS options object) in $ROUTE_FILE — the file's shape has"
  echo "      changed enough that this structural check can no longer be trusted. Re-derive the"
  echo "      anchors rather than deleting this check."
  exit 1
fi

while IFS= read -r call; do
  CALL_LINE="${call%%:*}"
  if (( CALL_LINE < TRANSACTION_OPEN_LINE || CALL_LINE > TRANSACTION_CLOSE_LINE )); then
    echo "FAIL: a reservation pair writer is called on line $CALL_LINE, which is OUTSIDE the"
    echo "      db.runTransaction(...) callback (lines $TRANSACTION_OPEN_LINE-$TRANSACTION_CLOSE_LINE)."
    echo "      The order/position write must happen inside the same transaction as the capacity"
    echo "      read and the idempotency duplicate probe."
    exit 1
  fi
  if (( CALL_LINE < DUPLICATE_GUARD_LINE )); then
    echo "FAIL: a reservation pair writer is called on line $CALL_LINE, which is BEFORE the"
    echo "      'if (!duplicate.empty)' early-return guard on line $DUPLICATE_GUARD_LINE. A fresh"
    echo "      order must never be written before the duplicate-idempotency-key check has had a"
    echo "      chance to return early."
    exit 1
  fi
done <<< "$ROUTE_CALLS"

echo "PASS: every call to a reservation pair writer in app/ and lib/ is in"
echo "      app/api/tickets/checkout/route.ts, inside the capacity-and-duplicate-guarded"
echo "      db.runTransaction(...) callback and after the idempotency early-return guard;"
echo "      writeMultiReservationPair() is called exactly once."
exit 0
