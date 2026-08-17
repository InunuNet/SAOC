// F8 (ticketing-foundation) — compiler-driven (not source-grep) proof of lib/comp-tickets.ts's
// exported shapes and of lib/orders.ts's / types/index.ts's F8 extensions. Run via its own
// scoped tsconfig (see that file) because the root tsconfig.json excludes `contracts/` from
// `pnpm type-check`.
//
// Four things proven here that the runtime checks (A3-A7) cannot see:
//   1. buildCompOrderInput()'s return value is assignable to CreateOrderPositionInput — the
//      exact shape createOrderWithPosition() accepts — not merely a structurally similar
//      sibling type that happens to satisfy the runtime checks by accident.
//   2. A pre-F8-shaped CreateOrderPositionInput literal that never mentions `compedBy` still
//      compiles — the field is additive, not required.
//   3. createOrderWithPosition() can be called with NO second argument at all (F2's original,
//      backward-compatible call shape) and separately with an OrdersFirestoreLike-shaped fake
//      object injected as deps.db.
//   4. A pre-F8-shaped Ticket literal that never mentions `compedBy` still compiles, alongside
//      one that sets it to a real string and one that sets it to null.
//
// Run as: npx tsc --noEmit -p contracts/checks/ticketing-f8-comp-tickets/tsconfig.typecheck.json

import type { BuildCompOrderInput, CompOrderPositionInput } from '../../../../lib/comp-tickets';
import { buildCompOrderInput, COMP_GATEWAY } from '../../../../lib/comp-tickets';

import type {
  CreateOrderPositionInput,
  OrdersFirestoreLike,
  OrdersTransactionLike,
} from '../../../../lib/orders';
import { createOrderWithPosition } from '../../../../lib/orders';

import type { Ticket } from '../../../../types/index';

// --- lib/comp-tickets.ts ---

const buildInput: BuildCompOrderInput = {
  showId: 'nationalShow',
  attendeeName: 'Test Attendee',
  attendeeEmail: 'attendee@example.com',
  ticketType: 'general-admission',
  issuedByEmail: 'manager@example.com',
  bookingRef: 'SAOC-2027-TYPECHECK01',
  now: new Date(),
};

const built: CompOrderPositionInput = buildCompOrderInput(buildInput);

// COMP_GATEWAY is typed narrowly enough to assign into a literal 'comp' slot, not widened to
// `string` — a future edit that widens it would still compile here, but this line is what would
// catch the const being deleted or renamed.
const gatewayCheck: 'comp' = COMP_GATEWAY;
void gatewayCheck;

// The built shape is directly usable as createOrderWithPosition()'s input — proving
// CompOrderPositionInput really is assignable to CreateOrderPositionInput, not a coincidentally
// similar sibling type.
const asOrderPositionInput: CreateOrderPositionInput = built;
void asOrderPositionInput;

// --- lib/orders.ts (extended) ---

// A pre-F8-shaped CreateOrderPositionInput literal that never mentions `compedBy` must still
// compile — additive, not required.
const preF8Input: CreateOrderPositionInput = {
  bookingRef: 'SAOC-2027-TYPECHECK02',
  showId: 'nationalShow',
  buyerName: 'Buyer',
  buyerEmail: 'buyer@example.com',
  attendeeName: 'Attendee',
  attendeeEmail: 'attendee@example.com',
  ticketType: 'general-admission',
  amount: 250,
  orderStatus: 'reserved',
  positionStatus: 'reserved',
  idempotencyKey: 'idem-key-1',
  expiresAt: null,
  purchasedAt: null,
  gateway: null,
  gatewayPaymentId: null,
  m_payment_id: null,
  pf_payment_id: null,
};

// createOrderWithPosition() with NO second argument — F2's original call shape — must still
// compile.
async function backwardCompatibleCall() {
  return createOrderWithPosition(preF8Input);
}
void backwardCompatibleCall;

// A minimal OrdersFirestoreLike-shaped fake object must be accepted as deps.db.
const fakeDb: OrdersFirestoreLike = {
  collection: (_name: string) => ({
    doc: (id?: string) => ({ id: id ?? 'fake-id' }),
  }),
  runTransaction: async <T,>(fn: (transaction: OrdersTransactionLike) => Promise<T> | T) => {
    const fakeTransaction: OrdersTransactionLike = {
      // Explicit unused-param names, not omitted — the surrounding file has no-unused-vars
      // conventions elsewhere in this repo relying on the leading underscore, matched here.
      set: (_ref: { id: string }, _data: Record<string, unknown>) => {
        /* no-op — this is a type-shape proof, not a behavioural one */
      },
    };
    return fn(fakeTransaction);
  },
};

async function injectedDbCall() {
  return createOrderWithPosition(built, { db: fakeDb });
}
void injectedDbCall;

// --- types/index.ts (extended) ---

// A pre-F8-shaped Ticket literal that never mentions `compedBy` must still compile.
const preF8Ticket: Ticket = {
  id: 'ticket-1',
  bookingRef: 'SAOC-2027-TYPECHECK03',
  showId: 'nationalShow',
  attendeeName: 'Attendee',
  attendeeEmail: 'attendee@example.com',
  ticketType: 'general-admission',
  status: 'paid',
  amount: 250,
  purchasedAt: null,
  checkedInAt: null,
  m_payment_id: null,
  pf_payment_id: null,
  orderId: null,
};
void preF8Ticket;

const compTicket: Ticket = { ...preF8Ticket, compedBy: 'manager@example.com' };
const compTicketNullCompedBy: Ticket = { ...preF8Ticket, compedBy: null };
void compTicket;
void compTicketNullCompedBy;
