// A26 (S2) — an Idempotency-Key is bound to the product it first bought.
//
// @qa measured: the same key replayed with a different `ticketType` returns HTTP 200 and
// the ORIGINAL TARGET_TICKET_TYPE ticket at amount 0.00 — a signed PayFast payload for a
// product the caller did not ask for, at a price that is not that product's price.
//
// Currently RED: 200 with the wrong ticket's amount.

import {
  assert,
  assertSalesOpen,
  postCheckout,
  runId,
  safeBody,
  sentinelEmail,
  sweepSentinels,
  TARGET_TICKET_TYPE,
  withCleanup,
} from './_shared.mjs';
import { otherActiveTicketTypeSlug } from './_round2.mjs';

await withCleanup('A26 a key replayed for a different ticket type is refused', async () => {
  await assertSalesOpen();
  await sweepSentinels();

  const otherType = await otherActiveTicketTypeSlug(TARGET_TICKET_TYPE);
  const id = runId();
  const key = crypto.randomUUID();
  const email = sentinelEmail(`payload-${id}`);

  const first = await postCheckout({ email, idempotencyKey: key });
  assert(
    first.status === 201 && typeof first.body.bookingRef === 'string',
    `PRECONDITION: the first checkout must succeed, got ${first.status} ${safeBody(first.body)}`
  );
  const firstRef = first.body.bookingRef;

  const replay = await postCheckout({ email, idempotencyKey: key, ticketType: otherType });

  assert(
    replay.status === 409,
    `the same key replayed for ticket type '${otherType}' instead of '${TARGET_TICKET_TYPE}' returned ${replay.status}; expected 409. See contracts/golden/ticketing-hardening/idempotency-binding.golden.md`
  );
  const body = safeBody(replay.body);
  assert(
    !body.includes(firstRef),
    `the refusal returned the original '${TARGET_TICKET_TYPE}' booking reference for a '${otherType}' request`
  );
  assert(
    replay.body.fields === undefined,
    `the refusal must not carry a signed PayFast payload, got ${body}`
  );
});
