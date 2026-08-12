// A25 (S2) — an Idempotency-Key is bound to the buyer who first used it.
//
// @qa measured: Bob POSTs Alice's key with his own name and email and receives HTTP 200
// carrying ALICE'S BOOKING REFERENCE. That reference is the door code. The stored
// attendee stays Alice, so Bob now holds a working credential to Alice's seat.
//
// A8 (same key, same buyer -> one ticket) and A9 (different keys -> two tickets) both
// pass today because neither varies the buyer. This is the case that discriminates.
//
// Currently RED: 200 + Alice's ref.

import {
  assert,
  assertSalesOpen,
  postCheckout,
  readTicketByBookingRef,
  runId,
  safeBody,
  sentinelEmail,
  sweepSentinels,
  withCleanup,
} from './_shared.mjs';

await withCleanup('A25 a key replayed by a different buyer is refused, not answered', async () => {
  await assertSalesOpen();
  await sweepSentinels();

  const id = runId();
  const key = crypto.randomUUID();
  const aliceEmail = sentinelEmail(`alice-${id}`);
  const bobEmail = sentinelEmail(`bob-${id}`);

  const alice = await postCheckout({ email: aliceEmail, name: 'Alice Alpha', idempotencyKey: key });
  assert(
    alice.status === 201 && typeof alice.body.bookingRef === 'string',
    `PRECONDITION: Alice's checkout must succeed, got ${alice.status} ${safeBody(alice.body)}`
  );
  const aliceRef = alice.body.bookingRef;

  const bob = await postCheckout({ email: bobEmail, name: 'Bob Beta', idempotencyKey: key });

  assert(
    bob.status === 409,
    `Bob replayed Alice's Idempotency-Key with his own email and got ${bob.status}; expected 409. See contracts/golden/ticketing-hardening/idempotency-binding.golden.md`
  );

  const bobBody = safeBody(bob.body);
  assert(
    !bobBody.includes(aliceRef),
    "the 409 response leaked Alice's booking reference to Bob — that reference is the door code, and refusing while still returning it fixes nothing"
  );
  assert(
    bob.body.bookingRef === undefined && bob.body.fields === undefined,
    `the refusal must carry no bookingRef and no PayFast fields, got ${bobBody}`
  );

  const stored = await readTicketByBookingRef(aliceRef);
  assert(
    stored?.attendeeEmail === aliceEmail,
    `Alice's reservation now stores '${stored?.attendeeEmail}' — a replay must never rewrite the original buyer`
  );
});
