// ticketing-multi-line-item-cart (architect contract) — compiler-driven (not source-grep)
// proof of the new multi-item exported shapes. Companion to the runtime checks (A3/A4/A6),
// which prove BEHAVIOUR; this proves the TYPES those behaviours are pinned to, including the
// one property no runtime test can show: that a client-supplied amount/price is IMPOSSIBLE
// to construct against the accepted request shape, not merely unused by convention.
//
// Run as: npx tsc --noEmit -p contracts/checks/ticketing-multi-line-item-cart/tsconfig.typecheck.json

import { Timestamp, type Transaction } from 'firebase-admin/firestore';

import type {
  BuildMultiReservationDocsInput,
  CreateCapableTransactionLike,
  LineItemPlan,
  MultiReservationDocs,
} from '../../../../lib/checkout-reservation';
import { buildMultiReservationDocs, writeMultiReservationPair } from '../../../../lib/checkout-reservation';

import type { CheckoutLineItemInput } from '../../../../app/api/tickets/checkout/route';

import type { Order, Ticket } from '../../../../types/index';

const NOW = Timestamp.fromMillis(1_700_000_000_000);

// --- A9: the client-facing line-item shape has NO amount/price field. Server-derived price ---
// --- is enforced by construction, not by convention — a request type that DID accept a ---
// --- client amount would compile here; this must fail to compile. ---

// CheckoutLineItemInput must not declare `amount` or `price`; the server derives both from
// Sanity per ticketType, never from the request body. If the directive below ever reports as
// unused, a client-supplied price has silently become constructible again.
//
// Directive placement: TypeScript reports an excess-property error on a multi-line fresh
// object literal AT THE OFFENDING PROPERTY'S OWN LINE, not at the assignment statement's line
// — a `@ts-expect-error` above the `const ... = {` line suppresses nothing (it targets the
// wrong line) and then reports itself unused, so BOTH the excess-property error and the
// unused-directive error would fire regardless of the implementation. The directive must sit
// directly above the offending property itself. Do not collapse this literal to one line just
// to make the directive easier to place — the next person would re-expand it for readability
// and silently reintroduce this exact bug.
const lineItemWithClientPrice: CheckoutLineItemInput = {
  ticketType: 'early-bird',
  attendeeName: 'Test Attendee',
  attendeeEmail: 'attendee@example.com',
  // @ts-expect-error — see the explanation above this object literal.
  amount: 1,
};
void lineItemWithClientPrice;

const validLineItem: CheckoutLineItemInput = {
  ticketType: 'early-bird',
  attendeeName: 'Test Attendee',
  attendeeEmail: 'attendee@example.com',
};
void validLineItem;

// --- buildMultiReservationDocs() shape ---

const linePlan: LineItemPlan = {
  ticketType: 'early-bird',
  attendeeName: 'Test Attendee',
  attendeeEmail: 'attendee@example.com',
  amount: 130,
  bookingRef: 'SAOC-2027-TYPECHECK01',
  chosenDay: null,
};

const input: BuildMultiReservationDocsInput = {
  orderId: 'fake-order-id',
  reference: 'SAOC-2027-TYPECHECK01',
  showId: 'nationalShow',
  lineItems: [linePlan],
  gateway: 'payfast',
  idempotencyKey: 'idem-key-1',
  expiresAt: NOW,
  recoveryToken: 'fake.token.value',
  recoveryTokenExpiresAt: NOW,
  now: NOW,
};

const docs: MultiReservationDocs = buildMultiReservationDocs(input);

const orderBody: Omit<Order, 'id'> = docs.order;
void orderBody;

// Every position must be assignable to Omit<Ticket, 'id'> PLUS carry idempotencyKey, same
// posture as the single-item ReservationDocs['position'] shape (F1 of ticketing-checkout-orders,
// UNCHANGED by this contract).
const positionBodies: (Omit<Ticket, 'id'> & { idempotencyKey: string })[] = docs.positions;
void positionBodies;

// @ts-expect-error — a positions array entry missing idempotencyKey must not satisfy
// MultiReservationDocs['positions'][number].
const missingIdempotencyKey: MultiReservationDocs['positions'][number] = {
  bookingRef: 'x',
  showId: 'nationalShow',
  attendeeName: 'x',
  attendeeEmail: 'x@example.com',
  ticketType: 'general-admission',
  status: 'reserved',
  amount: 130,
  purchasedAt: null,
  checkedInAt: null,
  m_payment_id: null,
  pf_payment_id: null,
  orderId: 'fake-order-id',
  compedBy: null,
};
void missingIdempotencyKey;

// --- writeMultiReservationPair() takes N position refs, and the SAME narrow, deliberately ---
// --- create()-only interface as the single-item writer (F1 of ticketing-checkout-orders) — ---
// --- proving the two writers share one transaction-capability contract, not two diverging ---
// --- ones. ---

declare const realTransaction: Transaction;
const asCreateCapable: CreateCapableTransactionLike = realTransaction;
void asCreateCapable;

const fakeTransaction: CreateCapableTransactionLike = {
  create: (_ref: { id: string }, _data: Record<string, unknown>) => {
    /* type-shape proof only */
  },
};

function callWriteMultiReservationPair() {
  writeMultiReservationPair(
    fakeTransaction,
    {
      orderRef: { id: 'order-1' },
      positionRefs: [{ id: 'SAOC-2027-TYPECHECK01' }],
    },
    docs
  );
}
void callWriteMultiReservationPair;
