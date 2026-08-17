#!/usr/bin/env node
// fictional-test-show — the fictional show can never become active by accident, and its
// ticket type is refused by the real purchase gate by default. See golden README "The
// decision — three mechanisms, not one" and "The one human step this design cannot avoid".
//
// WHY `npx tsx`, NOT `node --import tsx/esm`: this imports app/api/tickets/checkout/route.ts,
// which itself uses `@/` tsconfig-path aliases in its own further imports — `node --import
// tsx/esm` fails to resolve those nested aliases; `npx tsx` resolves them at every depth. See
// contracts/checks/ticketing-f9-demo-ticket/check-active-show-scoping.mjs's header for the
// same empirical reasoning this check reuses verbatim.
//
// Run as: npx tsx contracts/checks/fictional-test-show/check-active-show-safety.mjs

import { resolveActiveShow } from '../../../lib/show-resolution.ts';
import { ticketTypeMatchesActiveShow } from '../../../app/api/tickets/checkout/route.ts';
import { planFictionalTestShowDocument } from '../../../lib/fictional-test-show-seed-plan.ts';
import { FICTIONAL_SHOW_ID } from '../../../lib/fictional-test-show.ts';

const failures = [];

// --- (1) planFictionalTestShowDocument() ALWAYS plans active:false, no matter the input ---

const fixtures = [
  { label: 'no existing shows at all', existing: [] },
  { label: 'a different real show exists', existing: [{ _id: 'show-19-2027', slug: 'show-19-2027' }] },
  // A fixture that already has a same-id doc "existing" is a skip-exists case, not a create —
  // still checked, to prove skip-exists never fabricates an `active` value either.
  { label: 'the fictional show already exists', existing: [{ _id: FICTIONAL_SHOW_ID, slug: 'fictional-test-show' }] },
];

for (const fixture of fixtures) {
  const plan = planFictionalTestShowDocument(fixture.existing);
  if (plan.action === 'create') {
    if (plan.document.active !== false) {
      failures.push(`(1) [${fixture.label}] planned document.active === ${plan.document.active}, expected false.`);
    }
    if (plan.document.status !== 'cancelled') {
      failures.push(`(1) [${fixture.label}] planned document.status === ${JSON.stringify(plan.document.status)}, expected 'cancelled'.`);
    }
    if (plan.document.fictionalTestData !== true) {
      failures.push(`(1) [${fixture.label}] planned document.fictionalTestData !== true.`);
    }
  } else if (plan.action !== 'skip-exists') {
    failures.push(`(1) [${fixture.label}] unexpected plan action ${JSON.stringify(plan.action)}.`);
  }
}

// --- (2) resolveActiveShow() excludes the fictional show, and fails closed on ambiguity ---

{
  // Real show active, fictional show inactive -> real show resolves; fictional show excluded.
  const shows = [
    { _id: 'show-19-2027', active: true },
    { _id: FICTIONAL_SHOW_ID, active: false },
  ];
  const activeId = resolveActiveShow(shows);
  if (activeId !== 'show-19-2027') {
    failures.push(`(2a) expected 'show-19-2027' to resolve as active, got ${JSON.stringify(activeId)}.`);
  }
}
{
  // Mutation: BOTH the real show and the fictional show marked active simultaneously — must
  // fail closed to null (no active show), not silently pick one.
  const shows = [
    { _id: 'show-19-2027', active: true },
    { _id: FICTIONAL_SHOW_ID, active: true },
  ];
  const activeId = resolveActiveShow(shows);
  if (activeId !== null) {
    failures.push(
      `(2b) two simultaneously active shows (real + fictional) resolved to ${JSON.stringify(activeId)} instead of failing closed to null.`,
    );
  }
}
{
  // Fictional show is the sole active show (the deliberate, human-supervised test window) —
  // this IS meant to resolve, proving the mechanism is a real toggle, not permanently inert.
  const shows = [
    { _id: 'show-19-2027', active: false },
    { _id: FICTIONAL_SHOW_ID, active: true },
  ];
  const activeId = resolveActiveShow(shows);
  if (activeId !== FICTIONAL_SHOW_ID) {
    failures.push(`(2c) fictional show as sole active show should resolve; got ${JSON.stringify(activeId)}.`);
  }
}

// --- (3) ticketTypeMatchesActiveShow() refuses the fictional ticket type by default ---

const fictionalTicketType = { _id: 'ticketType-fictional-test-show-general-admission', show: { _ref: FICTIONAL_SHOW_ID } };

{
  // Default state: real show active, fictional show not active -> refused.
  const activeShowId = resolveActiveShow([
    { _id: 'show-19-2027', active: true },
    { _id: FICTIONAL_SHOW_ID, active: false },
  ]);
  if (ticketTypeMatchesActiveShow(fictionalTicketType, activeShowId) !== false) {
    failures.push('(3a) fictional ticket type purchasable while the real show is active and the fictional show is not — the default-safe state is broken.');
  }
}
{
  // No active show at all (activeShowId === null) -> still refused, not defaulted open.
  if (ticketTypeMatchesActiveShow(fictionalTicketType, null) !== false) {
    failures.push('(3b) fictional ticket type purchasable with activeShowId === null.');
  }
}
{
  // The deliberate human-supervised window: fictional show IS the sole active show -> purchasable.
  const activeShowId = resolveActiveShow([
    { _id: 'show-19-2027', active: false },
    { _id: FICTIONAL_SHOW_ID, active: true },
  ]);
  if (ticketTypeMatchesActiveShow(fictionalTicketType, activeShowId) !== true) {
    failures.push('(3c) fictional ticket type NOT purchasable when the fictional show is deliberately the sole active show — the swap mechanism would be pointless.');
  }
}

if (failures.length > 0) {
  console.error('FAIL: check-active-show-safety\n' + failures.map((f) => ` - ${f}`).join('\n'));
  process.exit(1);
}

console.log('PASS: fictional-test-show is inert by default (never active, never purchasable) and becomes purchasable only when deliberately made the sole active show.');
