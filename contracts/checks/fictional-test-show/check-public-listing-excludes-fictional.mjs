#!/usr/bin/env node
// fictional-test-show — the fictional ticket type is excluded from the public /tickets
// listing via F9's REAL, UNMODIFIED filterPubliclyListableTicketTypes(). No new filtering
// code is introduced by this feature — see golden README "The decision — three mechanisms,
// not one" ("Reuse F9's demo flag...").
//
// Run as: node --import tsx/esm contracts/checks/fictional-test-show/check-public-listing-excludes-fictional.mjs

import { filterPubliclyListableTicketTypes } from '../../../lib/demo-ticket-type.ts';
import { FICTIONAL_SHOW_TICKET_TYPE_SLUG } from '../../../lib/fictional-test-show.ts';

const failures = [];

const realAdult = { slug: 'adult', name: 'Adult', demo: false };
const realChild = { slug: 'child', name: 'Child' }; // demo field absent — pre-F9 legacy shape
const f9Demo = { slug: 'demo-general-admission', name: 'General Admission (Demo)', demo: true };
const fictionalTicketType = {
  slug: FICTIONAL_SHOW_TICKET_TYPE_SLUG,
  name: 'General Admission (Fictional Test Show)',
  demo: true,
};

const mixed = [realAdult, f9Demo, realChild, fictionalTicketType];
const listed = filterPubliclyListableTicketTypes(mixed);
const listedSlugs = listed.map((t) => t.slug);

if (!listedSlugs.includes('adult')) failures.push('(1) real ticket type "adult" was filtered out — over-filtering.');
if (!listedSlugs.includes('child')) failures.push('(2) real ticket type "child" (no demo field at all) was filtered out — over-filtering.');
if (listedSlugs.includes('demo-general-admission')) {
  failures.push('(3) F9 demo ticket type was NOT filtered out — the reused mechanism is not actually excluding demo-marked entries.');
}
if (listedSlugs.includes(FICTIONAL_SHOW_TICKET_TYPE_SLUG)) {
  failures.push('(4) fictional-show ticket type was NOT filtered out — it would render on the real public /tickets page.');
}
if (listed.length !== 2) {
  failures.push(`(5) expected exactly 2 listed entries (adult, child), got ${listed.length}: ${JSON.stringify(listedSlugs)}.`);
}

// Order preservation for the surviving entries — proves the filter doesn't reorder as a side
// effect of removing entries from the middle of the array.
if (listedSlugs[0] !== 'adult' || listedSlugs[1] !== 'child') {
  failures.push(`(6) order not preserved for surviving entries: got ${JSON.stringify(listedSlugs)}.`);
}

if (failures.length > 0) {
  console.error('FAIL: check-public-listing-excludes-fictional\n' + failures.map((f) => ` - ${f}`).join('\n'));
  process.exit(1);
}

console.log('PASS: fictional-show ticket type (and F9 demo ticket type) excluded from the public listing; real entries untouched, order preserved.');
