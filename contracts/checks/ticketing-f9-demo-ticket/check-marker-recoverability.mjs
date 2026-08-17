#!/usr/bin/env node
// F9 (ticketing-foundation) — marker recoverability (design intent: "a query can find every
// artefact of every test purchase later, and prove that a mutation removing the marker from
// any one of those artefacts DIES"). Proves the dual-channel marker on the Sanity catalogue
// document (a `demo:true` boolean plus the reserved DEMO_TICKET_TYPE_SLUG string) and the
// single channel that actually survives onto a Firestore POSITION document (the ticketType
// slug string — positions never carry a `demo` boolean at all; see checkout's
// `ticketType: input.ticketType` write and types/index.ts's `Ticket.ticketType: TicketType`,
// which is a bare string).
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f9-demo-ticket/check-marker-recoverability.mjs

import {
  DEMO_TICKET_TYPE_SLUG,
  isDemoTicketTypeDoc,
  isDemoTicketTypeSlug,
} from '../../../lib/demo-ticket-type.ts';

const failures = [];

const demoDoc = { _id: 'ticketType-demo-show-19-2027', slug: DEMO_TICKET_TYPE_SLUG, demo: true };
const realDocA = { _id: 'ticketType-adult', slug: 'adult', demo: false };
// demo field entirely absent — the shape every one of the 5 pre-existing published
// ticketType documents has today, since F9 adds the field as optional/defaulted.
const realDocB = { _id: 'ticketType-child', slug: 'child' };

// (1) Baseline classification, both channels agreeing (or, for realDocB, both absent).
if (isDemoTicketTypeDoc(demoDoc) !== true) {
  failures.push('(1a) demoDoc (both channels set) misclassified as not-demo.');
}
if (isDemoTicketTypeDoc(realDocA) !== false) {
  failures.push('(1b) realDocA (demo:false, real slug) misclassified as demo.');
}
if (isDemoTicketTypeDoc(realDocB) !== false) {
  failures.push('(1c) realDocB (no demo field at all — the pre-F9 legacy shape) misclassified as demo.');
}

// (2) Defeating mutation, channel 1 (boolean): the demo doc's boolean flag alone is stripped
// (e.g. an editor unchecks it in Studio by mistake) but the reserved slug is untouched — must
// STILL classify as demo via the slug channel. Proves the slug channel alone is genuinely
// load-bearing, not decorative.
{
  const mutant = { ...demoDoc, demo: false };
  if (isDemoTicketTypeDoc(mutant) !== true) {
    failures.push(
      '(2) stripping only the `demo` boolean (slug left untouched) lost demo classification — the slug channel is not load-bearing on its own.',
    );
  }
}

// (3) Defeating mutation, channel 2 (slug): the demo doc's slug is renamed but `demo: true`
// is left untouched — must STILL classify as demo via the boolean channel. Proves the
// boolean channel alone is genuinely load-bearing.
{
  const mutant = { ...demoDoc, slug: 'renamed-by-accident' };
  if (isDemoTicketTypeDoc(mutant) !== true) {
    failures.push(
      '(3) renaming only the slug (demo:true left untouched) lost demo classification — the boolean channel is not load-bearing on its own.',
    );
  }
}

// (4) Sanity control: BOTH channels stripped at once must correctly classify as NOT demo.
// Proves (2)/(3) pass because of genuine OR-logic across two independently-checked fields,
// not because isDemoTicketTypeDoc() is vacuously true for everything.
{
  const mutant = { ...demoDoc, demo: false, slug: 'not-demo-anymore' };
  if (isDemoTicketTypeDoc(mutant) !== false) {
    failures.push('(4) stripping BOTH channels still classified as demo — isDemoTicketTypeDoc() is vacuously true, proving nothing.');
  }
}

// (5) Firestore POSITION recoverability — positions never carry `demo`, only the ticketType
// slug string. This is the actual mechanism that lets a future cleanup query find every demo
// PURCHASE (not just the catalogue doc): `where('ticketType', '==', DEMO_TICKET_TYPE_SLUG)`.
const positions = [
  { bookingRef: 'AAA111', ticketType: 'adult' },
  { bookingRef: 'BBB222', ticketType: DEMO_TICKET_TYPE_SLUG },
  { bookingRef: 'CCC333', ticketType: 'child' },
];
const demoPositions = positions.filter((p) => isDemoTicketTypeSlug(p.ticketType));
if (demoPositions.length !== 1 || demoPositions[0].bookingRef !== 'BBB222') {
  failures.push(
    `(5) isDemoTicketTypeSlug() over a mixed position fixture found ${JSON.stringify(demoPositions.map((p) => p.bookingRef))}, expected exactly ['BBB222'].`,
  );
}

// (6) Defeating mutation for (5): a near-miss slug or the demo type's display NAME (not its
// slug) must NOT be caught — isDemoTicketTypeSlug() must be an exact match, not a loose
// `.includes()`/prefix match, or it would falsely tag real purchases (or miss genuine ones).
if (isDemoTicketTypeSlug('demo-general-admission-2') !== false) {
  failures.push('(6a) a near-miss slug was misclassified as demo — isDemoTicketTypeSlug() must be an exact match.');
}
if (isDemoTicketTypeSlug('General Admission (Demo)') !== false) {
  failures.push('(6b) the demo NAME (not slug) was misclassified as demo via isDemoTicketTypeSlug().');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: the dual-channel demo marker (catalogue `demo:true` boolean + reserved ticketType ' +
    'slug) survives either channel alone being accidentally stripped, is not vacuously true ' +
    '(both channels stripped together -> not demo), and the slug channel — the ONLY channel ' +
    'that survives onto a Firestore position — exact-matches rather than loosely matching.',
);
process.exit(0);
