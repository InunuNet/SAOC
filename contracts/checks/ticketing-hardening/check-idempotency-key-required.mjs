// A10 — a checkout without a well-formed Idempotency-Key is rejected before anything is
// written. The header is what makes A8's guarantee reachable at all; if it is optional
// or unvalidated, duplicate protection is opt-in and therefore absent for exactly the
// callers that retry.

import {
  safeBody,
  assert,
  assertSalesOpen,
  BASE_URL,
  db,
  NATIONAL_SHOW_ID,
  postCheckout,
  runId,
  sentinelEmail,
  TARGET_TICKET_TYPE,
  TICKETS_COLLECTION,
  withCleanup,
} from './_shared.mjs';

async function countTicketsFor(email) {
  const snap = await db().collection(TICKETS_COLLECTION).where('attendeeEmail', '==', email).get();
  return snap.size;
}

await withCleanup('A10 a missing or malformed Idempotency-Key is a 400 with no write', async () => {
  await assertSalesOpen();
  const id = runId();

  const missingEmail = sentinelEmail(`nokey-${id}`);
  const missing = await postCheckout({ email: missingEmail, idempotencyKey: null });
  assert(
    missing.status === 400,
    `a POST with no Idempotency-Key should be 400, got ${missing.status} ${safeBody(missing.body)}`
  );
  assert(
    (await countTicketsFor(missingEmail)) === 0,
    'a rejected keyless POST still wrote a ticket document'
  );

  const badEmail = sentinelEmail(`badkey-${id}`);
  const bad = await fetch(`${BASE_URL}/api/tickets/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'not-a-uuid' },
    body: JSON.stringify({
      showId: NATIONAL_SHOW_ID,
      ticketType: TARGET_TICKET_TYPE,
      attendeeName: 'Harden Check',
      attendeeEmail: badEmail,
    }),
  });
  assert(
    bad.status === 400,
    `a POST with a malformed Idempotency-Key should be 400, got ${bad.status}`
  );
  assert(
    (await countTicketsFor(badEmail)) === 0,
    'a rejected malformed-key POST still wrote a ticket document'
  );
});
