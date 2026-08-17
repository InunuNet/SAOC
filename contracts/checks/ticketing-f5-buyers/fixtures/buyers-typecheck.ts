// F5 (ticketing-foundation) — compiler-driven (not source-grep) proof of the exported type
// shapes lib/buyers.ts and types/index.ts's `Order.buyerUid` must add. Run via its own scoped
// tsconfig (see that file's header) because the root tsconfig.json excludes `contracts/` from
// `pnpm type-check`.
//
// Two things proven here that A3/A4/A6's runtime calls cannot see:
//   1. `Buyer` / `NewsletterOptIn` are exactly the shapes the golden README specifies — a real
//      assignment either compiles or it doesn't.
//   2. `Order.buyerUid` is optional and typed `string | null | undefined` — an existing Order
//      literal that omits it entirely still compiles (proving F5 does not force every caller,
//      including pre-F5 order-creation code, to supply the field), AND a literal that sets it
//      to `null` or a real uid string also compiles.
//
// Run as: npx tsc --noEmit -p contracts/checks/ticketing-f5-buyers/tsconfig.typecheck.json

import type { Buyer, NewsletterOptIn } from '../../../../lib/buyers';
import { buildBuyerDocument, buildNewsletterOptIn, BUYERS_COLLECTION } from '../../../../lib/buyers';
import type { Order } from '../../../../types/index';

const collectionName: 'buyers' = BUYERS_COLLECTION;

const optedOut: NewsletterOptIn = buildNewsletterOptIn();
const optedIn: NewsletterOptIn = buildNewsletterOptIn({
  optedIn: true,
  source: 'signup-form',
  now: new Date(),
});

const buyer: Buyer = buildBuyerDocument({
  uid: 'fake-uid',
  email: 'buyer@example.com',
  now: new Date(),
});

const buyerWithName: Buyer = buildBuyerDocument({
  uid: 'fake-uid',
  email: 'buyer@example.com',
  displayName: 'Test Buyer',
  newsletterOptIn: { optedIn: true, source: 'signup-form', now: new Date() },
  now: new Date(),
});

// `Order.buyerUid` must be optional — a pre-F5-shaped literal that never mentions it still
// compiles. If a future edit makes the field required, this literal starts failing to compile.
const legacyOrder: Order = {
  id: 'order-1',
  showId: 'nationalShow',
  buyerName: 'Guest Buyer',
  buyerEmail: 'guest@example.com',
  amount: 25000,
  status: 'paid',
  expiresAt: null,
  idempotencyKey: 'idem-1',
  purchasedAt: null,
  gateway: 'payfast',
  gatewayPaymentId: 'pf-1',
  m_payment_id: null,
  pf_payment_id: null,
};

const claimedOrder: Order = { ...legacyOrder, buyerUid: 'fake-uid' };
const unclaimedOrder: Order = { ...legacyOrder, buyerUid: null };

export {
  collectionName,
  optedOut,
  optedIn,
  buyer,
  buyerWithName,
  legacyOrder,
  claimedOrder,
  unclaimedOrder,
};
