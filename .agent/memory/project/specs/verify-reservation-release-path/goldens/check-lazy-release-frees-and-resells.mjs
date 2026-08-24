#!/usr/bin/env node
// verify-reservation-release-path F1, A2 — proves the ACTUAL release mechanism, end to end,
// against the REAL production path a buyer uses.
//
// INVESTIGATION FINDING (architect, 2026-08-24): there is no sweeper, cron, or status write
// that "releases" a reservation. Release is LAZY-ON-READ: lib/data/tickets.ts's
// stillHoldsSeat()/getSoldCountsByTicketType() simply stop counting a `reserved` position the
// instant its `expiresAt` passes. app/api/admin/reconcile-orders/route.ts (the Cloud
// Scheduler-triggered endpoint) is NOT the release mechanism — it only alerts a human
// (docs/order-reconciliation.md, "It flags only. It never settles, cancels, or touches any
// payment/status field."); see check-reconcile-orders-alert-only-not-release.sh for the
// structural proof of that half. This script proves the half that mission care about: that the
// lazy exclusion genuinely frees the seat for a real, subsequent buyer through the real HTTP
// checkout route (app/api/tickets/checkout/route.ts) — not just that a counting function
// returns a smaller number in isolation.
//
// Technique: fill TARGET_TICKET_TYPE to exactly (capacity - 1) with ordinary unexpired
// reserved sentinel seats, then add ONE more reserved seat that is ALREADY EXPIRED (expiresAt a
// few seconds in the past) — simulating an abandoned cart that would, if the release path were
// broken, make the type read as sold out. Then POST a real checkout request through the real
// HTTP route. If the expired seat still held its slot, this POST gets a capacity-rejection (409
// or similar); if the lazy release is working, it gets 201 — genuine proof the seat was resold.
//
// Run as: npx tsx .agent/memory/project/specs/verify-reservation-release-path/goldens/check-lazy-release-frees-and-resells.mjs
// Preconditions: .env.local present with Firebase admin + Sanity credentials; a dev server
// running at CHECK_BASE_URL (default http://localhost:3002); nationalShow.salesOpen === true.

import { Timestamp } from 'firebase-admin/firestore';

import { getSoldCountsByTicketType } from '../../../../../../lib/data/tickets.ts';
import {
  NATIONAL_SHOW_ID,
  TARGET_TICKET_TYPE,
  createTicketDoc,
  sanityCapacity,
  assertSalesOpen,
  fillReservedSeats,
  sentinelEmail,
  postCheckout,
  withCleanup,
  assert,
  runId,
} from '../../../../../../contracts/checks/ticketing-hardening/_shared.mjs';

await withCleanup('A2 an expired reservation genuinely releases its seat for a real subsequent checkout', async () => {
  await assertSalesOpen();
  const { capacity } = await sanityCapacity(TARGET_TICKET_TYPE);
  assert(typeof capacity === 'number' && capacity > 0, `TARGET_TICKET_TYPE '${TARGET_TICKET_TYPE}' has no usable capacity in Sanity`);

  const counts = await getSoldCountsByTicketType(NATIONAL_SHOW_ID);
  const baseline = counts[TARGET_TICKET_TYPE] ?? 0;
  const room = capacity - 1 - baseline;
  assert(
    room >= 0,
    `PRECONDITION FAILED: live sold count (${baseline}) already leaves no room to reach capacity-1 (${capacity - 1}) — this check needs at least one free seat of slack to run safely against live data. Re-run once capacity frees up, or raise capacity in Sanity.`
  );

  const label = `release-fill-${runId()}`;
  if (room > 0) {
    await fillReservedSeats(room, label);
  }

  // The abandoned-cart simulation: ALREADY expired, same shape a real checkout reservation
  // would have carried per lib/checkout-reservation.ts's buildReservationDocs.
  const expiredBookingRef = `RELEASE-EXPIRED-${label}`;
  await createTicketDoc({
    bookingRef: expiredBookingRef,
    attendeeEmail: sentinelEmail(`expired-${label}`),
    // A REAL firebase-admin Timestamp, not a plain Date or stub — stillHoldsSeat's
    // `instanceof Timestamp` check silently fails closed (treats it as held) on anything
    // else, which would make this check falsely prove release by writing a document the
    // release logic could never have excluded in the first place.
    expiresAt: Timestamp.fromMillis(Date.now() - 5000),
  });

  // Confirm the fill landed at exactly capacity - 1, and the expired seat is NOT counted on
  // top of it — this is the lazy-exclusion proof in isolation, before the HTTP round trip.
  const afterFillCounts = await getSoldCountsByTicketType(NATIONAL_SHOW_ID);
  const afterFillHeld = afterFillCounts[TARGET_TICKET_TYPE] ?? 0;
  assert(
    afterFillHeld === capacity - 1,
    `expected sold count to read capacity-1 (${capacity - 1}) with the expired seat excluded, got ${afterFillHeld} — either the fill didn't land at the expected count, or the expired reservation IS being counted (release path broken).`
  );

  // The real proof: an ordinary buyer's real HTTP checkout for the same ticket type must
  // now succeed — the "last seat" the expired reservation appeared to occupy is genuinely
  // resellable through the production path, not just excluded from an isolated count.
  const buyerEmail = sentinelEmail(`resell-buyer-${label}`);
  const { status, body } = await postCheckout({
    ticketType: TARGET_TICKET_TYPE,
    email: buyerEmail,
    name: 'Release Path Resell Check',
  });
  assert(
    status === 201,
    `expected the real checkout route to accept a fresh reservation for the now-freed seat (HTTP 201), got ${status}: ${JSON.stringify(body)} — the expired reservation is still holding capacity, meaning the release path is NOT actually freeing seats for real buyers.`
  );
});
