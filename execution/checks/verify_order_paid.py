#!/usr/bin/env python3
"""
verify_order_paid.py — proves a real order + its one child position both reached
`status: 'paid'` in live Firestore for a given booking reference.

Why this exists (see .agent/memory/project/specs/prove-ticket-purchase-works-end-to-
end-b/goldens/f2-f4-purchase-and-checkin.golden.md, "F2 — purchase reaches 'paid'"):
the confirmation page's client-side redirect races the server-to-server PayFast ITN by
design and proves nothing on its own. `markOrderAndPositionPaidByPaymentId`
(lib/orders.ts) is a two-write Firestore transaction that flips the order document AND
its position document together. Seeing only one of the two flipped is a real,
distinct bug (a torn write, or a bug in the position lookup/update) — not a timing
artifact — so this script checks both independently and reports which one(s) are
wrong rather than collapsing them into a single pass/fail bit.

Collections (per lib/orders.ts):
  - `tickets/{bookingRef}` — the position. Document id IS the booking reference
    (`tickets.doc(input.bookingRef)`), so it is fetched directly, no query needed.
    Carries `orderId`, pointing at the parent order.
  - `orders/{orderId}` — the order. Id is Firestore-generated, resolved from the
    position's `orderId` field, then fetched directly.

Usage:
  python3 execution/checks/verify_order_paid.py --booking-ref <REF>

Exit codes:
  0 = both the order and its position show status == 'paid'.
  1 = a real, provable failure: the position does not exist, the position has no
      `orderId`, the order does not exist, or either document's status is not 'paid'
      (including the partial-commit case where exactly one of the two flipped).
  2 = setup/auth failure unrelated to the defect under test (missing/invalid
      .env.local credentials, token exchange failure, unreachable Firestore API).
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _firestore_rest import FirestoreSetupError, connect  # noqa: E402

TICKETS_COLLECTION = "tickets"
ORDERS_COLLECTION = "orders"
PAID_STATUS = "paid"


def fail_setup(message: str) -> int:
    print(f"SETUP FAILURE: {message}", file=sys.stderr)
    return 2


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--booking-ref", required=True, help="the position's booking reference")
    args = parser.parse_args()
    booking_ref = args.booking_ref

    try:
        client = connect()
    except FirestoreSetupError as exc:
        return fail_setup(str(exc))

    try:
        position = client.get_document(TICKETS_COLLECTION, booking_ref)
    except FirestoreSetupError as exc:
        return fail_setup(str(exc))

    if position is None:
        print(
            f"FAIL: no position document at {TICKETS_COLLECTION}/{booking_ref} — the purchase "
            "never created a position, or the booking reference is wrong"
        )
        return 1

    position_status = position.get("status")
    order_id = position.get("orderId")

    if not order_id:
        print(
            f"FAIL: position {TICKETS_COLLECTION}/{booking_ref} has no orderId — cannot resolve "
            f"its parent order (position status={position_status!r})"
        )
        return 1

    try:
        order = client.get_document(ORDERS_COLLECTION, order_id)
    except FirestoreSetupError as exc:
        return fail_setup(str(exc))

    if order is None:
        print(
            f"FAIL: position {TICKETS_COLLECTION}/{booking_ref} references order "
            f"{ORDERS_COLLECTION}/{order_id}, which does not exist (position status="
            f"{position_status!r}) — the order/position pair is broken"
        )
        return 1

    order_status = order.get("status")

    order_paid = order_status == PAID_STATUS
    position_paid = position_status == PAID_STATUS

    if order_paid and position_paid:
        print(
            f"OK: order {ORDERS_COLLECTION}/{order_id} and position "
            f"{TICKETS_COLLECTION}/{booking_ref} both show status='paid'"
        )
        return 0

    if order_paid != position_paid:
        # This is the case the golden explicitly calls out: markOrderAndPositionPaidByPaymentId
        # is one transaction updating both documents together. Only one flipped means the
        # transaction did not complete atomically as designed, or something wrote to one
        # document outside that transaction — a real bug, not a timing artifact.
        print(
            "FAIL: PARTIAL COMMIT — the two-write transaction "
            "(markOrderAndPositionPaidByPaymentId) left the order and position in "
            f"DIFFERENT states: order {ORDERS_COLLECTION}/{order_id}.status={order_status!r}, "
            f"position {TICKETS_COLLECTION}/{booking_ref}.status={position_status!r}. This is a "
            "real bug — the transaction is supposed to flip both together or neither."
        )
        return 1

    print(
        f"FAIL: neither the order nor the position is 'paid' yet — order "
        f"{ORDERS_COLLECTION}/{order_id}.status={order_status!r}, position "
        f"{TICKETS_COLLECTION}/{booking_ref}.status={position_status!r}"
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
