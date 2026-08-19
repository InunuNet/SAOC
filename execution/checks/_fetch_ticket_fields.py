#!/usr/bin/env python3
"""
_fetch_ticket_fields.py — thin JSON-emitting helper for verify_confirmation_page.ts (A6).

verify_confirmation_page.ts needs to independently look up a real ticket's attendeeName/
ticketType/bookingRef/amount/status from live Firestore, without hardcoding expected fixture
values (see that feature's golden — hardcoding would keep the check passing after a rendering
regression if the fixture and the hardcoded value drifted together). Rather than reimplementing
the service-account JWT-bearer REST client in TypeScript, this shells out to the same read-only
_firestore_rest.py helper every Python contract check in this directory already uses, and prints
one JSON object to stdout.

Two lookup modes, mutually exclusive:
  --booking-ref <REF>  — direct doc.get() by id (used for the paid fixture, and to re-verify a
                          caller-supplied "known reserved" ref hasn't since flipped status).
  --status <STATUS>     — equality query, first match only (used to dynamically discover SOME
                          ticket in a given status, e.g. 'reserved', when no fixed ref is known
                          to still be in that state — see verify_confirmation_page.ts's
                          --reserved-ref fallback).

Usage:
  python3 execution/checks/_fetch_ticket_fields.py --booking-ref <REF>
  python3 execution/checks/_fetch_ticket_fields.py --status <STATUS>

Exit codes:
  0 = document found, JSON printed to stdout:
      {"attendeeName": ..., "ticketType": ..., "bookingRef": ..., "amount": ..., "status": ...}
  1 = no matching document (a real "not found" — for --booking-ref, that exact doc does not
      exist; for --status, no document currently has that status). Not a setup problem.
  2 = setup/auth failure unrelated to the defect under test.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _firestore_rest import FirestoreSetupError, connect  # noqa: E402

TICKETS_COLLECTION = "tickets"


def to_json_fields(doc: dict) -> dict:
    # The document's own bookingRef FIELD is missing on some older fixtures, but the doc id IS
    # the booking ref by convention (see lib/orders.ts) and --booking-ref callers already know
    # it directly; --status (query) results additionally carry it under "_id" (see
    # _firestore_rest.py's query_by_field). Prefer the field when present, fall back to the id.
    return {
        "attendeeName": doc.get("attendeeName"),
        "ticketType": doc.get("ticketType"),
        "bookingRef": doc.get("bookingRef") or doc.get("_id"),
        "amount": doc.get("amount"),
        "status": doc.get("status"),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--booking-ref", help="fetch this exact document by id")
    mode.add_argument("--status", help="fetch the first document with this status (query)")
    args = parser.parse_args()

    try:
        client = connect()
        if args.booking_ref:
            doc = client.get_document(TICKETS_COLLECTION, args.booking_ref)
            if doc is not None:
                doc["_id"] = args.booking_ref  # get_document() doesn't carry its own id back.
        else:
            matches = client.query_by_field(TICKETS_COLLECTION, "status", args.status)
            doc = matches[0] if matches else None
    except FirestoreSetupError as exc:
        print(f"SETUP FAILURE: {exc}", file=sys.stderr)
        return 2

    if doc is None:
        if args.booking_ref:
            print(f"NOT FOUND: no document at {TICKETS_COLLECTION}/{args.booking_ref}", file=sys.stderr)
        else:
            print(f"NOT FOUND: no document in {TICKETS_COLLECTION} with status={args.status!r}", file=sys.stderr)
        return 1

    print(json.dumps(to_json_fields(doc)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
