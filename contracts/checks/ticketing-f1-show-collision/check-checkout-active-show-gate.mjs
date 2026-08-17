#!/usr/bin/env node
// Behavioural proof that the checkout route's new active-show gate (README's "What
// checkout actually gains in F1") is real branching logic, not a comment — exercised
// against FIXTURE data (per the brief's own "against fixture data" wording), not a
// live HTTP round trip, so this check never reserves a real Firestore ticket and needs
// no cleanup/withCleanup() ceremony.
//
// This imports checkout's exported, testable gate function directly — NOT the route's
// POST handler (which requires PayFast env vars, a running Firestore transaction, and
// would write a real reservation). @dev exposes a small, pure, exported helper for this
// purpose (see the function signature asserted below) alongside the route, the same
// pattern already used for isUsableAmount()/unusableTicketType() in that file.
//
// Run as: npx tsx contracts/checks/ticketing-f1-show-collision/check-checkout-active-show-gate.mjs
//
// WHY THE TSX CLI, NOT `node --import tsx/esm` (which every other check in this
// contract uses): this is the first check in the repo to import a route.ts file that
// itself uses `@/` tsconfig-path aliases (app/api/tickets/checkout/route.ts imports
// `@/lib/booking-ref`, `@/lib/firebase-admin`, etc.). Under `node --import tsx/esm`,
// tsx's loader hook resolves the entry file's own imports fine, but does not resolve
// `@/` aliases nested inside a FURTHER-imported .ts file — confirmed 2026-08-17:
// `Cannot find module '@/lib/booking-ref'` with the require stack pointing at
// route.ts, even though route.ts itself is never invoked with a bare module id. The
// `npx tsx` CLI runs the same tsx transform through its full CLI entrypoint, which
// resolves tsconfig paths at every import depth, and this file is unmodified between
// the two invocations — the assertion logic was never the problem. If a future check
// needs to import another file under app/ or components/ that uses `@/` imports, use
// `npx tsx`, not `node --import tsx/esm`.

import { ticketTypeMatchesActiveShow } from '../../../app/api/tickets/checkout/route.ts';

const failures = [];

// Positive: ticketType.show._ref matches the active show id.
{
  const result = ticketTypeMatchesActiveShow(
    { _id: 'ticketType-adult', show: { _ref: 'show-19-2027' } },
    'show-19-2027'
  );
  if (result !== true) {
    failures.push(`matching show._ref: expected true, got ${JSON.stringify(result)}`);
  }
}

// Negative: ticketType.show._ref points at a DIFFERENT show (e.g. a stale 2024 tier).
{
  const result = ticketTypeMatchesActiveShow(
    { _id: 'ticketType-old', show: { _ref: 'show-18-2024' } },
    'show-19-2027'
  );
  if (result !== false) {
    failures.push(`mismatched show._ref: expected false, got ${JSON.stringify(result)}`);
  }
}

// Negative: ticketType has no show reference at all (a pre-migration document).
{
  const result = ticketTypeMatchesActiveShow({ _id: 'ticketType-legacy' }, 'show-19-2027');
  if (result !== false) {
    failures.push(`missing show reference: expected false, got ${JSON.stringify(result)}`);
  }
}

// Negative: there is no active show at all (activeShowId is null) — must never match.
{
  const result = ticketTypeMatchesActiveShow(
    { _id: 'ticketType-adult', show: { _ref: 'show-19-2027' } },
    null
  );
  if (result !== false) {
    failures.push(`null active show id: expected false, got ${JSON.stringify(result)}`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: checkout\'s active-show gate matches, rejects a stale show, rejects a missing reference, and rejects a null active show — against fixture data, no live writes.');
process.exit(0);
