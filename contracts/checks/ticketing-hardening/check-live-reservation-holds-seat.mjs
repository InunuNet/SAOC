// A22 (S1) — the other side of A21: a LIVE (unexpired) reservation must still consume
// capacity. Without this, "stop counting reserved tickets" would satisfy A21 and
// reintroduce the round-1 oversell defect wholesale.
//
// Currently GREEN. It is a regression guard, and it is the reason A21 cannot be passed
// by deletion.

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
import { fillSeats, liveUntil } from './_round2.mjs';

await withCleanup('A22 a live reservation still consumes capacity', async () => {
  await assertSalesOpen();
  await sweepSentinels();

  const { capacity } = await sanityCapacity();
  const heldBefore = await countHeldSeats();
  assert(
    heldBefore < capacity,
    `PRECONDITION: '${TARGET_TICKET_TYPE}' is already at ${heldBefore}/${capacity} from REAL tickets.`
  );

  const id = runId();
  await fillSeats({ count: capacity - heldBefore, label: `live-${id}`, expiresAt: liveUntil() });

  const held = await countHeldSeats();
  assert(held === capacity, `setup failed: expected ${capacity} held, got ${held}`);

  const res = await postCheckout({ email: sentinelEmail(`live-buyer-${id}`) });
  assert(
    res.status === 409,
    `capacity is full of LIVE (unexpired) reservations — the next buyer must be refused 409, got ${res.status} ${safeBody(res.body)}. Reservation expiry must release only holds that have actually expired.`
  );

  const heldAfter = await countHeldSeats();
  assert(
    heldAfter === capacity,
    `OVERSOLD: ${heldAfter} held against a capacity of ${capacity} after a refused POST`
  );
});
