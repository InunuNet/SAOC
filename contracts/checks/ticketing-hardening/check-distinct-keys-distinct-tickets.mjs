// A9 — the false-green guard for A8. Deduplication must key on the Idempotency-Key
// header ALONE. Two genuine purchases by the same person, same type, same email, with
// different keys, must produce two tickets — a route that collapsed them (e.g. keyed on
// email) would pass A8 while quietly refusing real second purchases.

import {
  assert,
  assertSalesOpen,
  db,
  postCheckout,
  runId,
  sentinelEmail,
  TICKETS_COLLECTION,
  withCleanup,
} from './_shared.mjs';

await withCleanup('A9 two distinct Idempotency-Keys create two distinct tickets', async () => {
  await assertSalesOpen();
  const id = runId();
  const email = sentinelEmail(`twice-${id}`);

  const first = await postCheckout({ email, idempotencyKey: crypto.randomUUID() });
  const second = await postCheckout({ email, idempotencyKey: crypto.randomUUID() });

  assert(
    first.status === 201 && second.status === 201,
    `both genuine purchases should be fresh 201s, got ${first.status} and ${second.status}`
  );
  assert(
    first.body.bookingRef !== second.body.bookingRef,
    `two separate purchases were given the same bookingRef (${first.body.bookingRef})`
  );

  const snap = await db().collection(TICKETS_COLLECTION).where('attendeeEmail', '==', email).get();
  assert(
    snap.size === 2,
    `Firestore read-back: expected 2 ticket documents for two distinct keys, got ${snap.size}`
  );
});
