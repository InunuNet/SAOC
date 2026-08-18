#!/usr/bin/env python3
"""
verify_stranded_orders_live.py — order-reconciliation F1, A3.

Proves the detection query's WHERE conditions (status == 'reserved' AND expiresAt < now) are
correct against REAL, production-shaped Firestore data, not just the fake store in
check-detects-stranded-orders.mjs's assumptions about field names/types.

REWRITTEN (2026-08-19) to discover live-stranded orders DYNAMICALLY via the real composite
query, rather than resolving a hardcoded list of booking refs. The original version hardcoded
three booking refs transcribed from the P1 backlog entry; the backlog entry itself had dropped
the `SAOC-2027-` prefix (see lib/booking-ref.ts's BOOKING_REF_PREFIX) in transcription, so the
hardcoded refs never matched a real tickets/{bookingRef} document and this check failed on a
stale fixture, not a real defect. A fourth stranded test order (buyerEmail
'e2e-test@example.com', a different booking ref again) also turned up live, which a hardcoded
list would have simply missed. Discovering the target set from the query itself, then asserting
properties on whatever it returns, makes this check immune to that whole class of staleness —
see this golden directory's README "A3 is dynamic; A4's write leash is not (on purpose)" for the
reasoning split between this file and check-live-detect-and-mark.mjs.

Runs the SAME shape of query lib/reconciliation.ts's findStrandedOrders() runs (a Firestore
structuredQuery composite AND filter: status == 'reserved', expiresAt < now) directly against
the Firestore v1 REST API, via _firestore_rest.py's connect()/decode_fields() plumbing but with
a local, read-only runQuery POST — _firestore_rest.py's own FirestoreClient deliberately only
exposes equality queries (query_by_field), so the composite less-than filter this check needs is
built here rather than widening that shared, deliberately narrow module.

Read-only — one POST to Firestore's :runQuery endpoint, which is a query, not a write. No
create/update/delete anywhere in this file, same convention as verify_order_paid.py and
_firestore_rest.py's own module docstring ("a verification script must never mutate the thing it
verifies").

A check that merely asserted "the query returns something" would pass even if it returned
already-paid orders or live in-progress checkouts. This one asserts, on EVERY document the query
returns: status == 'reserved' (not 'paid') and expiresAt is strictly before the query's own
`now` (a real Firestore timestampValue, not a stub/placeholder, and not a live/in-progress
checkout whose expiry hasn't passed yet). It also asserts the result set is non-empty — an empty
result on a project with known, real E2E test fixtures sitting stranded is itself worth failing
loudly on, not a silent pass.

Usage:
  python3 verify_stranded_orders_live.py

Exit codes:
  0 = the composite query returned at least one order, and every order returned is genuinely
      'reserved' with expiresAt in the past.
  1 = a real, provable failure — the query returned zero orders, or returned an order that is
      NOT 'reserved' or whose expiresAt is not actually in the past (either would mean the
      query's own WHERE conditions, or the REST request built here, are wrong).
  2 = setup/auth failure unrelated to the defect under test.
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parents[6]
sys.path.insert(0, str(REPO_ROOT / "execution" / "checks"))

from _firestore_rest import FirestoreSetupError, connect, decode_fields  # noqa: E402

ORDERS_COLLECTION = "orders"
RESERVED_STATUS = "reserved"
HTTP_TIMEOUT_SECONDS = 30


def fail_setup(message: str) -> int:
    print(f"SETUP FAILURE: {message}", file=sys.stderr)
    return 2


def parse_timestamp(value: str) -> datetime:
    # Firestore REST timestampValue is RFC3339, e.g. '2026-08-18T19:26:00.123456Z'.
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def query_reserved_and_expired(client, now: datetime) -> list[dict]:
    """Read-only composite query: status == 'reserved' AND expiresAt < now. Mirrors the exact
    WHERE conditions lib/reconciliation.ts's findStrandedOrders() runs. Returns each matched
    order document's fields plus its Firestore document id under '_id'."""
    now_iso = now.isoformat().replace("+00:00", "Z")
    body = {
        "structuredQuery": {
            "from": [{"collectionId": ORDERS_COLLECTION}],
            "where": {
                "compositeFilter": {
                    "op": "AND",
                    "filters": [
                        {
                            "fieldFilter": {
                                "field": {"fieldPath": "status"},
                                "op": "EQUAL",
                                "value": {"stringValue": RESERVED_STATUS},
                            }
                        },
                        {
                            "fieldFilter": {
                                "field": {"fieldPath": "expiresAt"},
                                "op": "LESS_THAN",
                                "value": {"timestampValue": now_iso},
                            }
                        },
                    ],
                }
            },
        }
    }
    try:
        response = requests.post(
            f"{client._base}:runQuery", headers=client._headers, json=body, timeout=HTTP_TIMEOUT_SECONDS
        )
    except requests.RequestException as exc:
        raise FirestoreSetupError(f"composite query on {ORDERS_COLLECTION} failed: {exc}") from exc

    if response.status_code != 200:
        raise FirestoreSetupError(
            f"composite query on {ORDERS_COLLECTION} failed: HTTP {response.status_code} "
            f"{response.text[:500]} — a MISSING COMPOSITE INDEX on orders(status, expiresAt) "
            "presents as a non-200 here (Firestore returns FAILED_PRECONDITION with an index-"
            "creation link); see this golden directory's README 'Infra dependency' note."
        )

    documents = []
    for entry in response.json():
        document = entry.get("document")
        if not document:
            continue
        fields = decode_fields(document.get("fields", {}))
        fields["_id"] = document["name"].split("/")[-1]
        documents.append(fields)
    return documents


def main() -> int:
    try:
        client = connect()
    except FirestoreSetupError as exc:
        return fail_setup(str(exc))

    now = datetime.now(timezone.utc)

    try:
        stranded_orders = query_reserved_and_expired(client, now)
    except FirestoreSetupError as exc:
        return fail_setup(str(exc))

    if not stranded_orders:
        print(
            "FAIL: the composite query (status=='reserved' AND expiresAt<now) returned ZERO "
            "orders. This project has known, real E2E test fixtures that stay stranded until "
            "manually cleaned up (see .agent/memory/project/backlog.md 'P1 — Stranded "
            "\"reserved\" orders after a failed ITN') — an empty result here means either they "
            "were cleaned up (update this golden's premise) or the query itself is broken."
        )
        return 1

    failures: list[str] = []
    for order in stranded_orders:
        order_id = order["_id"]
        status = order.get("status")
        if status != RESERVED_STATUS:
            failures.append(f"order {order_id}: status={status!r}, expected 'reserved' (the query's own filter should make this impossible)")
            continue

        expires_at_raw = order.get("expiresAt")
        if not expires_at_raw:
            failures.append(f"order {order_id}: has no expiresAt (the query's own filter should make this impossible)")
            continue

        expires_at = parse_timestamp(expires_at_raw)
        if expires_at >= now:
            failures.append(
                f"order {order_id}: expiresAt={expires_at.isoformat()} is NOT before now "
                f"({now.isoformat()}) — this order is not actually stranded, it's a live/in-"
                "progress checkout, which the detection query must never flag"
            )
            continue

        print(
            f"OK: order {order_id} (m_payment_id={order.get('m_payment_id')!r}, "
            f"buyerEmail={order.get('buyerEmail')!r}) is 'reserved' with expiresAt in the past"
        )

    if failures:
        for f in failures:
            print(f"FAIL: {f}")
        print(f"\n{len(failures)} of {len(stranded_orders)} order(s) returned by the query failed a property check.")
        return 1

    print(
        f"\nPASS: the composite query returned {len(stranded_orders)} order(s), every one "
        "genuinely 'reserved' with expiresAt in the past — real production-shaped data the "
        "detection query must catch, discovered live rather than assumed from a hardcoded list."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
