#!/usr/bin/env python3
"""
_fetch_ticket_fields.py — thin JSON-emitting helper for verify_confirmation_page.ts (A6).

verify_confirmation_page.ts needs to independently look up a real ticket's attendeeName/
ticketType/bookingRef from live Firestore, without hardcoding expected fixture values (see
that feature's golden — hardcoding would keep the check passing after a rendering regression
if the fixture and the hardcoded value drifted together). Rather than reimplementing the
service-account JWT-bearer REST client in TypeScript, this shells out to the same read-only
_firestore_rest.py helper every Python contract check in this directory already uses, and
prints one JSON object to stdout.

Usage:
  python3 execution/checks/_fetch_ticket_fields.py --booking-ref <REF>

Exit codes:
  0 = document found, JSON printed to stdout: {"attendeeName": ..., "ticketType": ..., "bookingRef": ...}
  1 = document does not exist for that booking ref (a real "not found", not a setup problem).
  2 = setup/auth failure unrelated to the defect under test.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _firestore_rest import FirestoreSetupError, connect  # noqa: E402

TICKETS_COLLECTION = "tickets"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--booking-ref", required=True)
    args = parser.parse_args()

    try:
        client = connect()
        doc = client.get_document(TICKETS_COLLECTION, args.booking_ref)
    except FirestoreSetupError as exc:
        print(f"SETUP FAILURE: {exc}", file=sys.stderr)
        return 2

    if doc is None:
        print(f"NOT FOUND: no document at {TICKETS_COLLECTION}/{args.booking_ref}", file=sys.stderr)
        return 1

    print(
        json.dumps(
            {
                "attendeeName": doc.get("attendeeName"),
                "ticketType": doc.get("ticketType"),
                "bookingRef": doc.get("bookingRef"),
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
