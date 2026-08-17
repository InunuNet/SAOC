#!/usr/bin/env node
// F8 (ticketing-foundation) — a comp order must be unambiguously distinguishable from a paid
// one when reconciled against PayFast settlements (mission brief: "a comp must never look like
// a payment that failed to settle"). Proven against the real buildCompOrderInput().
//
// Judgement call (see golden README "Comp amount/payment-field decision"): amount is 0 (not
// null) and status is 'paid' (not a separate 'comped' status) — a comp genuinely admits its
// holder immediately, so 'paid' is the honest status. `gateway: 'comp'` is the ONLY field a
// reconciliation script may rely on to exclude comps from revenue — never amount alone, because
// a future genuinely-free real ticket tier priced at exactly 0 would also have amount 0 without
// being a comp. This check asserts gateway is the discriminator and that every PayFast-specific
// identifier field (gatewayPaymentId, pf_payment_id, m_payment_id) is null, so a reconciliation
// join against real PayFast settlement records finds nothing to match, positively or negatively
// — a comp simply never appears in that dataset at all.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f8-comp-tickets/check-comp-shape-not-revenue.mjs

import { buildCompOrderInput, COMP_GATEWAY } from '../../../lib/comp-tickets.ts';

const failures = [];
const NOW = new Date('2027-02-10T09:00:00Z');

const built = buildCompOrderInput({
  showId: 'nationalShow',
  attendeeName: 'Test Attendee',
  attendeeEmail: 'attendee@example.com',
  ticketType: 'general-admission',
  issuedByEmail: 'manager@example.com',
  bookingRef: 'SAOC-2027-COMPSHAPE1',
  now: NOW,
});

if (COMP_GATEWAY !== 'comp') failures.push(`COMP_GATEWAY was '${COMP_GATEWAY}', expected 'comp'.`);
if (built.gateway !== 'comp') failures.push(`gateway was '${built.gateway}', expected 'comp'.`);
if (built.amount !== 0) failures.push(`amount was ${built.amount}, expected 0.`);
if (built.orderStatus !== 'paid') failures.push(`orderStatus was '${built.orderStatus}', expected 'paid'.`);
if (built.positionStatus !== 'paid') failures.push(`positionStatus was '${built.positionStatus}', expected 'paid'.`);
if (built.gatewayPaymentId !== null) failures.push(`gatewayPaymentId was '${built.gatewayPaymentId}', expected null.`);
if (built.pf_payment_id !== null) failures.push(`pf_payment_id was '${built.pf_payment_id}', expected null.`);
if (built.m_payment_id !== null) failures.push(`m_payment_id was '${built.m_payment_id}', expected null.`);
if (built.expiresAt !== null) {
  failures.push(`expiresAt was '${built.expiresAt}', expected null — a comp is never a reservable-then-expiring hold.`);
}

// The idempotency key must be deterministic and server-derived from the bookingRef — never
// echoing a client-supplied value the way checkout's Idempotency-Key header does, since a comp
// route accepts no such header at all — and must never collide with the two forbidden sentinel
// values checkout's own route refuses.
if (!built.idempotencyKey.includes('SAOC-2027-COMPSHAPE1')) {
  failures.push(`idempotencyKey ('${built.idempotencyKey}') is not derived from the bookingRef — cannot be traced back to the position it created.`);
}
const FORBIDDEN_IDEMPOTENCY_KEYS = new Set([
  '00000000-0000-0000-0000-000000000000',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
]);
if (FORBIDDEN_IDEMPOTENCY_KEYS.has(built.idempotencyKey)) {
  failures.push('idempotencyKey collided with a forbidden sentinel value.');
}

// Two different bookingRefs must never produce the same idempotencyKey — proving it is
// genuinely derived per-comp, not a shared constant that would dedupe unrelated comps onto one
// order the way a shared idempotency key does in checkout's own reservation logic.
const builtSecond = buildCompOrderInput({
  showId: 'nationalShow',
  attendeeName: 'Second Attendee',
  attendeeEmail: 'second@example.com',
  ticketType: 'general-admission',
  issuedByEmail: 'manager@example.com',
  bookingRef: 'SAOC-2027-COMPSHAPE2',
  now: NOW,
});
if (built.idempotencyKey === builtSecond.idempotencyKey) {
  failures.push('Two comps with different bookingRefs produced the same idempotencyKey.');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: buildCompOrderInput() produces a shape unambiguously distinguishable from a paid " +
    "order — gateway:'comp' as the sole reconciliation discriminator, amount 0, status 'paid', " +
    'every PayFast-specific identifier field null, and a deterministic per-comp idempotency ' +
    'key that never collides with the forbidden sentinel values or across different comps.',
);
process.exit(0);
