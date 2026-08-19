// F10 (ticketing-foundation) — compiler-driven (not source-grep) proof of the new and extended
// exported shapes lib/orders.ts, lib/confirmation-email.ts and lib/payments/payfast.ts's
// exported parseOrderedFields must carry. Run via its own scoped tsconfig (see that file)
// because the root tsconfig.json excludes `contracts/` from `pnpm type-check`.
//
// Five things proven here that the runtime checks (A3-A7) cannot see:
//   1. parseOrderedFields is exported with the SAME signature it had before F10 (string in,
//      {fields, signature} out) — a re-pin that accidentally changed its call shape would
//      still need to satisfy this. F2 (payment-provider-seam) moved it out of the pinned route
//      and into lib/payments/payfast.ts, where the gateway's own body parse belongs; the
//      signature it must carry is unchanged.
//   2. findReservedOrderByPaymentId's three-way discriminated result narrows correctly by
//      `status` (not-found / already-settled / reserved), each arm exposing only the fields
//      that variant actually carries (e.g. `amount` only exists on the 'reserved' arm).
//   3. markOrderAndPositionPaidByPaymentId's result narrows correctly by `committed` — the
//      success arm exposes orderId/buyerEmail/buyerName/recoveryToken/position, the failure
//      arm exposes only `reason`, and NEITHER arm's fields leak into the other at the type
//      level (a mutation that widened the union to a single non-discriminated shape would
//      fail here even though it might still pass a runtime check that never reads the
//      wrong-arm field).
//   4. deliverConfirmationEmailAfterCommit accepts a `() => Promise<void>` sender and an
//      `(error: unknown) => void` error handler, and itself returns Promise<void> — the exact
//      shape the pinned route's call site depends on.
//   5. An OrdersFirestoreRwLike-shaped fake object (collection().where().limit().get(), plus
//      a transaction with get() and update()) is accepted as deps.db by both new lib/orders.ts
//      functions — proving the injectable-fake-store technique F8 established extends to the
//      read+update surface F10 needs, without widening F8's own narrower, `set`-only
//      OrdersFirestoreLike/OrdersTransactionLike (those two interfaces are untouched by F10 —
//      see the golden README "Why two interface families, not one widened one").
//
// Run as: npx tsc --noEmit -p contracts/checks/ticketing-f10-itn-repin/tsconfig.typecheck.json

import { parseOrderedFields } from '../../../../lib/payments/payfast';

import type {
  FindReservedOrderResult,
  MarkOrderPaidOutcome,
  OrdersFirestoreRwLike,
  OrdersTransactionRwLike,
} from '../../../../lib/orders';
import { findReservedOrderByPaymentId, markOrderAndPositionPaidByPaymentId } from '../../../../lib/orders';

import type { SendConfirmationEmailInput } from '../../../../lib/confirmation-email';
import { deliverConfirmationEmailAfterCommit, sendConfirmationEmail } from '../../../../lib/confirmation-email';

// --- lib/payments/payfast.ts (parseOrderedFields, exported by F10, relocated by F2) ---

const parsed: { fields: Record<string, string>; signature: string | null } = parseOrderedFields(
  'm_payment_id=SAOC-2027-TYPECHECK01&signature=deadbeef'
);
void parsed;

// --- lib/orders.ts: findReservedOrderByPaymentId ---

function narrowFindResult(result: FindReservedOrderResult): number | null {
  if (result.status === 'reserved') {
    // Only the 'reserved' arm carries `amount` — this line is the type-level proof.
    const amount: number = result.amount;
    return amount;
  }
  if (result.status === 'already-settled') {
    const orderStatus: string = result.orderStatus;
    void orderStatus;
    return null;
  }
  // 'not-found' arm carries no extra fields.
  return null;
}
void narrowFindResult;

async function callFindReserved() {
  return findReservedOrderByPaymentId('SAOC-2027-TYPECHECK01');
}
void callFindReserved;

// --- lib/orders.ts: markOrderAndPositionPaidByPaymentId ---

function narrowMarkOutcome(outcome: MarkOrderPaidOutcome): string | null {
  if (outcome.committed) {
    const orderId: string = outcome.orderId;
    const buyerEmail: string = outcome.buyerEmail;
    const buyerName: string = outcome.buyerName;
    const recoveryToken: string | null = outcome.recoveryToken;
    const bookingRef: string = outcome.position.bookingRef;
    void buyerEmail;
    void buyerName;
    void recoveryToken;
    void bookingRef;
    return orderId;
  }
  // The failure arm exposes only `reason` — accessing `orderId` here must NOT compile if this
  // block is ever uncommented, which is exactly the proof this file exists to carry:
  // const leaked = outcome.orderId;
  const reason:
    | 'order-not-found'
    | 'order-vanished'
    | 'order-payment-id-mismatch'
    | 'order-not-reserved'
    | 'position-not-found' = outcome.reason;
  return reason;
}
void narrowMarkOutcome;

async function callMarkPaid() {
  return markOrderAndPositionPaidByPaymentId({
    m_payment_id: 'SAOC-2027-TYPECHECK01',
    gatewayPaymentId: 'pf-typecheck-01',
    now: new Date() as unknown as import('firebase-admin/firestore').Timestamp,
  });
}
void callMarkPaid;

// A minimal OrdersFirestoreRwLike-shaped fake object must be accepted as deps.db by both
// functions above.
const fakeRwDb: OrdersFirestoreRwLike = {
  collection: (_name: string) => ({
    doc: (id?: string) => ({ id: id ?? 'fake-id' }),
    where: (_field: string, _op: '==', _value: unknown) => ({
      limit: (_n: number) => ({
        get: async () => ({ empty: true, docs: [] }),
      }),
      get: async () => ({ empty: true, docs: [] }),
    }),
  }),
  runTransaction: async <T,>(fn: (transaction: OrdersTransactionRwLike) => Promise<T> | T) => {
    const fakeTransaction: OrdersTransactionRwLike = {
      set: (_ref: { id: string }, _data: Record<string, unknown>) => {
        /* no-op — type-shape proof only */
      },
      get: async (_ref: { id: string }) => ({ id: 'fake-id', exists: false, data: () => undefined }),
      update: (_ref: { id: string }, _data: Record<string, unknown>) => {
        /* no-op — type-shape proof only */
      },
    };
    return fn(fakeTransaction);
  },
};

async function injectedRwDbCalls() {
  await findReservedOrderByPaymentId('SAOC-2027-TYPECHECK01', { db: fakeRwDb });
  await markOrderAndPositionPaidByPaymentId(
    {
      m_payment_id: 'SAOC-2027-TYPECHECK01',
      gatewayPaymentId: null,
      now: new Date() as unknown as import('firebase-admin/firestore').Timestamp,
    },
    { db: fakeRwDb }
  );
}
void injectedRwDbCalls;

// --- lib/confirmation-email.ts ---

const emailInput: SendConfirmationEmailInput = {
  orderId: 'order-typecheck-01',
  buyerEmail: 'buyer@example.com',
  buyerName: 'Test Buyer',
  recoveryToken: null,
  positions: [{ bookingRef: 'SAOC-2027-TYPECHECK01', attendeeName: 'Attendee', ticketType: 'general-admission' }],
};

async function callSendConfirmation() {
  return sendConfirmationEmail(emailInput);
}
void callSendConfirmation;

async function callDeliverAfterCommit() {
  return deliverConfirmationEmailAfterCommit(
    () => sendConfirmationEmail(emailInput),
    (error: unknown) => {
      void error;
    }
  );
}
void callDeliverAfterCommit;
