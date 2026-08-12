// A28 (S2) — the nil and max UUIDs are rejected.
//
// @qa measured `00000000-0000-0000-0000-000000000000` accepted with 201: it matches
// UUID_PATTERN. A constant key is not an idempotency key — every caller that sends it is
// deduplicated onto the FIRST caller's reservation and handed that person's booking
// reference, which is the door code. The nil UUID is the single most likely constant a
// non-browser client emits.
//
// Currently RED: 201 for the nil UUID.

import {
  assert,
  assertSalesOpen,
  countHeldSeats,
  postCheckout,
  safeBody,
  sweepSentinels,
  runId,
  sentinelEmail,
  withCleanup,
} from './_shared.mjs';

const FORBIDDEN = [
  '00000000-0000-0000-0000-000000000000',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
];

await withCleanup('A28 constant (nil / max) idempotency keys are rejected', async () => {
  await assertSalesOpen();
  await sweepSentinels();
  const id = runId();

  const heldBefore = await countHeldSeats();

  for (const key of FORBIDDEN) {
    const res = await postCheckout({
      email: sentinelEmail(`constant-${id}-${key.slice(0, 4)}`),
      idempotencyKey: key,
    });
    assert(
      res.status === 400,
      `Idempotency-Key '${key}' was answered ${res.status}; expected 400. See contracts/golden/ticketing-hardening/idempotency-binding.golden.md`
    );
    assert(
      res.body.bookingRef === undefined && res.body.fields === undefined,
      `the rejection returned a reservation payload: ${safeBody(res.body)}`
    );
  }

  const heldAfter = await countHeldSeats();
  assert(
    heldAfter === heldBefore,
    `${heldAfter - heldBefore} ticket(s) were written by rejected constant-key requests — the rejection must happen before any Firestore write`
  );
});
