// A27 (S2) — a key may only be replayed while its reservation is still payable.
//
// @qa measured: replaying the key AFTER the ticket has been checked in returns HTTP 200
// with a live, freshly signed PayFast payload — a payment page for a seat whose holder
// has already walked through the door.
//
// Both sub-cases are asserted: a consumed ticket ('checked-in') and an expired hold.
//
// Currently RED: 200 with a signed payload for the checked-in case.

import {
  assert,
  assertSalesOpen,
  db,
  postCheckout,
  readTicketByBookingRef,
  runId,
  safeBody,
  sentinelEmail,
  sweepSentinels,
  TICKETS_COLLECTION,
  withCleanup,
} from './_shared.mjs';
import { expiredAt } from './_round2.mjs';

async function patch(bookingRef, fields) {
  const ticket = await readTicketByBookingRef(bookingRef);
  assert(ticket != null, `could not re-read reservation ${bookingRef}`);
  await db().collection(TICKETS_COLLECTION).doc(ticket.id).update(fields);
}

await withCleanup('A27 a key cannot be replayed once its reservation is not payable', async () => {
  await assertSalesOpen();
  await sweepSentinels();
  const id = runId();

  // --- case 1: the ticket has already been consumed at the door ---
  const consumedKey = crypto.randomUUID();
  const consumedEmail = sentinelEmail(`consumed-${id}`);
  const consumed = await postCheckout({ email: consumedEmail, idempotencyKey: consumedKey });
  assert(
    consumed.status === 201,
    `PRECONDITION: first checkout must succeed, got ${consumed.status} ${safeBody(consumed.body)}`
  );
  await patch(consumed.body.bookingRef, { status: 'checked-in', checkedInAt: new Date() });

  const consumedReplay = await postCheckout({
    email: consumedEmail,
    idempotencyKey: consumedKey,
  });
  assert(
    consumedReplay.status === 409,
    `replaying a key whose ticket is already 'checked-in' returned ${consumedReplay.status}; expected 409. A payment payload must never be issued for a ticket that has walked through the door.`
  );
  assert(
    consumedReplay.body.fields === undefined && consumedReplay.body.processUrl === undefined,
    `the refusal still carried a live PayFast payload: ${safeBody(consumedReplay.body)}`
  );

  // --- case 2: the hold has expired ---
  const staleKey = crypto.randomUUID();
  const staleEmail = sentinelEmail(`stale-${id}`);
  const stale = await postCheckout({ email: staleEmail, idempotencyKey: staleKey });
  assert(
    stale.status === 201,
    `PRECONDITION: second checkout must succeed, got ${stale.status} ${safeBody(stale.body)}`
  );
  await patch(stale.body.bookingRef, { expiresAt: expiredAt() });

  const staleReplay = await postCheckout({ email: staleEmail, idempotencyKey: staleKey });
  assert(
    staleReplay.status === 409,
    `replaying a key whose reservation has EXPIRED returned ${staleReplay.status}; expected 409 — the seat may already have been re-counted to someone else, so the buyer must start again rather than pay for it.`
  );
  assert(
    staleReplay.body.fields === undefined && staleReplay.body.processUrl === undefined,
    `the expired-hold refusal still carried a live PayFast payload: ${safeBody(staleReplay.body)}`
  );
});
