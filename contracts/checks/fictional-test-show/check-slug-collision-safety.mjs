#!/usr/bin/env node
// fictional-test-show — slug-collision safety against F9's already-shipped demo ticket type.
// See golden README "Why a different slug from F9's demo ticket type, not a reuse". The risk
// this guards against is real, read directly from sanity/queries.ts's ticketTypeBySlugQuery:
// `*[_type == "ticketType" && slug.current == $slug && active == true][0]` — no show-scoping,
// first-match-in-array-order, and Sanity enforces no slug uniqueness at read time.
//
// DEFEATING MUTATION named up front: FICTIONAL_SHOW_TICKET_TYPE_SLUG collapsing to the same
// string as DEMO_TICKET_TYPE_SLUG (a copy-paste of the wrong constant, or a future edit that
// "simplifies" by reusing F9's slug) — this would make a checkout POST for that slug resolve
// to WHICHEVER of the two real Sanity documents the dataset happens to return first, an
// unpredictable, unrecoverable collision. The check kills this two ways: (1) a direct value
// inequality between the two imported constants, which fails the instant they're equal
// strings, however that equality was introduced; (2) a fixture-driven simulation of the real
// query's first-match semantics, fed a dataset containing BOTH slugs simultaneously (matching
// F9's own plan — F12 needs the real demo ticket type present at the same time this feature's
// fictional one is), proving each slug still resolves to its own, distinct document even when
// coexisting, not just that the string constants differ in isolation.
//
// Run as: node --import tsx/esm contracts/checks/fictional-test-show/check-slug-collision-safety.mjs

import { FICTIONAL_SHOW_TICKET_TYPE_SLUG } from '../../../lib/fictional-test-show.ts';
import { DEMO_TICKET_TYPE_SLUG } from '../../../lib/demo-ticket-type.ts';

const failures = [];

// --- (1) The two reserved slugs are textually distinct values, compared directly. ---

if (FICTIONAL_SHOW_TICKET_TYPE_SLUG === DEMO_TICKET_TYPE_SLUG) {
  failures.push(
    `(1) FICTIONAL_SHOW_TICKET_TYPE_SLUG and DEMO_TICKET_TYPE_SLUG are the SAME string ` +
      `(${JSON.stringify(FICTIONAL_SHOW_TICKET_TYPE_SLUG)}) — a checkout POST for that slug ` +
      `would resolve to whichever document Sanity's unscoped, first-match ` +
      `ticketTypeBySlugQuery happens to return first.`,
  );
}

// --- (2) Fixture-driven simulation of ticketTypeBySlugQuery's real, unscoped, first-match ---
// --- semantics: `*[_type == "ticketType" && slug.current == $slug && active == true][0]` ---

function simulateTicketTypeBySlugQuery(dataset, slug) {
  return dataset.find((doc) => doc.slug === slug && doc.active === true) ?? null;
}

// Both features' reserved ticket types present simultaneously, in the same order F9's own
// plan puts them in a real dataset — the exact coexistence this check must survive.
const realShowDemoTicketType = {
  _id: 'ticketType-demo-show-19-2027',
  slug: DEMO_TICKET_TYPE_SLUG,
  active: true,
  show: { _ref: 'show-19-2027' },
};
const fictionalShowTicketType = {
  _id: 'ticketType-fictional-test-show-general-admission',
  slug: FICTIONAL_SHOW_TICKET_TYPE_SLUG,
  active: true,
  show: { _ref: 'show-fictional-test' },
};
const realAdultTicketType = {
  _id: 'ticketType-adult',
  slug: 'adult',
  active: true,
  show: { _ref: 'show-19-2027' },
};

const mixedDataset = [realAdultTicketType, realShowDemoTicketType, fictionalShowTicketType];

const demoResolved = simulateTicketTypeBySlugQuery(mixedDataset, DEMO_TICKET_TYPE_SLUG);
if (demoResolved?._id !== realShowDemoTicketType._id) {
  failures.push(
    `(2a) querying DEMO_TICKET_TYPE_SLUG against a dataset containing both reserved slugs ` +
      `resolved to ${JSON.stringify(demoResolved?._id ?? null)}, expected ` +
      `${JSON.stringify(realShowDemoTicketType._id)} (F9's own demo ticket type).`,
  );
}

const fictionalResolved = simulateTicketTypeBySlugQuery(mixedDataset, FICTIONAL_SHOW_TICKET_TYPE_SLUG);
if (fictionalResolved?._id !== fictionalShowTicketType._id) {
  failures.push(
    `(2b) querying FICTIONAL_SHOW_TICKET_TYPE_SLUG against a dataset containing both reserved ` +
      `slugs resolved to ${JSON.stringify(fictionalResolved?._id ?? null)}, expected ` +
      `${JSON.stringify(fictionalShowTicketType._id)} (the fictional show's own ticket type).`,
  );
}

// Reversed insertion order in the dataset — proves the two documents resolving correctly is
// not an artefact of one happening to be listed first in mixedDataset above.
const reversedDataset = [fictionalShowTicketType, realShowDemoTicketType, realAdultTicketType];

const demoResolvedReversed = simulateTicketTypeBySlugQuery(reversedDataset, DEMO_TICKET_TYPE_SLUG);
if (demoResolvedReversed?._id !== realShowDemoTicketType._id) {
  failures.push(
    `(2c) with the fictional ticket type listed FIRST in the dataset, querying ` +
      `DEMO_TICKET_TYPE_SLUG resolved to ${JSON.stringify(demoResolvedReversed?._id ?? null)}, ` +
      `expected ${JSON.stringify(realShowDemoTicketType._id)} — proves resolution keys off ` +
      `slug equality, not array position.`,
  );
}

const fictionalResolvedReversed = simulateTicketTypeBySlugQuery(
  reversedDataset,
  FICTIONAL_SHOW_TICKET_TYPE_SLUG,
);
if (fictionalResolvedReversed?._id !== fictionalShowTicketType._id) {
  failures.push(
    `(2d) with the fictional ticket type listed FIRST in the dataset, querying ` +
      `FICTIONAL_SHOW_TICKET_TYPE_SLUG resolved to ` +
      `${JSON.stringify(fictionalResolvedReversed?._id ?? null)}, expected ` +
      `${JSON.stringify(fictionalShowTicketType._id)}.`,
  );
}

if (failures.length > 0) {
  console.error('FAIL: check-slug-collision-safety\n' + failures.map((f) => ` - ${f}`).join('\n'));
  process.exit(1);
}

console.log(
  'PASS: FICTIONAL_SHOW_TICKET_TYPE_SLUG and DEMO_TICKET_TYPE_SLUG are textually distinct, ' +
    "and each resolves to its own, correct document under ticketTypeBySlugQuery's real " +
    'unscoped first-match semantics even when both reserved ticket types coexist in the ' +
    'same dataset, regardless of insertion order.',
);
process.exit(0);
