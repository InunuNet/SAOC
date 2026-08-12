// A23 (S1) — THE CATASTROPHE GUARD. A paid ticket must never be expired, released or
// mutated by anything in the expiry mechanism, no matter what its `expiresAt` says.
//
// A reservation whose window elapsed before the PayFast ITN landed keeps a long-past
// `expiresAt` after it is paid. If the counter filters `expiresAt` on paid documents as
// well as reserved ones, that seat is silently resold — someone who has paid is turned
// away at the door. A checked-in ticket carrying a past `expiresAt` must likewise be left
// completely alone.
//
// This is the single most expensive way to get S1 wrong, so it is asserted from both
// sides: the paid seat must still be COUNTED, and neither the paid nor the checked-in
// document may be MUTATED by a checkout round-trip.
//
// Currently GREEN (nothing reads expiresAt yet). It exists to stay green forever.

import {
  assert,
  assertSalesOpen,
  countHeldSeats,
  createTicketDoc,
  postCheckout,
  readTicketById,
  runId,
  safeBody,
  sanityCapacity,
  sentinelEmail,
  sweepSentinels,
  TARGET_TICKET_TYPE,
  withCleanup,
} from './_shared.mjs';
import { expiredAt, fillSeats, liveUntil } from './_round2.mjs';

await withCleanup('A23 a paid or checked-in ticket is never expired or mutated', async () => {
  await assertSalesOpen();
  await sweepSentinels();

  const { capacity } = await sanityCapacity();
  const heldBefore = await countHeldSeats();
  assert(
    heldBefore < capacity,
    `PRECONDITION: '${TARGET_TICKET_TYPE}' is already at ${heldBefore}/${capacity} from REAL tickets.`
  );

  const id = runId();

  // A ticket that was PAID after its reservation window elapsed — the realistic case.
  const paidRef = await createTicketDoc({
    bookingRef: `HARDEN2-PAID-${id}`,
    attendeeEmail: sentinelEmail(`paid-expired-${id}`),
    status: 'paid',
    purchasedAt: new Date(),
    expiresAt: expiredAt(),
  });
  // A ticket whose holder has already walked through the door.
  const checkedInRef = await createTicketDoc({
    bookingRef: `HARDEN2-IN-${id}`,
    attendeeEmail: sentinelEmail(`checkedin-expired-${id}`),
    status: 'checked-in',
    purchasedAt: new Date(),
    checkedInAt: new Date(),
    expiresAt: expiredAt(),
  });

  const paidBefore = await readTicketById(paidRef.id);
  const checkedInBefore = await readTicketById(checkedInRef.id);
  const checkedInStampBefore = checkedInBefore?.checkedInAt?.toMillis?.() ?? null;
  assert(checkedInStampBefore != null, 'setup failed: checkedInAt was not stored');

  // Fill the remainder with live holds so the paid ticket is the seat that makes the
  // difference between full and not-full.
  await fillSeats({
    count: capacity - heldBefore - 1,
    label: `live-${id}`,
    expiresAt: liveUntil(),
  });

  const held = await countHeldSeats();
  assert(
    held === capacity,
    `setup failed: expected ${capacity} reserved+paid held (${capacity - 1} live holds + 1 paid), got ${held}`
  );

  const res = await postCheckout({ email: sentinelEmail(`paid-guard-buyer-${id}`) });
  assert(
    res.status === 409,
    `A PAID ticket with a past expiresAt was treated as an expired hold and its seat resold: expected 409, got ${res.status} ${safeBody(res.body)}. Expiry must apply to 'reserved' documents ONLY — see contracts/golden/ticketing-hardening/reservation-expiry.golden.md`
  );

  const paidAfter = await readTicketById(paidRef.id);
  assert(
    paidAfter?.status === 'paid',
    `a paid ticket's status was changed to '${paidAfter?.status}' by the expiry path — a paid attendee would be refused at the door`
  );
  assert(
    (paidAfter?.expiresAt?.toMillis?.() ?? null) ===
      (paidBefore?.expiresAt?.toMillis?.() ?? null),
    'a paid ticket had its expiresAt rewritten'
  );

  const checkedInAfter = await readTicketById(checkedInRef.id);
  assert(
    checkedInAfter?.status === 'checked-in',
    `a checked-in ticket's status was changed to '${checkedInAfter?.status}' by the expiry path`
  );
  assert(
    (checkedInAfter?.checkedInAt?.toMillis?.() ?? null) === checkedInStampBefore,
    'a checked-in ticket had its checkedInAt audit timestamp rewritten by the expiry path'
  );
});
