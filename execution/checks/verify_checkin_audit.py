#!/usr/bin/env python3
"""
verify_checkin_audit.py — proves a real `checkinAttempts` audit document exists for a
successful door check-in scan of a given booking reference.

Why this exists (see .agent/memory/project/specs/prove-ticket-purchase-works-end-to-
end-b/goldens/f2-f4-purchase-and-checkin.golden.md, "F4 — door check-in", step 5): the
`/api/admin/checkin` route (app/api/admin/checkin/route.ts) writes one append-only
`checkinAttempts` document (lib/checkin-audit.ts) for EVERY outcome — not just a
successful admission. A 'not-found', 'wrong-show', 'unpaid', 'already-checked-in',
'malformed', or 'infra-error' attempt against this same booking reference also produces
a document carrying this bookingRef (see the route: `bookingRef` is the parsed request
value, populated on every refusal path except when the request never parsed at all).
So "a checkinAttempts doc exists for this bookingRef" alone is a weak check — it would
also pass for a booking reference that was scanned and correctly REFUSED, which is not
what this assertion is proving. This script requires the specific, real-admission
shape: outcome == 'admit' (lib/checkin-audit.ts's CheckinAttemptOutcome), a non-empty
`scannedByUid` (proves a real interactive Firebase Auth admin session performed the
scan, not a synthetic/unauthenticated write), and `bookingRef` equal to the argument.

Usage:
  python3 execution/checks/verify_checkin_audit.py --booking-ref <REF>

Exit codes:
  0 = at least one checkinAttempts document exists with outcome='admit',
      bookingRef==<REF>, and a non-empty scannedByUid.
  1 = no such document exists — either no attempt was recorded at all for this booking
      reference, or every recorded attempt was a refusal, not an admission, or an
      admission was recorded without a scannedByUid (cannot be a real authenticated
      scan).
  2 = setup/auth failure unrelated to the defect under test.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _firestore_rest import FirestoreSetupError, connect  # noqa: E402

CHECKIN_ATTEMPTS_COLLECTION = "checkinAttempts"
ADMIT_OUTCOME = "admit"


def fail_setup(message: str) -> int:
    print(f"SETUP FAILURE: {message}", file=sys.stderr)
    return 2


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--booking-ref", required=True, help="the scanned booking reference")
    args = parser.parse_args()
    booking_ref = args.booking_ref

    try:
        client = connect()
    except FirestoreSetupError as exc:
        return fail_setup(str(exc))

    try:
        attempts = client.query_by_field(CHECKIN_ATTEMPTS_COLLECTION, "bookingRef", booking_ref)
    except FirestoreSetupError as exc:
        return fail_setup(str(exc))

    if not attempts:
        print(
            f"FAIL: no {CHECKIN_ATTEMPTS_COLLECTION} document has bookingRef={booking_ref!r} — "
            "no check-in attempt (admitted or refused) was ever recorded for this booking "
            "reference"
        )
        return 1

    outcomes_seen = sorted({str(attempt.get("outcome")) for attempt in attempts})

    admit_records = [attempt for attempt in attempts if attempt.get("outcome") == ADMIT_OUTCOME]
    if not admit_records:
        print(
            f"FAIL: {len(attempts)} {CHECKIN_ATTEMPTS_COLLECTION} document(s) exist for "
            f"bookingRef={booking_ref!r}, but none has outcome='{ADMIT_OUTCOME}' — outcomes "
            f"recorded were {outcomes_seen}. A refusal audit trail is not proof of a successful "
            "admission scan."
        )
        return 1

    valid_admits = [
        attempt for attempt in admit_records if str(attempt.get("scannedByUid") or "").strip()
    ]
    if not valid_admits:
        print(
            f"FAIL: {len(admit_records)} 'admit' document(s) exist for bookingRef="
            f"{booking_ref!r}, but none has a non-empty scannedByUid — cannot prove a real "
            "authenticated admin session performed the scan"
        )
        return 1

    record = valid_admits[0]
    print(
        f"OK: {CHECKIN_ATTEMPTS_COLLECTION} document exists for bookingRef={booking_ref!r} with "
        f"outcome='{ADMIT_OUTCOME}', scannedByUid={record.get('scannedByUid')!r}, "
        f"scannedAt={record.get('scannedAt')!r}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
