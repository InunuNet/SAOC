#!/usr/bin/env node
// F5 (ticketing-foundation) — POPIA consent-recording proof (spec §8.6): newsletter opt-in
// defaults to false and unticked, `optInAt` is only ever set as a side effect of a genuine
// opt-in, and no call shape can produce a "silently subscribed" buyer. Every check here is a
// REAL call to lib/buyers.ts's buildNewsletterOptIn()/buildBuyerDocument() — no reimplementation
// of the opt-in logic, no Firestore write, no network.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f5-buyers/check-newsletter-consent-defaults.mjs

import { buildBuyerDocument, buildNewsletterOptIn } from '../../../lib/buyers.ts';

const failures = [];
const NOW = new Date('2027-01-05T00:00:00Z');

function expect(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures.push(`${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}.`);
  }
}

// (1) No argument at all (the shape buildBuyerDocument() falls back to when a caller doesn't
// pass newsletterOptIn, e.g. an account created via §8.3's auto-claim path with no signup-form
// checkbox in play) — must be unticked, no timestamp, no source.
expect('(1) buildNewsletterOptIn() with no argument', buildNewsletterOptIn(), {
  optedIn: false,
  optInAt: null,
  source: null,
});

// (2) A genuine opt-in — checkbox ticked at signup — must record BOTH the timestamp and the
// source, per spec §8.6 ("not just 'is this person subscribed' but 'when did they consent, and
// how'").
expect(
  '(2) buildNewsletterOptIn({ optedIn: true, source, now })',
  buildNewsletterOptIn({ optedIn: true, source: 'signup-form', now: NOW }),
  { optedIn: true, optInAt: NOW, source: 'signup-form' },
);

// (3) Fail-closed on a malformed call: optedIn:false explicitly passed alongside a source and a
// timestamp (e.g. a caller that fills in every field out of habit without checking `optedIn`
// first) must NOT leak optInAt/source through — optedIn:false always wins and forces both to
// null. This is the case that catches a naive implementation that just spreads whatever object
// it's given.
expect(
  '(3) buildNewsletterOptIn({ optedIn: false, source, now }) does not leak optInAt/source',
  buildNewsletterOptIn({ optedIn: false, source: 'signup-form', now: NOW }),
  { optedIn: false, optInAt: null, source: null },
);

// (4) buildBuyerDocument() with no newsletterOptIn argument at all (the default account-creation
// call shape) produces an unticked buyer — a purchase or account creation never auto-subscribes
// anyone (spec §8.6, "What newsletters do not do").
{
  const buyer = buildBuyerDocument({ uid: 'buyer-1', email: 'buyer@example.com', now: NOW });
  expect('(4) buildBuyerDocument() default newsletterOptIn', buyer.newsletterOptIn, {
    optedIn: false,
    optInAt: null,
    source: null,
  });
  expect('(4) buildBuyerDocument() has no capability-flavoured field', 'roles' in buyer, false);
  expect('(4) buildBuyerDocument() has no admin-flavoured field', 'admin' in buyer, false);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: newsletter opt-in defaults to unticked with no timestamp, a genuine opt-in records both ' +
    'optInAt and source together, optedIn:false always forces both to null even if a caller passes ' +
    'them, and a buyer document created with no explicit opt-in is never silently subscribed.',
);
process.exit(0);
