// A24 (S1) — the WRITER half. Every reservation the real route creates must carry a
// future `expiresAt` inside the documented TTL window.
//
// Without this, the counter's fail-closed default (a reserved document with no expiresAt
// still counts) would silently restore the permanent-seat-loss defect while A21 passed
// against a hand-built fixture. The fixture proves the reader; this proves the writer.
//
// Currently RED: the route writes no expiresAt at all.

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
import { RESERVATION_TTL_MINUTES } from './_round2.mjs';

// Request latency plus clock skew between this process and Firestore. Generous enough
// not to flake, far tighter than the difference between any two plausible TTL choices.
const TOLERANCE_MS = 3 * 60 * 1000;

await withCleanup('A24 a new reservation carries a future expiresAt inside the TTL', async () => {
  await assertSalesOpen();
  await sweepSentinels();

  const id = runId();
  const sentAt = Date.now();
  const res = await postCheckout({ email: sentinelEmail(`ttl-${id}`) });
  assert(
    res.status === 201,
    `PRECONDITION: a normal checkout must succeed for this check, got ${res.status} ${safeBody(res.body)}`
  );

  const ticket = await readTicketByBookingRef(res.body.bookingRef);
  assert(ticket != null, 'the reservation was not found in Firestore');

  const expiresAt = ticket.expiresAt?.toMillis?.() ?? null;
  assert(
    expiresAt != null,
    'the reservation carries no expiresAt Timestamp — an abandoned checkout would hold this seat forever. See contracts/golden/ticketing-hardening/reservation-expiry.golden.md'
  );
  assert(expiresAt > sentAt, `expiresAt is already in the past (${expiresAt} <= ${sentAt})`);

  const expected = sentAt + RESERVATION_TTL_MINUTES * 60 * 1000;
  assert(
    Math.abs(expiresAt - expected) <= TOLERANCE_MS,
    `expiresAt is ${Math.round((expiresAt - sentAt) / 60000)} minutes out; the golden specifies a ${RESERVATION_TTL_MINUTES}-minute reservation TTL (lib/tickets-constants.ts RESERVATION_TTL_MINUTES)`
  );
});
