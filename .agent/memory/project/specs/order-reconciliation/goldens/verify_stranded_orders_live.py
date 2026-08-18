#!/usr/bin/env python3
"""
verify_stranded_orders_live.py — order-reconciliation F1, A3.

Proves the detection query's WHERE conditions (status == 'reserved' AND expiresAt < now) are
correct against REAL, production-shaped Firestore data, not just the fake store in
check-detects-stranded-orders.mjs's assumptions about field names/types.

Uses the three orders proven stranded live during mission prove-ticket-purchase-works-end-to-
end-b (see .agent/memory/project/backlog.md "P1 — Stranded 'reserved' orders after a failed
ITN"): booking refs 5KYDSBMT38KX, R06HZ12P06EY, G08QJQK278NY. Resolves each booking ref ->
position (tickets/{bookingRef}) -> orderId -> order (orders/{orderId}), the same two-hop
resolution verify_order_paid.py already uses, and asserts EVERY one of the three:
  - has an order document that exists,
  - order.status == 'reserved' (not 'paid' — i.e. still genuinely stranded, not since fixed
    by hand),
  - order.expiresAt is strictly before the current time (a real Firestore timestampValue,
    not a stub/placeholder).

This is read-only — get_document only, no create/update/delete — same convention as
verify_order_paid.py and _firestore_rest.py's own module docstring ("a verification script
must never mutate the thing it verifies").

A check that merely asserted "these order documents exist" would pass even if status/expiresAt
were wrong types or values, which is exactly the class of defect this project has hit before
(see .agent/memory/project/learned.md, weak-assertion audit). This script fails loudly on
each of those specifically, not just on "not found".

Usage:
  python3 verify_stranded_orders_live.py

Exit codes:
  0 = all three known stranded orders are still present, 'reserved', and expiresAt < now.
  1 = a real, provable failure — one or more orders missing, not 'reserved', or expiresAt not
      in the past (including the case where a real human/dev has since manually fixed one,
      which is itself worth knowing before this contract is scored green).
  2 = setup/auth failure unrelated to the defect under test.
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[6]
sys.path.insert(0, str(REPO_ROOT / "execution" / "checks"))

from _firestore_rest import FirestoreSetupError, connect  # noqa: E402

TICKETS_COLLECTION = "tickets"
ORDERS_COLLECTION = "orders"
RESERVED_STATUS = "reserved"

KNOWN_STRANDED_BOOKING_REFS = ["5KYDSBMT38KX", "R06HZ12P06EY", "G08QJQK278NY"]


def fail_setup(message: str) -> int:
    print(f"SETUP FAILURE: {message}", file=sys.stderr)
    return 2


def parse_timestamp(value: str) -> datetime:
    # Firestore REST timestampValue is RFC3339, e.g. '2026-08-18T19:26:00.123456Z'.
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def main() -> int:
    try:
        client = connect()
    except FirestoreSetupError as exc:
        return fail_setup(str(exc))

    now = datetime.now(timezone.utc)
    failures: list[str] = []

    for booking_ref in KNOWN_STRANDED_BOOKING_REFS:
        try:
            position = client.get_document(TICKETS_COLLECTION, booking_ref)
        except FirestoreSetupError as exc:
            return fail_setup(str(exc))

        if position is None:
            failures.append(f"{booking_ref}: no position document at tickets/{booking_ref}")
            continue

        order_id = position.get("orderId")
        if not order_id:
            failures.append(f"{booking_ref}: position has no orderId")
            continue

        try:
            order = client.get_document(ORDERS_COLLECTION, order_id)
        except FirestoreSetupError as exc:
            return fail_setup(str(exc))

        if order is None:
            failures.append(f"{booking_ref}: order {ORDERS_COLLECTION}/{order_id} does not exist")
            continue

        status = order.get("status")
        if status != RESERVED_STATUS:
            failures.append(
                f"{booking_ref}: order {order_id}.status={status!r}, expected 'reserved' — "
                "either the stranded-order bug has already been hand-fixed for this order, or "
                "the fixture set is stale; either way this golden's premise no longer holds"
            )
            continue

        expires_at_raw = order.get("expiresAt")
        if not expires_at_raw:
            failures.append(f"{booking_ref}: order {order_id} has no expiresAt")
            continue

        expires_at = parse_timestamp(expires_at_raw)
        if expires_at >= now:
            failures.append(
                f"{booking_ref}: order {order_id}.expiresAt={expires_at.isoformat()} is NOT "
                f"before now ({now.isoformat()}) — this order is not actually stranded, it's a "
                "live/in-progress checkout, which the detection query must never flag"
            )
            continue

        print(f"OK: {booking_ref} -> order {order_id} is 'reserved' with expiresAt in the past")

    if failures:
        for f in failures:
            print(f"FAIL: {f}")
        print(f"\n{len(failures)} of {len(KNOWN_STRANDED_BOOKING_REFS)} known stranded order(s) failed.")
        return 1

    print(
        f"\nPASS: all {len(KNOWN_STRANDED_BOOKING_REFS)} known stranded orders are 'reserved' "
        "with expiresAt in the past — real production-shaped data the detection query must catch."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
