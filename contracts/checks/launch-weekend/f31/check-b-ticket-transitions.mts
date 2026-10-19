// F31-A2 - ticket order state transitions on the REAL lib/orders.ts against an in-memory Firestore
// double. Pending/PendingInvestigation hold the seat and never mark paid; a later Complete settles
// idempotently. Run from the repo root: pnpm exec tsx contracts/checks/launch-weekend/f31/check-b-ticket-transitions.mts
import { Timestamp } from 'firebase-admin/firestore';
import * as orders from '../../../../lib/orders.ts';
import { PENDING_PAYMENT_HOLD_MINUTES } from '../../../../lib/payments/pending-hold.ts';
import { FakeDb, hasUndefinedOwnProp, makeChecker, minutesFromNow } from './_lib.mts';

const { eq, ok, finish } = makeChecker('F31-A2 ticket transitions');
const fn = (orders as Record<string, unknown>).markOrderPaymentPendingByPaymentId as
  | ((input: Record<string, unknown>, deps: { db: unknown }) => Promise<{ committed: boolean; reason?: string; orderId?: string }>)
  | undefined;
if (typeof fn !== 'function') {
  console.error('FAIL F31-A2: lib/orders.ts must export markOrderPaymentPendingByPaymentId');
  process.exit(1);
}
const HOLD_MS = PENDING_PAYMENT_HOLD_MINUTES * 60_000;
const SLACK_MS = 60_000;

function fixture(opts: { gateway?: string; status?: string; expiresInMinutes?: number } = {}) {
  const db = new FakeDb();
  const exp = minutesFromNow(opts.expiresInMinutes ?? 5);
  db.seed('orders', 'o1', { m_payment_id: 'SAOC-2027-REF1', gateway: opts.gateway ?? 'ozow', status: opts.status ?? 'reserved', amount: 100, expiresAt: exp, buyerEmail: 'b@example.test', buyerName: 'B' });
  db.seed('tickets', 'p1', { orderId: 'o1', status: opts.status ?? 'reserved', expiresAt: exp, bookingRef: 'BK1', attendeeName: 'A' });
  db.seed('tickets', 'p2', { orderId: 'o1', status: opts.status ?? 'reserved', expiresAt: exp, bookingRef: 'BK2', attendeeName: 'B' });
  return db;
}
const input = (rawStatus: string, over: Record<string, unknown> = {}) => ({ m_payment_id: 'SAOC-2027-REF1', rawStatus, now: Timestamp.now(), orderId: 'o1', expectedGateway: 'ozow', ...over });
const ms = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : -1);

// 1. Pending on a fresh reserved order: stays reserved, hold extended on order AND every position, marker written.
{
  const db = fixture();
  const r = await fn(input('Pending'), { db });
  eq('pending committed', r.committed, true);
  const o = db.read('orders', 'o1')!;
  eq('order stays reserved', o.status, 'reserved');
  ok('order hold extended', ms(o.expiresAt) >= Date.now() + HOLD_MS - SLACK_MS);
  for (const id of ['p1', 'p2']) {
    const p = db.read('tickets', id)!;
    eq(`position ${id} stays reserved`, p.status, 'reserved');
    ok(`position ${id} hold extended`, ms(p.expiresAt) >= Date.now() + HOLD_MS - SLACK_MS);
  }
  eq('marker rawStatus', (o.gatewayPending as { rawStatus?: string } | undefined)?.rawStatus, 'Pending');
  ok('marker has at', (o.gatewayPending as { at?: unknown } | undefined)?.at instanceof Timestamp);
  ok('no undefined own-properties in order', !hasUndefinedOwnProp(o));
  // 2. PendingInvestigation afterwards, with an EARLIER now: idempotent, never shortens, rawStatus follows latest.
  const before = ms(o.expiresAt);
  const r2 = await fn(input('PendingInvestigation', { now: Timestamp.fromMillis(Date.now() - 3_600_000) }), { db });
  eq('second pending committed', r2.committed, true);
  const o2 = db.read('orders', 'o1')!;
  ok('expiry never shortened', ms(o2.expiresAt) >= before);
  eq('marker follows latest rawStatus', (o2.gatewayPending as { rawStatus?: string }).rawStatus, 'PendingInvestigation');
  eq('still reserved', o2.status, 'reserved');
  // 3. Later Complete settles the held order through the existing paid path.
  const paid = await orders.markOrderAndPositionPaidByPaymentId(
    { m_payment_id: 'SAOC-2027-REF1', gatewayPaymentId: 'txn-1', now: Timestamp.now(), orderId: 'o1', expectedGateway: 'ozow' },
    { db: db as never }
  );
  eq('later Complete commits', paid.committed, true);
  eq('order paid', db.read('orders', 'o1')!.status, 'paid');
  eq('p1 paid', db.read('tickets', 'p1')!.status, 'paid');
  eq('p2 paid', db.read('tickets', 'p2')!.status, 'paid');
  // 4. Duplicate Complete no-ops; a Pending arriving AFTER paid refuses and changes nothing.
  const dup = await orders.markOrderAndPositionPaidByPaymentId(
    { m_payment_id: 'SAOC-2027-REF1', gatewayPaymentId: 'txn-2', now: Timestamp.now(), orderId: 'o1', expectedGateway: 'ozow' },
    { db: db as never }
  );
  eq('duplicate Complete does not commit', dup.committed, false);
  eq('gatewayPaymentId not overwritten', db.read('orders', 'o1')!.gatewayPaymentId, 'txn-1');
  const late = await fn(input('Pending'), { db });
  eq('pending after paid refused', late.committed, false);
  eq('pending after paid reason', late.reason, 'order-not-reserved');
  eq('paid order untouched by late pending', db.read('orders', 'o1')!.status, 'paid');
}
// 5. A hold already longer than the window is never shortened.
{
  const db = fixture({ expiresInMinutes: PENDING_PAYMENT_HOLD_MINUTES * 3 });
  const longer = ms(db.read('orders', 'o1')!.expiresAt);
  await fn(input('Pending'), { db });
  eq('longer hold preserved on order', ms(db.read('orders', 'o1')!.expiresAt), longer);
  eq('longer hold preserved on position', ms(db.read('tickets', 'p1')!.expiresAt), longer);
}
// 6. An order already past its TTL (seat lazily released) is re-held by a verified Pending.
{
  const db = fixture({ expiresInMinutes: -45 });
  const r = await fn(input('Pending'), { db });
  eq('expired-then-pending committed', r.committed, true);
  ok('expired order re-held', ms(db.read('orders', 'o1')!.expiresAt) > Date.now() + HOLD_MS - SLACK_MS);
}
// 7. Refusals leave every document byte-identical.
for (const [name, db, over, reason] of [
  ['gateway mismatch', fixture({ gateway: 'payfast' }), {}, 'order-gateway-mismatch'],
  ['payment id mismatch', fixture(), { m_payment_id: 'SAOC-2027-OTHER' }, 'order-payment-id-mismatch'],
  ['already cancelled', fixture({ status: 'cancelled' }), {}, 'order-not-reserved'],
] as const) {
  const snap = JSON.stringify([db.read('orders', 'o1'), db.read('tickets', 'p1'), db.read('tickets', 'p2')]);
  const r = await fn(input('Pending', over), { db });
  eq(`${name}: refused`, r.committed, false);
  eq(`${name}: reason`, r.reason, reason);
  eq(`${name}: documents untouched`, JSON.stringify([db.read('orders', 'o1'), db.read('tickets', 'p1'), db.read('tickets', 'p2')]), snap);
}
// 8. A non-pending rawStatus is not accepted by this writer (it only ever records Pending / PendingInvestigation).
{
  const db = fixture();
  const r = await fn(input('Complete'), { db });
  eq('Complete refused by pending writer', r.committed, false);
  eq('Complete did not touch order', db.read('orders', 'o1')!.status, 'reserved');
}
finish();
