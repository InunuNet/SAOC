#!/usr/bin/env node
// F9 (ticketing-foundation) — active-show scoping is real (design constraint: "a demo ticket
// type belonging to show A must not be purchasable against show B"), proven against the REAL,
// already-shipped resolveActiveShow() (lib/show-resolution.ts, F1) and
// ticketTypeMatchesActiveShow() (app/api/tickets/checkout/route.ts, F1) — entirely injected
// fixture show-activation arrays, no live Sanity read, no Date.now(). F9 adds no new scoping
// code of its own: the demo ticket type is scoped exactly like every other ticketType, by
// carrying a real `show` reference, so this check exists to prove that mechanism genuinely
// refuses a demo ticket type minted for the WRONG show, not merely that the function exists.
//
// WHY `npx tsx`, NOT `node --import tsx/esm`: this imports app/api/tickets/checkout/route.ts,
// which itself uses `@/` tsconfig-path aliases in its own further imports. See
// contracts/checks/ticketing-f1-show-collision/check-checkout-active-show-gate.mjs's header
// comment for the full empirical reasoning (`node --import tsx/esm` fails to resolve `@/`
// aliases nested past the entry file; `npx tsx` resolves them at every depth).
//
// Run as: npx tsx contracts/checks/ticketing-f9-demo-ticket/check-active-show-scoping.mjs

import { resolveActiveShow } from '../../../lib/show-resolution.ts';
import { ticketTypeMatchesActiveShow } from '../../../app/api/tickets/checkout/route.ts';

const failures = [];

const demoTicketType = { _id: 'ticketType-demo-show-19-2027', show: { _ref: 'show-19-2027' } };

// (1) show-19-2027 is the sole active show -> the demo ticket type scoped to it is purchasable.
{
  const shows = [
    { _id: 'show-18-2025', active: false },
    { _id: 'show-19-2027', active: true },
  ];
  const activeShowId = resolveActiveShow(shows);
  const result = ticketTypeMatchesActiveShow(demoTicketType, activeShowId);
  if (result !== true) {
    failures.push(
      `(1) demo ticketType scoped to show-19-2027, with show-19-2027 active: expected true, got ${JSON.stringify(result)}.`,
    );
  }
}

// (2) A DIFFERENT show becomes active instead — the same demo ticket type, still referencing
// show-19-2027, must be refused. This is the actual claim in the architect brief.
{
  const shows = [
    { _id: 'show-19-2027', active: false },
    { _id: 'show-20-2029', active: true },
  ];
  const activeShowId = resolveActiveShow(shows);
  const result = ticketTypeMatchesActiveShow(demoTicketType, activeShowId);
  if (result !== false) {
    failures.push(
      `(2) demo ticketType scoped to show-19-2027, with show-20-2029 active instead: expected false, got ${JSON.stringify(result)}.`,
    );
  }
}

// (3) Ambiguous data (two shows simultaneously active) — resolveActiveShow() fails closed to
// null (already proven by F1's own contract), and the demo ticket type must ALSO be refused
// in that state rather than falling back to "assume it's fine".
{
  const shows = [
    { _id: 'show-18-2025', active: true },
    { _id: 'show-19-2027', active: true },
  ];
  const activeShowId = resolveActiveShow(shows);
  const result = ticketTypeMatchesActiveShow(demoTicketType, activeShowId);
  if (activeShowId !== null || result !== false) {
    failures.push(
      `(3) two shows simultaneously active: expected resolveActiveShow -> null and match -> false, got activeShowId=${JSON.stringify(activeShowId)}, result=${JSON.stringify(result)}.`,
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: the demo ticket type is genuinely scoped to its show via the real, already-shipped ' +
    'resolveActiveShow()/ticketTypeMatchesActiveShow() — purchasable only while its own show ' +
    'is the sole active one, refused when a different show is active, refused when ' +
    'show-activation data is ambiguous.',
);
process.exit(0);
