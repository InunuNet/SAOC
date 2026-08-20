// A5 — getConfirmedOrderForDisplay() (lib/orders.ts, new additive export, F3 of this
// contract) must return EVERY paid position belonging to an order, not just the one the
// existing single-position getConfirmedTicketForDisplay() resolves.
//
// WHY A NEW FUNCTION, PROVEN SEPARATELY, RATHER THAN ASSERTING THE PAGE DIRECTLY
// The confirmation page (app/(marketing)/tickets/confirmation/page.tsx) is a Server
// Component reading live Firestore — this project's own convention
// (contracts/checks/ticketing-hardening/_shared.mjs) is that genuinely live, rendered-
// page behaviour is proven with a real HTTP round trip against a running dev server and
// real Firestore, which this architect pass is expressly forbidden from running (no live
// Firestore/network). What CAN be proven here, with a fake Firestore-shaped store and the
// REAL exported function, is the data-layer half: given an order with N paid positions,
// does the lookup return all N. Whether the PAGE actually renders what this function
// returns (one card per position, correct QR per position) is a rendering claim this
// check cannot make — see the contract's README "BrowserAgent verification checklist"
// for that half.
//
// THE DEFECT CLASS THIS TARGETS
// The literal, laziest way to "support" multi-item orders on the confirmation page is to
// keep calling the existing single-position getConfirmedTicketForDisplay(reference) —
// since `reference` (per contract-ticketing-multi-line-item-cart's own decision) IS a
// real position's own bookingRef, that call does not error, it just silently shows ONE
// ticket and never surfaces that N-1 more exist. This check proves the NEW function
// resolves through the ORDER (via m_payment_id), not through a single position doc.
//
// This check imports a function that does not exist on the current tree — expected to
// fail with a module-resolution error until @dev adds it per F3.
//
// Run as: npx tsx contracts/checks/ticketing-multi-line-item-cart-ui/check-confirmation-shows-all-positions.mjs

import { getConfirmedOrderForDisplay } from '../../../lib/orders.ts';

const failures = [];

function makeFakeStore({ orderId, reference, orderStatus, positions }) {
  const orders = new Map();
  const tickets = new Map();

  orders.set(orderId, {
    showId: 'nationalShow',
    buyerName: 'Cart Buyer',
    buyerEmail: 'cart-buyer@example.com',
    amount: positions.reduce((sum, p) => sum + p.amount, 0),
    status: orderStatus,
    expiresAt: null,
    idempotencyKey: 'idem-confirmation-test',
    purchasedAt: null,
    gateway: 'payfast',
    gatewayPaymentId: 'pf-payment-confirmation',
    m_payment_id: reference,
    pf_payment_id: null,
  });

  for (const p of positions) {
    tickets.set(p.bookingRef, {
      bookingRef: p.bookingRef,
      showId: 'nationalShow',
      attendeeName: p.attendeeName,
      attendeeEmail: 'cart-buyer@example.com',
      ticketType: p.ticketType,
      status: p.status,
      amount: p.amount,
      purchasedAt: null,
      checkedInAt: null,
      m_payment_id: reference,
      pf_payment_id: null,
      orderId,
      compedBy: null,
      expiresAt: null,
    });
  }

  return {
    async collection(name) {
      return name === 'orders' ? orders : tickets;
    },
    orders,
    tickets,
  };
}

// A minimal fake `getFirestore`-shaped store is not straightforward to inject without
// knowing @dev's exact deps-injection convention for this new function (F3 leaves that to
// @dev, matching this project's own deps.db?: ... optional-override convention used by
// createOrderWithPosition/markOrderAndPositionPaidByPaymentId). This check therefore
// calls getConfirmedOrderForDisplay with a SECOND argument shaped like those functions'
// existing `deps` parameter — `{ db }` — where `db` exposes exactly `collection(name)`
// returning an object with `.doc(id).get()` and `.where(field, op, value).get()`, the
// same minimal surface every other deps.db fake in this project's contracts already uses.
function wrapAsFirestoreLike(store) {
  function toDocSnapshot(id, data) {
    return { id, exists: data !== undefined, data: () => data };
  }
  function makeCollection(map) {
    return {
      doc: (id) => ({
        get: async () => toDocSnapshot(id, map.get(id)),
      }),
      where(field, op, value) {
        if (op !== '==') throw new Error(`fake store only supports '==', got '${op}'`);
        const matches = [...map.entries()].filter(([, data]) => data[field] === value);
        return {
          limit(n) {
            const limited = matches.slice(0, n);
            return { get: async () => ({ empty: limited.length === 0, docs: limited.map(([id, data]) => toDocSnapshot(id, data)) }) };
          },
          get: async () => ({ empty: matches.length === 0, docs: matches.map(([id, data]) => toDocSnapshot(id, data)) }),
        };
      },
    };
  }
  return {
    collection: (name) => (name === 'orders' ? makeCollection(store.orders) : makeCollection(store.tickets)),
  };
}

async function fakeGenerateQrDataUri(bookingRef) {
  return `data:image/png;fake-qr-for-${bookingRef}`;
}

// --- A5: a 3-position paid order must return all 3 positions ---------------------------------

{
  const reference = 'SAOC-2027-CONFIRMTEST01';
  const store = makeFakeStore({
    orderId: 'order-confirm-1',
    reference,
    orderStatus: 'paid',
    positions: [
      { bookingRef: reference, ticketType: 'early-bird', attendeeName: 'Attendee One', amount: 130, status: 'paid' },
      { bookingRef: 'SAOC-2027-CONFIRMTEST02', ticketType: 'day-visitor', attendeeName: 'Attendee Two', amount: 150, status: 'paid' },
      { bookingRef: 'SAOC-2027-CONFIRMTEST03', ticketType: 'vip', attendeeName: 'Attendee Three', amount: 300, status: 'checked-in' },
    ],
  });

  const result = await getConfirmedOrderForDisplay(reference, {
    db: /** @type {any} */ (wrapAsFirestoreLike(store)),
    generateQrDataUri: fakeGenerateQrDataUri,
  });

  if (!result) {
    failures.push('A5: expected a non-null result for a paid 3-position order, got null.');
  } else if (result.positions.length !== 3) {
    failures.push(
      `A5 (RED EXPECTED — function does not exist yet): expected 3 positions, got ${result.positions.length}. ` +
        `A confirmation lookup keyed on a single position document would return exactly 1 here.`
    );
  } else {
    const bookingRefs = result.positions.map((p) => p.bookingRef).sort();
    const expected = [reference, 'SAOC-2027-CONFIRMTEST02', 'SAOC-2027-CONFIRMTEST03'].sort();
    if (JSON.stringify(bookingRefs) !== JSON.stringify(expected)) {
      failures.push(`A5: position bookingRefs were ${JSON.stringify(bookingRefs)}, expected ${JSON.stringify(expected)}.`);
    }
    for (const p of result.positions) {
      if (!p.qrDataUri || !p.qrDataUri.includes(p.bookingRef)) {
        failures.push(`A5: position '${p.bookingRef}' does not carry its OWN QR (each ticket must be independently scannable).`);
      }
    }
  }
}

// --- Negative control: a genuinely single-position order (N=1, today's only real shape) ---
// --- must still resolve to exactly one position — no regression to the live path. ---------

{
  const reference = 'SAOC-2027-CONFIRMSINGLE1';
  const store = makeFakeStore({
    orderId: 'order-confirm-single',
    reference,
    orderStatus: 'paid',
    positions: [{ bookingRef: reference, ticketType: 'early-bird', attendeeName: 'Solo Attendee', amount: 130, status: 'paid' }],
  });

  const result = await getConfirmedOrderForDisplay(reference, {
    db: /** @type {any} */ (wrapAsFirestoreLike(store)),
    generateQrDataUri: fakeGenerateQrDataUri,
  });

  if (!result || result.positions.length !== 1) {
    failures.push('NEGATIVE CONTROL FAILED: a single-position order must still resolve to exactly one position.');
  }
}

// --- Fail-closed control: a 'reserved' (unpaid) order must resolve to null, exactly like ---
// --- the existing single-position function's status gate. -----------------------------------

{
  const reference = 'SAOC-2027-CONFIRMUNPAID1';
  const store = makeFakeStore({
    orderId: 'order-confirm-unpaid',
    reference,
    orderStatus: 'reserved',
    positions: [{ bookingRef: reference, ticketType: 'early-bird', attendeeName: 'Unpaid Attendee', amount: 130, status: 'reserved' }],
  });

  const result = await getConfirmedOrderForDisplay(reference, {
    db: /** @type {any} */ (wrapAsFirestoreLike(store)),
    generateQrDataUri: fakeGenerateQrDataUri,
  });

  if (result !== null) {
    failures.push('FAIL-CLOSED CONTROL FAILED: a reserved (unpaid) order must resolve to null, not a partial/pending display.');
  }
}

// --- MUTATION-DISCRIMINATION GAP CLOSED (found 2026-08-20): the control above alone does ---
// --- NOT isolate the ORDER-level status gate from the POSITION-level status filter — its ---
// --- position also carries 'reserved', so removing ONLY the order-level ---
// --- `order?.status !== 'paid'` guard still returns null via the UNRELATED "zero confirmed ---
// --- positions after filtering" path, and the check passed even with the order-level gate ---
// --- deleted entirely (verified by mutation). This case gives the order a genuinely 'paid' ---
// --- POSITION while the ORDER itself stays 'reserved' — a data-inconsistency that should ---
// --- not occur in practice, but isolates exactly which guard is doing the work: if the ---
// --- order-level gate is removed, this position-level-confirmable ticket would leak through. ---

{
  const reference = 'SAOC-2027-CONFIRMORDERGATE1';
  const store = makeFakeStore({
    orderId: 'order-confirm-order-gate-isolation',
    reference,
    orderStatus: 'reserved', // the order itself is NOT paid
    positions: [{ bookingRef: reference, ticketType: 'early-bird', attendeeName: 'Isolation Attendee', amount: 130, status: 'paid' }], // but its position IS
  });

  const result = await getConfirmedOrderForDisplay(reference, {
    db: /** @type {any} */ (wrapAsFirestoreLike(store)),
    generateQrDataUri: fakeGenerateQrDataUri,
  });

  if (result !== null) {
    failures.push(
      'FAIL-CLOSED CONTROL (ORDER-GATE ISOLATION) FAILED: an order whose OWN status is not ' +
        "'paid' must resolve to null even when one of its positions is individually 'paid' — " +
        'this isolates the order-level gate from the position-level status filter, which the ' +
        "earlier control (both order AND position 'reserved') cannot distinguish."
    );
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: getConfirmedOrderForDisplay() returns every paid position of an order, fails closed on an unpaid order.');
