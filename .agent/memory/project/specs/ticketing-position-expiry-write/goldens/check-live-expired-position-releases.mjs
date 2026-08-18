#!/usr/bin/env node
// ticketing-position-expiry-write F1, A4 — the live regression proof. This is
// ticketing-capacity-reconciliation-hold's own A4 negative control, lifted out to run
// standalone so it can be proven green BEFORE that contract's feature is even built (its A4
// depends on this being fixed first — see goldens/README.md "Scope decision").
//
// Writes one real reservation through the REAL buildReservationDocs + writeReservationPair
// (lib/checkout-reservation.ts) — the exact primitive the live checkout route uses — with
// expiresAt a few seconds in the past, then asserts the REAL getSoldCountsByTicketType
// (lib/data/tickets.ts) does NOT count it. Reuses
// contracts/checks/ticketing-hardening/_shared.mjs's fixture/lock/manifest/sweep
// infrastructure, same technique as ticketing-capacity-reconciliation-hold's A4.
//
// Run as: npx tsx .agent/memory/project/specs/ticketing-position-expiry-write/goldens/check-live-expired-position-releases.mjs
// Preconditions: .env.local present with Firebase admin credentials. No dev server required.

import { Timestamp } from 'firebase-admin/firestore';
import { getSoldCountsByTicketType } from '../../../../../../lib/data/tickets.ts';
import { buildReservationDocs, writeReservationPair } from '../../../../../../lib/checkout-reservation.ts';
import {
  db,
  sentinelEmail,
  sweepSentinels,
  recordFixtureCreated,
  withCleanup,
  assert,
  TARGET_TICKET_TYPE,
  NATIONAL_SHOW_ID,
} from '../../../../../../contracts/checks/ticketing-hardening/_shared.mjs';

async function heldCount() {
  const counts = await getSoldCountsByTicketType(NATIONAL_SHOW_ID);
  return counts[TARGET_TICKET_TYPE] ?? 0;
}

await withCleanup('A4 a reservation written via the real primitive releases its seat once expired', async () => {
  await sweepSentinels();
  const baseline = await heldCount();

  const runLabel = `pos-expiry-${Date.now()}`;
  const orderId = `sentinel-order-${runLabel}`;
  const bookingRef = `sentinel-pos-${runLabel}`;
  const now = Timestamp.now();
  // A FEW SECONDS in the past, not the real 30-minute TTL — this check must not sleep for
  // the real reservation window to prove release.
  const expiresAt = Timestamp.fromMillis(now.toMillis() - 5000);

  const docs = buildReservationDocs({
    orderId,
    bookingRef,
    showId: NATIONAL_SHOW_ID,
    attendeeName: 'Position Expiry Check',
    attendeeEmail: sentinelEmail(`pos-expiry-${runLabel}`),
    ticketType: TARGET_TICKET_TYPE,
    amount: 0,
    idempotencyKey: `sentinel-${runLabel}`,
    expiresAt,
    recoveryToken: `sentinel-token-${runLabel}`,
    recoveryTokenExpiresAt: Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000),
    now,
  });

  recordFixtureCreated('orders', orderId);
  recordFixtureCreated('tickets', bookingRef);

  const database = db();
  const orderRef = database.collection('orders').doc(orderId);
  const positionRef = database.collection('tickets').doc(bookingRef);
  await database.runTransaction(async (transaction) => {
    writeReservationPair(transaction, { orderRef, positionRef }, docs);
  });

  // Read the position back — proves the field survived a real Firestore round trip as a
  // real Timestamp, not merely that the in-process object had it before writing.
  const written = await positionRef.get();
  assert(written.exists, 'position document was not written');
  assert(
    written.data()?.expiresAt instanceof Timestamp,
    `position.expiresAt did not round-trip through Firestore as a Timestamp — got ${JSON.stringify(written.data()?.expiresAt)}`
  );

  const held = await heldCount();
  assert(
    held === baseline,
    `an expired reservation written via the real checkout primitive should NOT be held (baseline ${baseline}, got ${held}) — expiresAt is not reaching the position, or stillHoldsSeat is not reading it`
  );
});
