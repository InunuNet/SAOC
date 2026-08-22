// A7/A8 — markOrderAndPositionPaidByPaymentId() (lib/orders.ts) must flip EVERY position
// belonging to a multi-line-item order to 'paid', not just one.
//
// WHY THIS IS THE HIGHEST-STAKES CHECK IN THIS CONTRACT
// This is not new logic being introduced — it is TODAY'S REAL, ALREADY-SHIPPED function,
// run against a fixture the current single-item checkout could never produce (an order
// with 3 positions). Its position lookup is
//   tickets.where('orderId', '==', orderRef.id).limit(1).get()
// — a `.limit(1)` written when one order always had exactly one position. Once F1 of this
// contract lands (checkout can create N positions per order), this line becomes a silent
// data-integrity defect: PayFast confirms the FULL order amount was paid, the order flips
// to 'paid', and the ITN reports success — while N-1 of the N tickets the buyer paid for
// stay 'reserved' forever (until TTL expiry silently drops them from capacity, at which
// point they simply vanish: paid for, never issued, never scannable at the door). This is
// the exact "order marked paid for money never received" defect class this project has
// already shipped and had to fix once (contracts/golden production-blockers-f4, referenced
// in the mission brief) — same shape, opposite direction (money WAS received; the ticket
// just never gets marked usable).
//
// This check proves BOTH halves against a fake, in-memory Firestore-shaped store — never
// live Firestore — by calling the REAL, exported markOrderAndPositionPaidByPaymentId():
//   A7 (RED against today's code): seed one order + 3 'reserved' positions sharing
//      orderId. Call the real current function. Assert the outcome.
//      TODAY: `committed: true` but only 1 of 3 positions is 'paid' — the other 2 are
//      silently left 'reserved'. This check FAILS today because it requires ALL 3 paid,
//      which the current `.limit(1)` cannot produce.
//   A8: the same fixture, restated as the explicit requirement the fix must satisfy —
//      kept as a second, named case so a partial fix (e.g. raising the limit to some
//      small constant instead of removing it) is caught by a DIFFERENT N than A7's setup
//      uses, rather than one lucky number happening to clear both.
//
// Named defeating mutation this check kills: reverting (or leaving) the position lookup
// at `.limit(1)`, or replacing it with any fixed limit smaller than the order's real
// position count.
//
// Run as: npx tsx contracts/checks/ticketing-multi-line-item-cart/check-itn-marks-all-positions-paid.mjs

import { markOrderAndPositionPaidByPaymentId } from '../../../lib/orders.ts';

const failures = [];

function makeFakeStore({ orderId, mPaymentId, positionIds }) {
  const orders = new Map();
  const tickets = new Map();

  orders.set(orderId, {
    showId: 'nationalShow',
    buyerName: 'Multi Item Buyer',
    buyerEmail: 'multi-item@example.com',
    amount: 900,
    status: 'reserved',
    expiresAt: null,
    idempotencyKey: 'idem-multi-itn-test',
    purchasedAt: null,
    gateway: 'payfast',
    gatewayPaymentId: null,
    m_payment_id: mPaymentId,
    pf_payment_id: null,
    recoveryToken: 'fake.recovery.token',
    recoveryTokenExpiresAt: null,
  });

  for (const positionId of positionIds) {
    tickets.set(positionId, {
      bookingRef: positionId,
      showId: 'nationalShow',
      attendeeName: `Attendee ${positionId}`,
      attendeeEmail: 'multi-item@example.com',
      ticketType: 'early-bird',
      status: 'reserved',
      amount: 300,
      purchasedAt: null,
      checkedInAt: null,
      m_payment_id: mPaymentId,
      pf_payment_id: null,
      orderId,
      compedBy: null,
      expiresAt: null,
    });
  }

  function docRef(collectionName, collectionMap, id) {
    return {
      id,
      __collection: collectionName,
      __map: collectionMap,
    };
  }

  const db = {
    collection(name) {
      const map = name === 'orders' ? orders : tickets;
      return {
        doc: (id) => docRef(name, map, id),
        where(field, op, value) {
          if (op !== '==') throw new Error(`fake store only supports '==', got '${op}'`);
          const matches = [...map.entries()].filter(([, data]) => data[field] === value);
          const toQuerySnapshot = (entries) => ({
            empty: entries.length === 0,
            docs: entries.map(([id, data]) => ({
              id,
              exists: true,
              data: () => data,
            })),
          });
          return {
            limit(n) {
              const limited = matches.slice(0, n);
              return { get: async () => toQuerySnapshot(limited) };
            },
            get: async () => toQuerySnapshot(matches),
          };
        },
      };
    },
    async runTransaction(fn) {
      const transaction = {
        async get(ref) {
          const data = ref.__map.get(ref.id);
          return { id: ref.id, exists: data !== undefined, data: () => data };
        },
        update(ref, patch) {
          const current = ref.__map.get(ref.id);
          if (!current) throw new Error(`fake store: update() on missing doc '${ref.id}'`);
          ref.__map.set(ref.id, { ...current, ...patch });
        },
        set(ref, data) {
          ref.__map.set(ref.id, data);
        },
      };
      return fn(transaction);
    },
  };

  return { db, orders, tickets };
}

// --- A7: today's code against a 3-position order -------------------------------------------

{
  const orderId = 'order-A7';
  const mPaymentId = 'SAOC-2027-A7ORDERREF01';
  const positionIds = ['SAOC-2027-A7POS0001', 'SAOC-2027-A7POS0002', 'SAOC-2027-A7POS0003'];
  const { db, tickets } = makeFakeStore({ orderId, mPaymentId, positionIds });

  const outcome = await markOrderAndPositionPaidByPaymentId(
    {
      m_payment_id: mPaymentId,
      gatewayPaymentId: 'pf-payment-a7',
      now: /** @type {any} */ ({ toMillis: () => 1_700_000_000_000 }),
      orderId,
      expectedGateway: 'payfast',
    },
    { db: /** @type {any} */ (db) }
  );

  if (!outcome.committed) {
    failures.push(`A7: expected committed:true, got committed:false (reason: ${outcome.reason}).`);
  } else {
    const paidCount = positionIds.filter((id) => tickets.get(id).status === 'paid').length;
    if (paidCount !== positionIds.length) {
      failures.push(
        `A7 (RED EXPECTED against unfixed lib/orders.ts): only ${paidCount} of ${positionIds.length} ` +
          `positions were marked 'paid'. markOrderAndPositionPaidByPaymentId's position lookup is ` +
          `still '.limit(1)'-shaped — it must be widened to find and update EVERY position sharing ` +
          `this order's orderId, or a real multi-item purchase leaves paid-for tickets stuck ` +
          `'reserved' forever.`
      );
    }
  }
}

// --- A8: same requirement, a DIFFERENT position count (2, not 3) so a fix that merely raises ---
// --- the limit to a fixed small number (e.g. `.limit(3)`) is still caught. ---------------------

{
  const orderId = 'order-A8';
  const mPaymentId = 'SAOC-2027-A8ORDERREF01';
  const positionIds = ['SAOC-2027-A8POS0001', 'SAOC-2027-A8POS0002'];
  const { db, tickets } = makeFakeStore({ orderId, mPaymentId, positionIds });

  const outcome = await markOrderAndPositionPaidByPaymentId(
    {
      m_payment_id: mPaymentId,
      gatewayPaymentId: 'pf-payment-a8',
      now: /** @type {any} */ ({ toMillis: () => 1_700_000_000_000 }),
      orderId,
      expectedGateway: 'payfast',
    },
    { db: /** @type {any} */ (db) }
  );

  if (!outcome.committed) {
    failures.push(`A8: expected committed:true, got committed:false (reason: ${outcome.reason}).`);
  } else {
    const paidCount = positionIds.filter((id) => tickets.get(id).status === 'paid').length;
    if (paidCount !== positionIds.length) {
      failures.push(
        `A8 (RED EXPECTED against unfixed lib/orders.ts): only ${paidCount} of ${positionIds.length} ` +
          `positions were marked 'paid' for a DIFFERENT order size than A7 — confirms the defect is ` +
          `the '.limit(1)' shape itself, not specific to a 3-position fixture.`
      );
    }
  }
}

// --- Negative control: a genuinely single-position order must still be marked paid, exactly as ---
// --- today (this is the case the ENTIRE live ticketing flow already depends on — this check ---
// --- must never regress it while fixing the N>1 case). --------------------------------------

{
  const orderId = 'order-single';
  const mPaymentId = 'SAOC-2027-SINGLEPOS01';
  const positionIds = ['SAOC-2027-SINGLEPOS01'];
  const { db, tickets } = makeFakeStore({ orderId, mPaymentId, positionIds });

  const outcome = await markOrderAndPositionPaidByPaymentId(
    {
      m_payment_id: mPaymentId,
      gatewayPaymentId: 'pf-payment-single',
      now: /** @type {any} */ ({ toMillis: () => 1_700_000_000_000 }),
      orderId,
      expectedGateway: 'payfast',
    },
    { db: /** @type {any} */ (db) }
  );

  if (!outcome.committed || tickets.get(positionIds[0]).status !== 'paid') {
    failures.push('NEGATIVE CONTROL FAILED: the existing single-position case must still pass today AND after the fix — this is the live, already-proven purchase path.');
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: markOrderAndPositionPaidByPaymentId marks every position of a multi-item order paid.');
