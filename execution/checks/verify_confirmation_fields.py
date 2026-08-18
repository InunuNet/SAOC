#!/usr/bin/env python3
"""
verify_confirmation_fields.py — A5 for confirmation-page-qr-and-download/contract-f1.yaml.

Proves that, for a given set of real booking references, the `tickets/{bookingRef}` document
in live Firestore actually carries what the confirmation page needs to render (attendeeName,
ticketType, bookingRef, a numeric amount) AND is in a status the page is allowed to treat as
confirmed ('paid' or 'checked-in') — not merely that the fields exist under some other status.
A document sitting at 'reserved' with all four fields populated must still fail this check,
because getConfirmedTicketForDisplay() (lib/orders.ts) is fail-closed on status, not on field
presence alone.

Same REST/OAuth pattern as verify_order_paid.py — no firebase_admin/google-auth SDK installed
in this Python environment, so _firestore_rest.py hand-rolls the service-account JWT-bearer
exchange and calls the Firestore v1 REST API directly. Read-only.

Usage:
  python3 execution/checks/verify_confirmation_fields.py --booking-refs REF1,REF2,REF3

Exit codes:
  0 = every ref passes every check.
  1 = a real, provable failure for at least one ref/field — printed per ref.
  2 = setup/auth failure unrelated to the defect under test (missing/invalid .env.local
      credentials, token exchange failure, unreachable Firestore API).
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _firestore_rest import FirestoreSetupError, connect  # noqa: E402

TICKETS_COLLECTION = "tickets"
CONFIRMED_STATUSES = {"paid", "checked-in"}


def fail_setup(message: str) -> int:
    print(f"SETUP FAILURE: {message}", file=sys.stderr)
    return 2


def check_one(client, booking_ref: str) -> list[str]:
    """Returns a list of failure messages for this booking ref — empty if it fully passes."""
    failures: list[str] = []

    doc = client.get_document(TICKETS_COLLECTION, booking_ref)
    if doc is None:
        return [f"{booking_ref}: no document at {TICKETS_COLLECTION}/{booking_ref}"]

    attendee_name = doc.get("attendeeName")
    if not isinstance(attendee_name, str) or attendee_name.strip() == "":
        failures.append(f"{booking_ref}: attendeeName is not a non-empty string (got {attendee_name!r})")

    ticket_type = doc.get("ticketType")
    if not isinstance(ticket_type, str) or ticket_type.strip() == "":
        failures.append(f"{booking_ref}: ticketType is not a non-empty string (got {ticket_type!r})")

    doc_booking_ref = doc.get("bookingRef")
    if not isinstance(doc_booking_ref, str) or doc_booking_ref.strip() == "":
        failures.append(f"{booking_ref}: bookingRef field is not a non-empty string (got {doc_booking_ref!r})")

    amount = doc.get("amount")
    if not isinstance(amount, (int, float)) or isinstance(amount, bool) or amount <= 0:
        failures.append(f"{booking_ref}: amount is not a positive number (got {amount!r})")

    status = doc.get("status")
    if status not in CONFIRMED_STATUSES:
        failures.append(
            f"{booking_ref}: status={status!r} is not 'paid' or 'checked-in' — the page's "
            "fail-closed lookup would treat this as unconfirmed"
        )

    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--booking-refs",
        required=True,
        help="comma-separated list of real, paid booking references to verify",
    )
    args = parser.parse_args()
    booking_refs = [ref.strip() for ref in args.booking_refs.split(",") if ref.strip()]

    if not booking_refs:
        return fail_setup("--booking-refs produced an empty list")

    try:
        client = connect()
    except FirestoreSetupError as exc:
        return fail_setup(str(exc))

    all_failures: list[str] = []
    for booking_ref in booking_refs:
        try:
            all_failures.extend(check_one(client, booking_ref))
        except FirestoreSetupError as exc:
            return fail_setup(str(exc))

    if all_failures:
        print("FAIL: one or more booking refs failed the confirmation-fields check:")
        for failure in all_failures:
            print(f"  - {failure}")
        return 1

    print(f"OK: all {len(booking_refs)} booking ref(s) have valid confirmation fields and a confirmed status")
    return 0


if __name__ == "__main__":
    sys.exit(main())
