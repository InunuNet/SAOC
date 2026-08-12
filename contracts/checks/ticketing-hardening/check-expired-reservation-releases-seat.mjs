// A21 (S1) — an EXPIRED reservation must stop consuming capacity.
//
// Setup fills the type to capacity with real Firestore reservations, of which exactly
// ONE is expired. A buyer arriving now must get the seat that expired hold no longer
// occupies.
//
// Currently RED: nothing in the tree reads `expiresAt`, so the expired hold counts and
// the POST is refused 409 "Sold out" — the exact permanent-seat-loss @qa reproduced.
//
// Blast radius: for the ~30s this runs, the target type reads as sold out on /tickets.
// Pre-production dataset; every seat is released by the sweep.

import {
  assert,
  assertSalesOpen,
  countHeldSeats,
  postCheckout,
  runId,
  safeBody,
  sanityCapacity,
  sentinelEmail,
  sweepSentinels,
  TARGET_TICKET_TYPE,
  withCleanup,
} from './_shared.mjs';
import { expiredAt, fillSeats, liveUntil } from './_round2.mjs';

await withCleanup('A21 an expired reservation no longer consumes capacity', async () => {
  await assertSalesOpen();
  await sweepSentinels();

  const { capacity } = await sanityCapacity();
  const heldBefore = await countHeldSeats();
  assert(
    heldBefore < capacity,
    `PRECONDITION: '${TARGET_TICKET_TYPE}' is already at ${heldBefore}/${capacity} from REAL tickets — this check cannot run without deleting real data.`
  );

  const id = runId();
  // capacity - 1 live holds, then one hold that expired a day ago = capacity docs total.
  await fillSeats({ count: capacity - heldBefore - 1, label: `live-${id}`, expiresAt: liveUntil() });
  await fillSeats({ count: 1, label: `dead-${id}`, expiresAt: expiredAt() });

  const naiveHeld = await countHeldSeats();
  assert(
    naiveHeld === capacity,
    `setup failed: expected ${capacity} reserved+paid docs in total, got ${naiveHeld}`
  );

  const res = await postCheckout({ email: sentinelEmail(`expiry-buyer-${id}`) });
  assert(
    res.status === 201,
    `an expired reservation is still holding a seat: with ${capacity - 1} live holds and 1 expired hold the next buyer must be accepted (201), got ${res.status} ${safeBody(res.body)}. An abandoned checkout consumes a seat permanently — see contracts/golden/ticketing-hardening/reservation-expiry.golden.md`
  );
});
