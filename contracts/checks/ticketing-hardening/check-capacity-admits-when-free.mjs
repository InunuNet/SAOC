// A7 — the false-green guard for A6. With seats genuinely free, a normal checkout still
// succeeds, writes exactly one reserved ticket, and stores the SERVER-derived amount
// from Sanity. Without this, a checkout route that simply 409s everything would pass A6.

//
// It establishes its own precondition rather than trusting the assertion before it: A6
// deliberately fills this same ticket type to its capacity boundary, so a seat that was
// not released there would refuse this checkout with a 409 and report a failure that
// has nothing to do with what this check asserts. "No free seat" is therefore an
// environment failure with its own message, the way the suite treats every other
// precondition.

import {
  safeBody,
  assert,
  assertSalesOpen,
  countHeldSeats,
  postCheckout,
  readTicketByBookingRef,
  runId,
  sanityCapacity,
  sentinelEmail,
  TARGET_TICKET_TYPE,
  withCleanup,
} from './_shared.mjs';

await withCleanup(
  'A7 a normal checkout with seats free still reserves exactly one ticket at the Sanity price',
  async () => {
    await assertSalesOpen();
    const { capacity, price } = await sanityCapacity();
    const heldBefore = await countHeldSeats();
    assert(
      heldBefore < capacity,
      `PRECONDITION: '${TARGET_TICKET_TYPE}' already holds ${heldBefore}/${capacity} seats before this check writes anything, so there is no free seat to admit. This is an environment state, not a checkout defect — the usual cause is a preceding capacity check whose fixtures were not released. Clear the held tickets, then re-run.`
    );
    const id = runId();

    const { status, body } = await postCheckout({ email: sentinelEmail(`free-${id}`) });
    assert(
      status === 201,
      `a checkout with free capacity (limit ${capacity}) was refused: HTTP ${status} ${safeBody(body)}`
    );
    assert(typeof body.bookingRef === 'string', 'response carried no bookingRef');
    assert(
      body.fields?.amount === price.toFixed(2),
      `PayFast amount must come from Sanity (${price.toFixed(2)}), got '${body.fields?.amount}'`
    );

    const doc = await readTicketByBookingRef(body.bookingRef);
    assert(doc != null, 'no Firestore ticket was written for an accepted checkout');
    assert(
      doc.status === 'reserved',
      `a new reservation must start 'reserved', got '${doc.status}'`
    );
    assert(
      doc.amount === price,
      `stored amount must be the server-derived Sanity price ${price}, got ${doc.amount}`
    );
  }
);
