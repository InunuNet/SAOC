#!/usr/bin/env node
// A3 — THE ORDER'S PERSISTED `gateway` FIELD REFLECTS THE ACTUALLY-CHOSEN PROVIDER, NOT A
// HARDCODED CONSTANT. FOUND BY ARCHITECT DURING F2 CONTRACT-WRITING, NOT NAMED IN THE MISSION
// BRIEF — the brief only says "store providerId on the order"; it does not say the codebase
// already has an order-level `gateway: string | null` field (types/index.ts:207) that is exactly
// this concept, or that lib/checkout-reservation.ts's buildReservationDocs() AND
// buildMultiReservationDocs() (the one checkout/route.ts's reserveTicket() actually calls) both
// write `gateway: PAYFAST_GATEWAY` — a MODULE-LEVEL CONSTANT, never read from any input — as of
// 2026-08-22, before this feature touches anything. Left unchanged, F2 would let a buyer choose
// Ozow at checkout, pay through Ozow, and have their order permanently record `gateway: 'payfast'`
// — silently wrong data on every single Ozow order, discoverable only by a human reading Firestore
// directly, not by anything in this feature's own registry/route assertions (A1/A2 both test the
// SELECTION, never the WRITE).
//
// THE FIX: BuildReservationDocsInput and BuildMultiReservationDocsInput both gain a required
// `gateway: string` field, threaded from checkout/route.ts's resolved providerId (the SAME value
// validated by A2, never re-derived) into the order body's `gateway` field, replacing the
// hardcoded PAYFAST_GATEWAY constant in the returned order object. This is additive to both
// input interfaces (a new required field, not a signature-breaking rename) and every existing
// caller (checkout/route.ts, and any fixture/test caller) must be updated to pass it explicitly —
// there is no legitimate default, because "assume PayFast" is the exact defect this exists to
// kill.
//
// WHAT MAKES THIS FAIL: `gateway` in the returned order object not matching `input.gateway`;
// PAYFAST_GATEWAY (or any other string literal) still appearing as the value regardless of what
// was passed in; the field accepted but silently ignored (case 2 proves this — pass 'ozow', require
// the OUTPUT to say 'ozow', not merely that the call did not throw).
//
// Run as: npx tsx contracts/checks/ozow-m1-f2/check-gateway-threading.mjs

import { Timestamp } from 'firebase-admin/firestore';
import { buildReservationDocs, buildMultiReservationDocs } from '../../../lib/checkout-reservation.ts';

const failures = [];
const ok = (name, cond, detail = '') => {
  if (!cond) failures.push(`${name}${detail ? `\n    ${detail}` : ''}`);
};

const now = Timestamp.now();
const baseSingle = {
  orderId: 'order-1',
  bookingRef: 'BR-1',
  showId: 'show-1',
  attendeeName: 'Test Buyer',
  attendeeEmail: 'buyer@example.com',
  ticketType: 'day-visitor',
  amount: 150,
  idempotencyKey: '11111111-1111-1111-1111-111111111111',
  expiresAt: now,
  recoveryToken: 'tok',
  recoveryTokenExpiresAt: now,
  now,
};

const baseMulti = {
  orderId: 'order-2',
  reference: 'BR-2',
  showId: 'show-1',
  lineItems: [
    {
      ticketType: 'day-visitor',
      attendeeName: 'A',
      attendeeEmail: 'a@example.com',
      amount: 150,
      bookingRef: 'BR-2',
      chosenDay: undefined,
    },
  ],
  idempotencyKey: '22222222-2222-2222-2222-222222222222',
  expiresAt: now,
  recoveryToken: 'tok',
  recoveryTokenExpiresAt: now,
  now,
};

// Case 1: buildReservationDocs — 'ozow' in, 'ozow' out (fails today: always 'payfast').
{
  const { order } = buildReservationDocs({ ...baseSingle, gateway: 'ozow' });
  ok('case 1: buildReservationDocs writes gateway="ozow" when given gateway="ozow"',
    order.gateway === 'ozow', `actual: ${JSON.stringify(order.gateway)}`);
}

// Case 2: buildReservationDocs — 'payfast' still round-trips correctly (no regression for the
// existing gateway's behaviour).
{
  const { order } = buildReservationDocs({ ...baseSingle, gateway: 'payfast' });
  ok('case 2: buildReservationDocs writes gateway="payfast" when given gateway="payfast"',
    order.gateway === 'payfast', `actual: ${JSON.stringify(order.gateway)}`);
}

// Case 3: buildMultiReservationDocs — the function checkout/route.ts's reserveTicket() ACTUALLY
// calls. This is the one that matters in production; case 1/2 alone would pass even if only the
// single-item builder were fixed and the real call site (multi) were left hardcoded.
{
  const { order } = buildMultiReservationDocs({ ...baseMulti, gateway: 'ozow' });
  ok('case 3: buildMultiReservationDocs writes gateway="ozow" when given gateway="ozow"',
    order.gateway === 'ozow', `actual: ${JSON.stringify(order.gateway)}`);
}

// Case 4: buildMultiReservationDocs — 'payfast' still round-trips (regression continuity for the
// live gateway).
{
  const { order } = buildMultiReservationDocs({ ...baseMulti, gateway: 'payfast' });
  ok('case 4: buildMultiReservationDocs writes gateway="payfast" when given gateway="payfast"',
    order.gateway === 'payfast', `actual: ${JSON.stringify(order.gateway)}`);
}

if (failures.length > 0) {
  console.error(`FAIL — ${failures.length} case(s):\n\n${failures.join('\n\n')}`);
  process.exit(1);
}
console.log('PASS — order.gateway reflects the resolved provider, not a hardcoded constant.');
