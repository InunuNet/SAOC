#!/usr/bin/env node
// verify-reservation-release-path F1, A3 — the negative control the mission explicitly calls
// out: a PAID order/position must NEVER be excluded by the lazy release logic, no matter how
// far in the past its (now-irrelevant) `expiresAt` is. lib/data/tickets.ts's stillHoldsSeat
// checks `status !== 'reserved' -> true` BEFORE it ever reads expiresAt (see
// docs/ticketing-position-expiry-write.md "Load-bearing: stillHoldsSeat's branch order must not
// be refactored casually") — this proves that guarantee against real Firestore and the real,
// unmodified getSoldCountsByTicketType, not just by reading the source.
//
// Run as: npx tsx .agent/memory/project/specs/verify-reservation-release-path/goldens/check-paid-order-not-released-by-expiry.mjs
// Preconditions: .env.local present with Firebase admin credentials. No dev server required.

import { Timestamp } from 'firebase-admin/firestore';

import { getSoldCountsByTicketType } from '../../../../../../lib/data/tickets.ts';
import {
  NATIONAL_SHOW_ID,
  TARGET_TICKET_TYPE,
  createTicketDoc,
  sentinelEmail,
  withCleanup,
  assert,
  runId,
} from '../../../../../../contracts/checks/ticketing-hardening/_shared.mjs';

async function heldCount() {
  const counts = await getSoldCountsByTicketType(NATIONAL_SHOW_ID);
  return counts[TARGET_TICKET_TYPE] ?? 0;
}

await withCleanup('A3 a paid position with a stale past expiresAt is NOT released', async () => {
  const baseline = await heldCount();

  const label = `paid-immune-${runId()}`;
  await createTicketDoc({
    bookingRef: `PAID-IMMUNE-${label}`,
    attendeeEmail: sentinelEmail(label),
    status: 'paid',
    // Far in the past — well beyond RESERVATION_TTL_MINUTES, and far beyond any plausible
    // reservation window. If expiry were checked before status, this alone would exclude it.
    expiresAt: Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000),
  });

  const held = await heldCount();
  assert(
    held === baseline + 1,
    `a paid position with expiresAt 24h in the past must still be counted as held ` +
      `(expected ${baseline + 1}, got ${held}) — status is being ignored and expiry checked ` +
      'first, which would un-sell a real paid buyer\'s seat.'
  );
});
