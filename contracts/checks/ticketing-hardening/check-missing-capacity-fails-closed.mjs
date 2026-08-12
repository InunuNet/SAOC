// A29 (S3) — a ticket type whose `capacity` is not a usable number must be unsellable.
//
// @qa reported the guard `alreadyHeld + 1 > input.capacity` fails OPEN because
// `50 > undefined === false`. That is true as JavaScript but NOT the value the route
// receives: GROQ projects a missing attribute as `null`, `1 > null` is `1 > 0`, and the
// absent-capacity case therefore 409s today. Measured directly against Sanity
// (2026-08-11) — see .agent/memory/scratch/harden-brief-2.md.
//
// The weakness itself is real and reachable, just by a different value. Sanity does not
// enforce field types at the API level, and `scripts/seed-*.ts` and the HTTP API both
// bypass Studio validation entirely. Measured: `capacity: "50"` (a string) reaches the
// route unchanged, `1 > "50"` is FALSE, and the checkout returns **201** against an
// unlimited ledger. `NaN` behaves identically. That is the assertion below.
//
// The absent-capacity case is asserted alongside it as a regression guard: it is green
// today for an accidental reason (`> null`), and a refactor that made the comparison
// numeric-safe without an explicit reject could flip it open.
//
// Both cases use a TEMPORARY Sanity ticketType, created, polled until the checkout route
// can actually see it through the same CDN the app reads, exercised, then deleted and
// polled until it is gone. No live ticket type is touched. The fixture is named
// 'ZZ DO NOT SELL — automated check' and is visible on /tickets for the duration, the
// same window A6's capacity fill already opens.
//
// Currently RED on the string case (201), green on the absent case.

import {
  assert,
  assertSalesOpen,
  postCheckout,
  runId,
  safeBody,
  sentinelEmail,
  sweepSentinels,
  withCleanup,
} from './_shared.mjs';
import { countTicketsOfType, withEphemeralTicketType } from './_round2.mjs';

const ALL_STATUSES = ['reserved', 'paid', 'cancelled', 'checked-in'];

const CASES = [
  {
    slug: 'harden2-cap-string',
    capacity: '50',
    label: 'a non-numeric capacity ("50" as a string, which the seed script or the HTTP API can write)',
  },
  {
    slug: 'harden2-cap-absent',
    capacity: undefined,
    label: 'an absent capacity',
  },
];

await withCleanup('A29 a ticket type without a usable capacity cannot be sold', async () => {
  await assertSalesOpen();
  await sweepSentinels();
  const id = runId();

  for (const testCase of CASES) {
    await withEphemeralTicketType(
      { slug: testCase.slug, price: 0, capacity: testCase.capacity },
      async () => {
        const res = await postCheckout({
          ticketType: testCase.slug,
          email: sentinelEmail(`cap-${id}-${testCase.slug}`),
        });

        assert(
          res.status !== 201 && res.status !== 200,
          `a ticket type with ${testCase.label} was SOLD (HTTP ${res.status} ${safeBody(res.body)}). The capacity comparison fails OPEN — unlimited silent oversell. Reject a non-finite capacity explicitly before reserving; see contracts/golden/ticketing-hardening/capacity-and-price-validation.golden.md`
        );

        const written = await countTicketsOfType(testCase.slug, ALL_STATUSES);
        assert(
          written === 0,
          `${written} ticket(s) were written for a ticket type with ${testCase.label} — the rejection must happen before any Firestore write`
        );
      }
    );
  }
});
