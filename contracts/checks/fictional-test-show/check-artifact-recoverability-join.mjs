#!/usr/bin/env node
// fictional-test-show — classifyFictionalTestShowArtifacts() (lib/fictional-test-show-recoverability.ts)
// walks the three-hop recoverability chain against a MIXED fixture: real 2027-show artefacts,
// F9 demo-ticket-type artefacts, and fictional-show artefacts all present together in the same
// positions/orders/checkinAttempts arrays. See golden README "The recoverability chain, three
// hops".
//
// DEFEATING MUTATION named up front: the classifier either OVER-matching (sweeping the real
// show's or F9's demo artefacts into the fictional-show result set — the exact `demo`-boolean-
// adjacent confusion the README warns about, since positions carry no `demo` field but a naive
// re-implementation might key off some other shared attribute) or UNDER-matching (missing a
// genuine fictional-show artefact, e.g. by requiring BOTH the bookingRef join AND the orderId
// join on checkinAttempts instead of EITHER). The fixture below puts one of each kind (real,
// F9-demo, fictional) into every one of the three collections simultaneously, and additionally
// isolates the two independent checkinAttempts join paths (bookingRef-only, orderId-only) plus
// one deliberate near-miss (a checkinAttempt whose bookingRef matches a REAL position but whose
// orderId does not resolve to any matched order) — a check that only ever fed fictional-only
// fixtures would pass even if the join silently used AND instead of OR, or even if it matched
// on collection membership alone rather than the actual join keys.
//
// Run as: node --import tsx/esm contracts/checks/fictional-test-show/check-artifact-recoverability-join.mjs

import { classifyFictionalTestShowArtifacts } from '../../../lib/fictional-test-show-recoverability.ts';
import {
  FICTIONAL_SHOW_TICKET_TYPE_SLUG,
} from '../../../lib/fictional-test-show.ts';
import { DEMO_TICKET_TYPE_SLUG } from '../../../lib/demo-ticket-type.ts';

const failures = [];

// --- positions: one real, one F9-demo, two fictional-show (so the order join has two orders
// --- to collect, proving it isn't hardcoded to "exactly one") ---

const realPosition = {
  bookingRef: 'REAL001',
  ticketType: 'adult',
  orderId: 'order-real-001',
};
const f9DemoPosition = {
  bookingRef: 'DEMO001',
  ticketType: DEMO_TICKET_TYPE_SLUG,
  orderId: 'order-demo-001',
};
const fictionalPositionA = {
  bookingRef: 'FICT001',
  ticketType: FICTIONAL_SHOW_TICKET_TYPE_SLUG,
  orderId: 'order-fict-001',
};
const fictionalPositionB = {
  bookingRef: 'FICT002',
  ticketType: FICTIONAL_SHOW_TICKET_TYPE_SLUG,
  orderId: 'order-fict-002',
};
// A fictional-show position with no orderId at all (e.g. a reservation that never completed
// checkout) — must still be matched by the ticketType-slug channel; must contribute nothing
// to the orderId join set (no false order/checkinAttempt match off a null orderId).
const fictionalPositionUnpaid = {
  bookingRef: 'FICT003',
  ticketType: FICTIONAL_SHOW_TICKET_TYPE_SLUG,
  orderId: null,
};

const positions = [
  realPosition,
  f9DemoPosition,
  fictionalPositionA,
  fictionalPositionB,
  fictionalPositionUnpaid,
];

// --- orders: one real, one F9-demo, two fictional-show (matching the two paid positions above) ---

const orders = [
  { id: 'order-real-001' },
  { id: 'order-demo-001' },
  { id: 'order-fict-001' },
  { id: 'order-fict-002' },
];

// --- checkinAttempts: exercises both independent join paths, plus one deliberate near-miss ---

const checkinAttempts = [
  // (a) matches via bookingRef only (orderId null — a malformed/mis-scanned attempt).
  { bookingRef: 'FICT001', orderId: null },
  // (b) matches via orderId only (bookingRef null) — the orderId-only join path A8's
  // description calls out explicitly.
  { bookingRef: null, orderId: 'order-fict-002' },
  // (c) a REAL show's checkin attempt — must NOT be swept in.
  { bookingRef: 'REAL001', orderId: 'order-real-001' },
  // (d) an F9 demo checkin attempt — must NOT be swept in.
  { bookingRef: 'DEMO001', orderId: 'order-demo-001' },
  // (e) near-miss: bookingRef matches a REAL position, but orderId is absent/doesn't resolve
  // to any matched (fictional) order — must be excluded. If the classifier used a looser join
  // (e.g. "bookingRef looks unfamiliar, include it") this would be wrongly swept in.
  { bookingRef: 'REAL001', orderId: null },
];

const report = classifyFictionalTestShowArtifacts({ positions, orders, checkinAttempts });

// --- positions: exactly the three fictional-show positions, nothing else ---

const positionRefs = report.positions.map((p) => p.bookingRef).sort();
const expectedPositionRefs = ['FICT001', 'FICT002', 'FICT003'].sort();
if (JSON.stringify(positionRefs) !== JSON.stringify(expectedPositionRefs)) {
  failures.push(
    `(1) positions: expected exactly ${JSON.stringify(expectedPositionRefs)}, got ${JSON.stringify(positionRefs)}.`,
  );
}

// --- orders: exactly the two fictional-show orders (the unpaid position's null orderId must
// --- not contribute a phantom match) ---

const orderIds = report.orders.map((o) => o.id).sort();
const expectedOrderIds = ['order-fict-001', 'order-fict-002'].sort();
if (JSON.stringify(orderIds) !== JSON.stringify(expectedOrderIds)) {
  failures.push(`(2) orders: expected exactly ${JSON.stringify(expectedOrderIds)}, got ${JSON.stringify(orderIds)}.`);
}

// --- checkinAttempts: exactly the bookingRef-only match (a) and the orderId-only match (b) ---

const checkinKeys = report.checkinAttempts
  .map((c) => `${c.bookingRef ?? 'null'}/${c.orderId ?? 'null'}`)
  .sort();
const expectedCheckinKeys = ['FICT001/null', 'null/order-fict-002'].sort();
if (JSON.stringify(checkinKeys) !== JSON.stringify(expectedCheckinKeys)) {
  failures.push(
    `(3) checkinAttempts: expected exactly ${JSON.stringify(expectedCheckinKeys)}, got ${JSON.stringify(checkinKeys)}. ` +
      `This must include both independent join paths (bookingRef-only, orderId-only) and ` +
      `exclude the real-show near-miss (bookingRef matches a real position, orderId doesn't ` +
      `resolve to a fictional order) and the real/F9-demo attempts.`,
  );
}

// --- non-vacuous: the result must not be empty (a classifier that always returns {} would
// --- pass an under-specified "no real/demo artefacts leaked" check trivially) ---

if (report.positions.length === 0 || report.orders.length === 0 || report.checkinAttempts.length === 0) {
  failures.push(
    '(4) classifyFictionalTestShowArtifacts() returned an empty collection somewhere — ' +
      'vacuously strict, proving nothing about genuine matches.',
  );
}

if (failures.length > 0) {
  console.error('FAIL: check-artifact-recoverability-join\n' + failures.map((f) => ` - ${f}`).join('\n'));
  process.exit(1);
}

console.log(
  'PASS: classifyFictionalTestShowArtifacts() finds exactly the fictional-show artefacts ' +
    'across positions, orders, and checkinAttempts in a mixed real/F9-demo/fictional fixture ' +
    "— both checkinAttempts join paths (bookingRef-only, orderId-only) independently proven, " +
    "a real-show near-miss correctly excluded, and the result is non-empty.",
);
process.exit(0);
