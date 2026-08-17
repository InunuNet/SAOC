#!/usr/bin/env node
// fictional-test-show — marker recoverability on the two new Sanity document classifiers,
// mirroring F9's A3 (contracts/checks/ticketing-f9-demo-ticket/check-marker-recoverability.mjs)
// exactly, plus the one extra case this feature's own README calls out: F9's real demo ticket
// type must NOT be misclassified as fictional-show data.
//
// Run as: node --import tsx/esm contracts/checks/fictional-test-show/check-marker-recoverability.mjs

import {
  FICTIONAL_SHOW_ID,
  FICTIONAL_SHOW_SLUG,
  FICTIONAL_SHOW_TICKET_TYPE_SLUG,
  isFictionalTestShowDoc,
  isFictionalTestShowTicketTypeDoc,
  isFictionalTestShowTicketTypeSlug,
} from '../../../lib/fictional-test-show.ts';

import { DEMO_TICKET_TYPE_SLUG } from '../../../lib/demo-ticket-type.ts';

const failures = [];

// --- show document classifier ---

const fictionalShowDoc = { _id: FICTIONAL_SHOW_ID, slug: FICTIONAL_SHOW_SLUG, fictionalTestData: true };
const realShowDoc = { _id: 'show-19-2027', slug: 'show-19-2027', fictionalTestData: false };
// fictionalTestData entirely absent — the shape every pre-existing published show document
// has today, since this feature adds the field as optional/defaulted.
const legacyShowDoc = { _id: 'show-18-2025', slug: 'show-18-2025' };

if (isFictionalTestShowDoc(fictionalShowDoc) !== true) {
  failures.push('(1a) fictionalShowDoc (all channels set) misclassified as not-fictional.');
}
if (isFictionalTestShowDoc(realShowDoc) !== false) {
  failures.push('(1b) realShowDoc (real id/slug, flag false) misclassified as fictional.');
}
if (isFictionalTestShowDoc(legacyShowDoc) !== false) {
  failures.push('(1c) legacyShowDoc (no fictionalTestData field at all) misclassified as fictional.');
}

{
  const mutant = { ...fictionalShowDoc, fictionalTestData: false };
  if (isFictionalTestShowDoc(mutant) !== true) {
    failures.push('(2) stripping only fictionalTestData (id/slug untouched) lost fictional classification.');
  }
}
{
  const mutant = { ...fictionalShowDoc, _id: 'show-renamed-by-accident', slug: 'renamed-by-accident' };
  // Both id AND slug renamed together simulates the single realistic accident (a Studio
  // slug-and-id rename in one edit); fictionalTestData alone must still carry it.
  if (isFictionalTestShowDoc(mutant) !== true) {
    failures.push('(3) renaming id+slug (fictionalTestData:true left untouched) lost fictional classification.');
  }
}
{
  const mutant = { _id: 'show-renamed', slug: 'renamed', fictionalTestData: false };
  if (isFictionalTestShowDoc(mutant) !== false) {
    failures.push('(4) stripping every channel still classified as fictional — vacuously true.');
  }
}

// --- ticket type document classifier ---

const fictionalTicketTypeDoc = { slug: FICTIONAL_SHOW_TICKET_TYPE_SLUG, show: { _ref: FICTIONAL_SHOW_ID } };
const realTicketTypeDoc = { slug: 'adult', show: { _ref: 'show-19-2027' } };
// F9's real demo ticket type: scoped to the real active show, carrying `demo: true` — the
// exact shape this classifier must NOT sweep in. See golden README "Why classification keys
// off show._ref, not the shared demo boolean".
const f9DemoTicketTypeDoc = { slug: DEMO_TICKET_TYPE_SLUG, show: { _ref: 'show-19-2027' }, demo: true };

if (isFictionalTestShowTicketTypeDoc(fictionalTicketTypeDoc) !== true) {
  failures.push('(5a) fictionalTicketTypeDoc (both channels set) misclassified as not-fictional.');
}
if (isFictionalTestShowTicketTypeDoc(realTicketTypeDoc) !== false) {
  failures.push('(5b) realTicketTypeDoc misclassified as fictional.');
}
if (isFictionalTestShowTicketTypeDoc(f9DemoTicketTypeDoc) !== false) {
  failures.push(
    '(5c) F9 real demo ticket type (demo:true, real show, different slug) misclassified as ' +
      'fictional-show data — the classifier is keying off the shared `demo` boolean instead ' +
      'of show._ref/its own reserved slug.',
  );
}

{
  const mutant = { ...fictionalTicketTypeDoc, show: { _ref: 'show-19-2027' } };
  if (isFictionalTestShowTicketTypeDoc(mutant) !== true) {
    failures.push('(6) stripping only show._ref (slug untouched) lost fictional classification.');
  }
}
{
  const mutant = { ...fictionalTicketTypeDoc, slug: 'renamed-by-accident' };
  if (isFictionalTestShowTicketTypeDoc(mutant) !== true) {
    failures.push('(7) renaming only the slug (show._ref untouched) lost fictional classification.');
  }
}
{
  const mutant = { slug: 'renamed-by-accident', show: { _ref: 'show-19-2027' } };
  if (isFictionalTestShowTicketTypeDoc(mutant) !== false) {
    failures.push('(8) stripping BOTH channels still classified as fictional — vacuously true.');
  }
}

// --- Firestore position slug channel: exact match only ---

const slugCases = [
  { slug: FICTIONAL_SHOW_TICKET_TYPE_SLUG, expected: true, label: 'exact reserved slug' },
  { slug: DEMO_TICKET_TYPE_SLUG, expected: false, label: "F9's demo slug (must not collide)" },
  { slug: 'adult', expected: false, label: 'unrelated real slug' },
  {
    slug: `${FICTIONAL_SHOW_TICKET_TYPE_SLUG}-extra`,
    expected: false,
    label: 'near-miss suffix (must not prefix-match)',
  },
  {
    slug: FICTIONAL_SHOW_TICKET_TYPE_SLUG.slice(0, -1),
    expected: false,
    label: 'near-miss truncation (must not substring-match)',
  },
  { slug: null, expected: false, label: 'null ticketType' },
  { slug: undefined, expected: false, label: 'undefined ticketType' },
];

for (const testCase of slugCases) {
  const actual = isFictionalTestShowTicketTypeSlug(testCase.slug);
  if (actual !== testCase.expected) {
    failures.push(
      `(9) isFictionalTestShowTicketTypeSlug(${JSON.stringify(testCase.slug)}) [${testCase.label}]: expected ${testCase.expected}, got ${actual}.`,
    );
  }
}

if (failures.length > 0) {
  console.error('FAIL: check-marker-recoverability\n' + failures.map((f) => ` - ${f}`).join('\n'));
  process.exit(1);
}

console.log('PASS: fictional-test-show marker recoverability (show + ticket type classifiers, slug exact-match).');
