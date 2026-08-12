// A31 (S5) — a ticket type with no usable `price` must be unsellable, and must not
// commit a reservation on its way to failing.
//
// @qa measured: with `price: null` the reservation COMMITS, then `amount.toFixed(2)`
// throws outside the try/catch -> uncaught 500. The seat is held, the idempotency key is
// burned, and the buyer's retry replays into the identical crash. The 500 alone is not
// the defect; the committed seat is.
//
// The temporary fixture mechanism is the same as A29's.
//
// Currently RED: a reservation exists after the 500.

import {
  assert,
  assertSalesOpen,
  postCheckout,
  safeBody,
  sweepSentinels,
  withCleanup,
  runId,
  sentinelEmail,
} from './_shared.mjs';
import { countTicketsOfType, withEphemeralTicketType } from './_round2.mjs';

const SLUG = 'harden2-no-price';

await withCleanup('A31 a ticket type with no price cannot commit a reservation', async () => {
  await assertSalesOpen();
  await sweepSentinels();
  const id = runId();

  await withEphemeralTicketType({ slug: SLUG, price: null, capacity: 5 }, async () => {
    const res = await postCheckout({
      ticketType: SLUG,
      email: sentinelEmail(`noprice-${id}`),
    });

    assert(
      res.status !== 201 && res.status !== 200,
      `a ticket type with a blank price was sold (HTTP ${res.status} ${safeBody(res.body)})`
    );

    const written = await countTicketsOfType(SLUG, ['reserved', 'paid', 'cancelled', 'checked-in']);
    assert(
      written === 0,
      `${written} ticket(s) were committed for a ticket type with a blank price before the request failed. The seat is held and the idempotency key is burned; the buyer's retry replays into the same crash forever. Validate price BEFORE reserveTicket — see contracts/golden/ticketing-hardening/capacity-and-price-validation.golden.md`
    );
  });
});
