// A8 — duplicate checkout POSTs sharing one Idempotency-Key create exactly ONE
// reservation. Today a double-click through a slow response holds a second seat that
// nobody will ever pay for. Proved by Firestore document count, not by response codes
// alone — a route could return a cached-looking response and still write twice.

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

const DUPLICATE_POSTS = 5;

await withCleanup(
  `A8 ${DUPLICATE_POSTS} concurrent POSTs with one Idempotency-Key create exactly one ticket`,
  async () => {
    await assertSalesOpen();
    const id = runId();
    const key = crypto.randomUUID();
    const email = sentinelEmail(`idem-${id}`);

    const responses = await Promise.all(
      Array.from({ length: DUPLICATE_POSTS }, () => postCheckout({ email, idempotencyKey: key }))
    );

    const ok = responses.filter((r) => r.status === 201 || r.status === 200);
    assert(
      ok.length === DUPLICATE_POSTS,
      `every duplicate should be answered with the same reservation (200/201), got statuses ${responses.map((r) => r.status).join(',')}`
    );
    assert(
      responses.filter((r) => r.status === 201).length === 1,
      `exactly one response should be a fresh 201 creation, got ${responses.filter((r) => r.status === 201).length}`
    );
    const refs = new Set(ok.map((r) => r.body.bookingRef));
    assert(
      refs.size === 1,
      `all duplicates must return the SAME bookingRef, got ${refs.size} distinct: ${[...refs].join(', ')}`
    );

    const snap = await db().collection(TICKETS_COLLECTION).where('idempotencyKey', '==', key).get();
    assert(
      snap.size === 1,
      `Firestore read-back: ${DUPLICATE_POSTS} duplicate POSTs created ${snap.size} ticket document(s) — expected exactly 1`
    );
    assert(
      snap.docs[0].data()['bookingRef'] === [...refs][0],
      'the stored ticket does not carry the bookingRef the duplicates were told to use'
    );
  }
);
