#!/usr/bin/env node
// fictional-test-show — planFictionalTestShowDocument() and
// planFictionalTestShowTicketTypeSeed() are pure, offline, idempotent decision functions,
// mirroring F9's A5 (contracts/checks/ticketing-f9-demo-ticket/check-seed-plan-idempotent.mjs).
//
// Run as: node --import tsx/esm contracts/checks/fictional-test-show/check-seed-plan-idempotent.mjs

import {
  planFictionalTestShowDocument,
  planFictionalTestShowTicketTypeSeed,
} from '../../../lib/fictional-test-show-seed-plan.ts';
import {
  FICTIONAL_SHOW_ID,
  FICTIONAL_SHOW_TICKET_TYPE_SLUG,
} from '../../../lib/fictional-test-show.ts';

const failures = [];

// --- show document: create -> skip on second run ---

const firstShowPlan = planFictionalTestShowDocument([{ _id: 'show-19-2027', slug: 'show-19-2027' }]);
if (firstShowPlan.action !== 'create') {
  failures.push(`(1) first run with no existing fictional show: expected 'create', got ${JSON.stringify(firstShowPlan)}.`);
} else {
  if (firstShowPlan.document.active !== false) failures.push('(1) first-run show plan active !== false.');
  if (firstShowPlan.document._id !== FICTIONAL_SHOW_ID) failures.push('(1) first-run show plan _id mismatch.');

  const secondShowPlan = planFictionalTestShowDocument([
    { _id: 'show-19-2027', slug: 'show-19-2027' },
    { _id: firstShowPlan.document._id, slug: firstShowPlan.document.slug.current },
  ]);
  if (secondShowPlan.action !== 'skip-exists' || secondShowPlan.existingId !== FICTIONAL_SHOW_ID) {
    failures.push(`(2) second run fed the first plan's own output back in: expected idempotent skip-exists, got ${JSON.stringify(secondShowPlan)}.`);
  }
}

// --- ticket type: create -> skip on second run, scoped to the fictional show ---

const firstTtPlan = planFictionalTestShowTicketTypeSeed([{ _id: 'ticketType-adult', slug: 'adult', show: { _ref: 'show-19-2027' } }]);
if (firstTtPlan.action !== 'create') {
  failures.push(`(3) first run with no existing fictional ticket type: expected 'create', got ${JSON.stringify(firstTtPlan)}.`);
} else {
  const doc = firstTtPlan.document;
  if (doc.show._ref !== FICTIONAL_SHOW_ID) failures.push('(3) first-run ticket type plan show._ref mismatch.');
  if (doc.slug.current !== FICTIONAL_SHOW_TICKET_TYPE_SLUG) failures.push('(3) first-run ticket type plan slug mismatch.');
  if (!(doc.price > 0)) failures.push(`(3) first-run ticket type plan price is not > 0 (got ${doc.price}).`);
  if (!(doc.capacity > 0)) failures.push(`(3) first-run ticket type plan capacity is not > 0 (got ${doc.capacity}).`);
  if (doc.active !== true) failures.push('(3) first-run ticket type plan active !== true.');
  if (doc.demo !== true) failures.push('(3) first-run ticket type plan demo !== true.');

  const secondTtPlan = planFictionalTestShowTicketTypeSeed([
    { _id: 'ticketType-adult', slug: 'adult', show: { _ref: 'show-19-2027' } },
    { _id: doc._id, slug: doc.slug.current, show: { _ref: doc.show._ref } },
  ]);
  if (secondTtPlan.action !== 'skip-exists' || secondTtPlan.existingId !== doc._id) {
    failures.push(`(4) second run fed the first plan's own output back in: expected idempotent skip-exists, got ${JSON.stringify(secondTtPlan)}.`);
  }

  // --- per-show dedup: a same-slug ticket type scoped to a DIFFERENT show must not block ---
  const differentShowSameSlug = [
    { _id: 'ticketType-adult', slug: 'adult', show: { _ref: 'show-19-2027' } },
    { _id: 'ticketType-legacy-fictional', slug: FICTIONAL_SHOW_TICKET_TYPE_SLUG, show: { _ref: 'show-18-2025' } },
  ];
  const thirdTtPlan = planFictionalTestShowTicketTypeSeed(differentShowSameSlug);
  if (thirdTtPlan.action !== 'create') {
    failures.push(
      `(5) an existing ticket type sharing the reserved slug but scoped to a DIFFERENT show ('show-18-2025') blocked seeding the fictional show's own copy — expected 'create', got ${JSON.stringify(thirdTtPlan)}. Dedup must be per-show, not a global slug lookup.`,
    );
  }
}

if (failures.length > 0) {
  console.error('FAIL: check-seed-plan-idempotent\n' + failures.map((f) => ` - ${f}`).join('\n'));
  process.exit(1);
}

console.log('PASS: fictional-test-show seed plans (show + ticket type) are idempotent, per-show-scoped, and always nonzero price/capacity.');
