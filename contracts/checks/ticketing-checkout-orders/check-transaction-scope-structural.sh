#!/usr/bin/env bash
# ticketing-checkout-orders (architect contract) — structural (source-level) proof that the new
# order/position pair-write stays INSIDE the same already-open, capacity-and-duplicate-guarded
# transaction the existing reservation logic already uses, and is reachable ONLY from the fresh-
# reservation branch — never from the idempotent-replay branch.
#
# This is deliberately a narrow, source-level check, not a behavioural one — see the golden
# README's "What this contract does NOT prove" for why a live, two-request idempotency race cannot
# be reproduced offline. What THIS check proves is exactly, and only: writeReservationPair() is
# called from exactly one call site in app/api/tickets/checkout/route.ts, that call site is
# textually inside the `db.runTransaction(async (transaction) => { ... })` callback that already
# performs the capacity read and the idempotencyKey duplicate probe, and it is textually AFTER the
# `if (!duplicate.empty)` early-return block (i.e. unreachable on a replay).
#
# DEFEATING MUTATION #1 this check kills: a "fix" that pulls the order/position write OUT of the
# transaction (e.g. `await db.collection('orders').doc().create(...)` called directly at module
# scope inside reserveTicket(), after `db.runTransaction(...)` resolves) to "simplify" the code.
# That mutation would still pass every other check in this contract (the fake-store atomicity test
# calls writeReservationPair() directly, not through the route) but is a REAL regression: it
# reintroduces the unguarded read-then-write race the existing hardening contract's capacity fix
# already closed once (see app/api/tickets/checkout/route.ts's own comment on reserveTicket()).
#
# DEFEATING MUTATION #2 this check kills: a second call site added to the replay branch (e.g. "also
# write a fresh order on every replay, just in case") — this would create a duplicate order for a
# single retried checkout, the exact bug this whole contract exists to prevent recurring in a new
# form.
#
# Run as: bash contracts/checks/ticketing-checkout-orders/check-transaction-scope-structural.sh

set -euo pipefail

ROUTE_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)/app/api/tickets/checkout/route.ts"

if [[ ! -f "$ROUTE_FILE" ]]; then
  echo "FAIL: $ROUTE_FILE does not exist."
  exit 1
fi

CALL_COUNT=$(grep -c 'writeReservationPair(' "$ROUTE_FILE" || true)
if [[ "$CALL_COUNT" -ne 1 ]]; then
  echo "FAIL: expected exactly one call to writeReservationPair() in $ROUTE_FILE, found $CALL_COUNT."
  echo "      (Zero means the new write was never wired in; more than one means it may have been"
  echo "      added to a second branch, e.g. the replay path — see this script's header.)"
  exit 1
fi

CALL_LINE=$(grep -n 'writeReservationPair(' "$ROUTE_FILE" | head -1 | cut -d: -f1)
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

if (( CALL_LINE < TRANSACTION_OPEN_LINE || CALL_LINE > TRANSACTION_CLOSE_LINE )); then
  echo "FAIL: writeReservationPair() is called on line $CALL_LINE, which is OUTSIDE the"
  echo "      db.runTransaction(...) callback (lines $TRANSACTION_OPEN_LINE-$TRANSACTION_CLOSE_LINE)."
  echo "      The order/position write must happen inside the same transaction as the capacity"
  echo "      read and the idempotency duplicate probe, or the two writes are no longer atomic"
  echo "      with the reservation decision."
  exit 1
fi

if (( CALL_LINE < DUPLICATE_GUARD_LINE )); then
  echo "FAIL: writeReservationPair() is called on line $CALL_LINE, which is BEFORE the"
  echo "      'if (!duplicate.empty)' early-return guard on line $DUPLICATE_GUARD_LINE. A fresh"
  echo "      order must never be written before the duplicate-idempotency-key check has had a"
  echo "      chance to return early."
  exit 1
fi

echo "PASS: writeReservationPair() is called exactly once in app/api/tickets/checkout/route.ts,"
echo "      textually inside the existing capacity-and-duplicate-guarded db.runTransaction(...)"
echo "      callback, and after the idempotency duplicate-key early-return guard — the new"
echo "      order/position write participates in the same atomic, idempotency-guarded transaction"
echo "      the existing reservation logic already uses, and is unreachable from the replay branch."
exit 0
