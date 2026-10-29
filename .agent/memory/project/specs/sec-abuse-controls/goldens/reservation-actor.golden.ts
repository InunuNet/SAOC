// Golden for the actor stamp on checkout reservations (SEC-02): buildMultiReservationDocs()
// writes clientKey and buyerKey on the order and on EVERY position, null when absent, never undefined.
// Frozen by @architect. @dev implements against this and never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/sec-abuse-controls/goldens/reservation-actor.golden.ts
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../../..');
const ts = (ms: number) => Timestamp.fromMillis(ms); // a real Firestore Timestamp: the production rule is `instanceof Timestamp`

function baseInput(extra: Record<string, unknown>) {
  return {
    orderId: 'order-1',
    reference: 'REF-1',
    showId: 'nationalShow',
    lineItems: [
      { ticketType: 'vip', attendeeName: 'A One', attendeeEmail: 'a@example.org', amount: 300, bookingRef: 'REF-1', chosenDay: null },
      { ticketType: 'vip', attendeeName: 'B Two', attendeeEmail: 'b@example.org', amount: 300, bookingRef: 'REF-2', chosenDay: null },
    ],
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
    expiresAt: ts(2_000_000),
    recoveryToken: 'tok',
    recoveryTokenExpiresAt: ts(3_000_000),
    now: ts(1_000_000),
    gateway: 'ozow',
    expectedGatewayAmount: null,
    ...extra,
  };
}

function assertNoUndefined(value: unknown, where: string) {
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    assert.notEqual(inner, undefined, `${where}.${key} must not be undefined (Firestore rejects undefined)`);
  }
}

async function main() {
  const mod = await import(path.join(ROOT, 'lib/checkout-reservation.ts'));
  const { buildMultiReservationDocs } = mod;

  // With an actor: stamped on the order and on every position.
  {
    const docs = buildMultiReservationDocs(baseInput({ actor: { clientKey: 'c'.repeat(64), buyerKey: 'b'.repeat(64) } }));
    assert.equal(docs.order.clientKey, 'c'.repeat(64));
    assert.equal(docs.order.buyerKey, 'b'.repeat(64));
    assert.equal(docs.positions.length, 2);
    for (const position of docs.positions) {
      assert.equal(position.clientKey, 'c'.repeat(64));
      assert.equal(position.buyerKey, 'b'.repeat(64));
    }
  }

  // Without an actor (every pre-existing caller): explicit nulls, no undefined own-properties.
  {
    const docs = buildMultiReservationDocs(baseInput({}));
    assert.equal(docs.order.clientKey, null);
    assert.equal(docs.order.buyerKey, null);
    for (const position of docs.positions) {
      assert.equal(position.clientKey, null);
      assert.equal(position.buyerKey, null);
    }
    assertNoUndefined(docs.order, 'order');
    docs.positions.forEach((position: unknown, index: number) => assertNoUndefined(position, `positions[${index}]`));
  }

  // The stamp is an opaque keyed hash: the raw address/email never appears in the documents.
  {
    const docs = buildMultiReservationDocs(baseInput({ actor: { clientKey: 'k'.repeat(64), buyerKey: 'm'.repeat(64) } }));
    assert.ok(!JSON.stringify(docs).includes('203.0.113'));
  }

  console.log('reservation-actor golden: PASS');
}

main().catch((error) => {
  console.error('reservation-actor golden: FAIL');
  console.error(error);
  process.exit(1);
});
