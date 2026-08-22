#!/usr/bin/env node
// A12 — Codex GPT-5.5 cross-model review (2026-08-22): the idempotent-reservation replay path in
// app/api/tickets/checkout/route.ts's reserveTicket() re-initiated an existing order using the NEW
// request's providerId instead of the order's ALREADY-STORED `gateway` field. Concretely: a buyer
// starts checkout with providerId=ozow (order.gateway='ozow' persisted), then retries (browser
// back-button resubmit, network retry) with providerId=payfast — the pre-fix code re-initiated the
// SAME order through PayFast while order.gateway in Firestore still read 'ozow'. A genuine
// money-routing integrity bug, not a legitimate use case: a real provider switch is a new checkout
// attempt and should mint a new idempotency key, not reuse the old one.
//
// THE FIX: replayGatewayMatches(storedGateway, requestedGateway) — a pure, exported guard —
// rejects (returns false) whenever storedGateway is DEFINED and disagrees with the request's
// providerId. reserveTicket() calls it before returning the 'replayed' outcome and returns
// { kind: 'key-provider-mismatch' } (mapped to a 409 in POST()) instead of silently proceeding
// with the mismatched provider. `storedGateway === undefined` (an order predating the `gateway`
// field) is NOT a mismatch — see the day-selection precedent
// (check-chosen-day-stripped-for-non-day-types.mjs) for why this project tests the pure decision
// function directly rather than driving the full route through a live Firestore round trip.
//
// This check proves the pure DECISION in isolation; check-replay-provider-mismatch-wiring.sh
// proves reserveTicket() actually calls it and maps a false result to a rejection, not to
// 'replayed'.
//
// Run as: npx tsx contracts/checks/ozow-m1-f2/check-replay-provider-mismatch-pure.mjs

import { replayGatewayMatches } from '../../../app/api/tickets/checkout/route.ts';

const failures = [];
function check(name, actual, expected) {
  if (actual !== expected) {
    failures.push(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// (1) CORE DEFECT: an order created under 'ozow', replayed with providerId='payfast', must be
// rejected — this is the exact scenario the bug report describes.
check(
  "(1) CORE DEFECT: stored 'ozow', requested 'payfast' → mismatch (false)",
  replayGatewayMatches('ozow', 'payfast'),
  false
);

// (2) The symmetric case: stored 'payfast', requested 'ozow' → also a mismatch.
check(
  "(2) stored 'payfast', requested 'ozow' → mismatch (false)",
  replayGatewayMatches('payfast', 'ozow'),
  false
);

// (3) The ordinary, non-attack case: same provider on replay → match (true), so a genuine retry
// (double-click, network blip) with the SAME providerId still gets its payment hand-off.
check(
  "(3) stored 'ozow', requested 'ozow' → match (true)",
  replayGatewayMatches('ozow', 'ozow'),
  true
);
check(
  "(4) stored 'payfast', requested 'payfast' → match (true)",
  replayGatewayMatches('payfast', 'payfast'),
  true
);

// (5) An order predating the `gateway` field (undefined) is not a mismatch against any requested
// provider — there is nothing to compare against, and rejecting it would be a regression for
// orders that exist today.
check(
  "(5) stored undefined (pre-F2 order), requested 'ozow' → match (true, nothing to compare)",
  replayGatewayMatches(undefined, 'ozow'),
  true
);
check(
  "(6) stored undefined (pre-F2 order), requested 'payfast' → match (true, nothing to compare)",
  replayGatewayMatches(undefined, 'payfast'),
  true
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: replayGatewayMatches() rejects a replay whose providerId disagrees with the order\'s stored gateway, in both directions, while leaving same-provider replays and pre-F2 (gateway-less) orders unaffected.'
);
