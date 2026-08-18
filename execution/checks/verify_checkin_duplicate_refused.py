#!/usr/bin/env python3
"""
verify_checkin_duplicate_refused.py — proves, from PERSISTED state alone, that a
second door check-in attempt against an already-admitted booking reference was
recorded and correctly refused, not re-admitted.

Why this exists (see .agent/memory/project/specs/prove-ticket-purchase-works-end-to-
end-b/goldens/f2-f4-purchase-and-checkin.golden.md, "F4 — door check-in", step 6): the
golden requires proving the SECOND submission of the same booking reference is
refused, not re-admitted — i.e. that the admission rule in lib/checkin.ts actually
runs on a second scan, not just on the happy path. This script does NOT perform a
live check-in POST itself — a verification script must not mutate the thing it
verifies. It requires that the F4 protocol's step 6 (submitting the same booking
reference a second time via a real, separately-executed `/api/admin/checkin` call)
has ALREADY happened, and proves it happened correctly by reading:

  1. `tickets/{bookingRef}` (lib/orders.ts's position document) — its `status` field
     must be lib/checkin.ts's real terminal admitted state. Read directly from source
     rather than assumed: `admit()` in lib/checkin.ts writes `status: 'checked-in'`
     (see the `transaction.update(doc.ref, { status: 'checked-in', checkedInAt })`
     call) — that literal string is used below, not guessed.
  2. `checkinAttempts` documents (lib/checkin-audit.ts) for this bookingRef:
       - exactly ONE 'admit' outcome record must exist. lib/checkin.ts's admit()
         function structurally cannot produce a second 'admit' for the same booking
         reference — its own admission check runs `if (status === 'checked-in')
         return refuse('already-checked-in')` BEFORE the paid check, so a duplicate
         attempt against an already-admitted ticket can only ever route to the
         'already-checked-in' refusal branch, never back through the admit path. Two
         'admit' records would mean that structural guarantee itself broke.
       - at least one 'already-checked-in' outcome record must exist, with a
         `scannedAt` timestamp AFTER the 'admit' record's `scannedAt` — proving a
         later, distinct attempt hit the refusal branch specifically because the
         ticket was already checked in (not some unrelated refusal reason).

Usage:
  python3 execution/checks/verify_checkin_duplicate_refused.py --booking-ref <REF>

Exit codes:
  0 = the position is in the checked-in terminal state, exactly one 'admit' audit
      record exists, and at least one 'already-checked-in' audit record exists with a
      later scannedAt — proving a duplicate attempt was made, recorded, and refused.
  1 = a real, provable failure: no admit record (never actually admitted), more than
      one admit record (the admission rule failed to block a re-admission), no later
      'already-checked-in' record (no second attempt was ever made, or it was refused
      for a different reason, or the audit write for it failed), or the position is
      not in the checked-in state.
  2 = setup/auth failure unrelated to the defect under test.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _firestore_rest import FirestoreSetupError, connect  # noqa: E402

TICKETS_COLLECTION = "tickets"
CHECKIN_ATTEMPTS_COLLECTION = "checkinAttempts"
ADMIT_OUTCOME = "admit"
ALREADY_CHECKED_IN_OUTCOME = "already-checked-in"
# lib/checkin.ts's admit(): `transaction.update(doc.ref, { status: 'checked-in', ... })` —
# read directly from source, not assumed (the golden explicitly warns against assuming).
CHECKED_IN_STATUS = "checked-in"


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
        position = client.get_document(TICKETS_COLLECTION, booking_ref)
    except FirestoreSetupError as exc:
        return fail_setup(str(exc))

    if position is None:
        print(f"FAIL: no position document at {TICKETS_COLLECTION}/{booking_ref}")
        return 1

    position_status = position.get("status")
    if position_status != CHECKED_IN_STATUS:
        print(
            f"FAIL: position {TICKETS_COLLECTION}/{booking_ref}.status={position_status!r}, "
            f"expected {CHECKED_IN_STATUS!r} — the ticket was never actually admitted, so a "
            "'duplicate refused' claim cannot be evaluated"
        )
        return 1

    try:
        attempts = client.query_by_field(CHECKIN_ATTEMPTS_COLLECTION, "bookingRef", booking_ref)
    except FirestoreSetupError as exc:
        return fail_setup(str(exc))

    admit_records = [a for a in attempts if a.get("outcome") == ADMIT_OUTCOME]
    refused_records = [a for a in attempts if a.get("outcome") == ALREADY_CHECKED_IN_OUTCOME]

    if not admit_records:
        print(
            f"FAIL: position is '{CHECKED_IN_STATUS}' but no {CHECKIN_ATTEMPTS_COLLECTION} "
            f"record with outcome='{ADMIT_OUTCOME}' exists for bookingRef={booking_ref!r} — "
            "cannot establish a baseline first admission to compare a duplicate against"
        )
        return 1

    if len(admit_records) > 1:
        print(
            f"FAIL: {len(admit_records)} outcome='{ADMIT_OUTCOME}' records exist for "
            f"bookingRef={booking_ref!r} — lib/checkin.ts's admission rule should make a second "
            "admit of an already-checked-in ticket structurally impossible; this many admits "
            "means that guarantee broke"
        )
        return 1

    if not refused_records:
        print(
            f"FAIL: exactly one admit exists for bookingRef={booking_ref!r}, but no "
            f"{CHECKIN_ATTEMPTS_COLLECTION} record with outcome='{ALREADY_CHECKED_IN_OUTCOME}' "
            "exists — either the required second (duplicate) submission was never actually "
            "made, or it was made but the audit write for it failed "
            "(see lib/checkin-audit.ts's logAuditWriteFailure), or it was refused for a "
            "different reason. This script does not perform that second submission itself; "
            "the F4 protocol's step 6 must have run first."
        )
        return 1

    admit_time = str(admit_records[0].get("scannedAt") or "")
    later_refusals = [r for r in refused_records if str(r.get("scannedAt") or "") > admit_time]

    if not later_refusals:
        print(
            f"FAIL: {len(refused_records)} '{ALREADY_CHECKED_IN_OUTCOME}' record(s) exist for "
            f"bookingRef={booking_ref!r}, but none has a scannedAt after the admit record's "
            f"scannedAt ({admit_time!r}) — cannot confirm the refusal happened AFTER, and "
            "because of, the admission (rather than before it, or as an unrelated record)"
        )
        return 1

    refusal = later_refusals[0]
    print(
        f"OK: position {TICKETS_COLLECTION}/{booking_ref} is '{CHECKED_IN_STATUS}'; exactly one "
        f"'{ADMIT_OUTCOME}' record exists (scannedAt={admit_time!r}); a later "
        f"'{ALREADY_CHECKED_IN_OUTCOME}' record exists (scannedAt={refusal.get('scannedAt')!r}, "
        f"scannedByUid={refusal.get('scannedByUid')!r}) — the duplicate submission was made, "
        "recorded, and correctly refused, not re-admitted."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
