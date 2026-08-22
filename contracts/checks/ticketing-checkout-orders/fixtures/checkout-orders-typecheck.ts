// ticketing-checkout-orders (architect contract) — compiler-driven (not source-grep) proof of
// lib/checkout-reservation.ts's exported shapes. Run via its own scoped tsconfig (see that file)
// because the root tsconfig.json excludes `contracts/` from `pnpm type-check`.
//
// Three things proven here that the runtime checks (A3-A6) cannot see:
//   1. buildReservationDocs()'s return value is assignable to { order: Omit<Order,'id'>;
//      position: Omit<Ticket,'id'> & { idempotencyKey: string } } — the exact shape
//      writeReservationPair() accepts — not merely a structurally similar sibling type.
//   2. The REAL firebase-admin `Transaction` class structurally satisfies the new, narrow
//      `CreateCapableTransactionLike` interface with ZERO adapter code — proving
//      checkout/route.ts's real, already-open transaction can be passed straight into
//      writeReservationPair() without a wrapper. This is the type-level half of the "no nested
//      transaction" design decision recorded in the golden README's "Why writeReservationPair
//      takes an already-open transaction, not its own".
//   3. A minimal, fake, `create`-only transaction object (no `set`/`get`/`update`) is ALSO
//      accepted — proving the interface is deliberately narrow, matching only the one method
//      writeReservationPair() actually calls, the same "narrow structural interface" trick F8/F10
//      already established for OrdersFirestoreLike/OrdersFirestoreRwLike.
//
// Run as: npx tsc --noEmit -p contracts/checks/ticketing-checkout-orders/tsconfig.typecheck.json

import type { Transaction } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

import type {
  BuildReservationDocsInput,
  CreateCapableTransactionLike,
  ReservationDocs,
} from '../../../../lib/checkout-reservation';
import { buildReservationDocs, writeReservationPair } from '../../../../lib/checkout-reservation';

import type { Order, Ticket } from '../../../../types/index';

// --- buildReservationDocs() shape ---

const NOW = Timestamp.fromMillis(1_700_000_000_000);

const input: BuildReservationDocsInput = {
  orderId: 'fake-order-id',
  bookingRef: 'SAOC-2027-TYPECHECK01',
  showId: 'nationalShow',
  attendeeName: 'Test Attendee',
  attendeeEmail: 'attendee@example.com',
  ticketType: 'general-admission',
  amount: 250,
  gateway: 'payfast',
  idempotencyKey: 'idem-key-1',
  expiresAt: NOW,
  recoveryToken: 'fake.token.value',
  recoveryTokenExpiresAt: NOW,
  now: NOW,
};

const docs: ReservationDocs = buildReservationDocs(input);

// The order half must be assignable to Omit<Order, 'id'> — not a coincidentally similar sibling
// type — proving it really is a writable Order document body.
const orderBody: Omit<Order, 'id'> = docs.order;
void orderBody;

// The position half must be assignable to Omit<Ticket, 'id'>, PLUS it must additionally carry
// idempotencyKey (checkout's own backward-compatible field, additive on top of the Ticket type —
// see golden README "Position idempotencyKey stays"). A position literal missing idempotencyKey
// must NOT satisfy ReservationDocs['position'].
const positionBody: Omit<Ticket, 'id'> = docs.position;
void positionBody;
const idempotencyKeyOnPosition: string = docs.position.idempotencyKey;
void idempotencyKeyOnPosition;

// @ts-expect-error — idempotencyKey is required on the position half, not optional; a builder
// that forgets to set it must fail to compile, not silently produce `undefined`.
const missingIdempotencyKey: ReservationDocs['position'] = {
  bookingRef: 'x',
  showId: 'nationalShow',
  attendeeName: 'x',
  attendeeEmail: 'x@example.com',
  ticketType: 'general-admission',
  status: 'reserved',
  amount: 250,
  purchasedAt: null,
  checkedInAt: null,
  m_payment_id: null,
  pf_payment_id: null,
  orderId: 'fake-order-id',
  compedBy: null,
};
void missingIdempotencyKey;

// --- CreateCapableTransactionLike ---

// The REAL firebase-admin Transaction must structurally satisfy the new, narrow interface with
// zero adapter code — this is what lets checkout/route.ts pass its already-open transaction
// straight into writeReservationPair().
declare const realTransaction: Transaction;
const asCreateCapable: CreateCapableTransactionLike = realTransaction;
void asCreateCapable;

// A minimal fake that implements ONLY `create` must also satisfy the interface — proving it is
// deliberately narrow, not accidentally requiring `set`/`get`/`update` too.
const fakeTransaction: CreateCapableTransactionLike = {
  create: (_ref: { id: string }, _data: Record<string, unknown>) => {
    /* type-shape proof only */
  },
};

function callWriteReservationPair() {
  writeReservationPair(
    fakeTransaction,
    { orderRef: { id: 'order-1' }, positionRef: { id: 'SAOC-2027-TYPECHECK01' } },
    docs
  );
}
void callWriteReservationPair;
