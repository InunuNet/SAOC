// F31-A3 - vendor stand payment transitions through the REAL handler (lib/vendor-stand-payment-notification.ts)
// and the REAL Ozow adapter (hash verify, confirm over a stubbed status API) against an in-memory Firestore double.
// Run from the repo root: pnpm exec tsx contracts/checks/launch-weekend/f31/check-c-vendor-transitions.mts
import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { createOzowProvider } from '../../../../lib/payments/ozow.ts';
import { POST } from '../../../../lib/vendor-stand-payment-notification.ts';
import { buildVendorStandOrderReference } from '../../../../lib/vendor-stand-orders.ts';
import { FakeDb, OZOW_ENV, hasUndefinedOwnProp, makeChecker, signedOzowBody, statusApiFetch } from './_lib.mts';

const { eq, ok, finish } = makeChecker('F31-A3 vendor transitions');
const VID = 'vendor-sub-1';
const ATTEMPT = 'a1b2c3d4a1b2c3d4';
const REF = buildVendorStandOrderReference(VID, ATTEMPT);
const STALE_REF = buildVendorStandOrderReference(VID, '0000000000000000');
const AMOUNT = 1500;

function seed(): FakeDb {
  const db = new FakeDb();
  db.seed('vendorStandOrders', VID, { id: VID, vendorSubmissionId: VID, gateway: 'ozow', status: 'pending', amount: AMOUNT, boothSize: 1, attemptId: ATTEMPT, gatewayPaymentId: null, paidAt: null, failedAt: null });
  db.seed('vendorSubmissions', VID, { businessName: 'F31 Test Vendor', contactPersonName: 'F31 Contact', contactEmail: '' });
  return db;
}

async function deliver(db: FakeDb, status: string, opts: { reference?: string; amount?: string; badHash?: boolean; apiStatus?: string } = {}) {
  const { fetchStub, calls } = statusApiFetch(() => opts.apiStatus ?? status);
  const provider = createOzowProvider({ env: OZOW_ENV, fetch: fetchStub });
  const body = signedOzowBody({ reference: opts.reference ?? REF, status, amount: opts.amount ?? AMOUNT.toFixed(2), badHash: opts.badHash });
  const req = new NextRequest('http://localhost/api/vendors/stand-payment/ozow-itn', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  const res = await POST(provider, req, { db: db as never });
  eq(`${status}: handler always acknowledges 200`, res.status, 200);
  return { confirmCalls: calls.length };
}
const order = (db: FakeDb) => db.read('vendorStandOrders', VID)!;
const pendingMarker = (db: FakeDb) => order(db).gatewayPending as { rawStatus?: string; attemptId?: string; at?: unknown } | undefined;

// Pending and PendingInvestigation: stay pending, marker recorded, never paid, no confirm round trip needed.
for (const raw of ['Pending', 'PendingInvestigation']) {
  const db = seed();
  const { confirmCalls } = await deliver(db, raw);
  eq(`${raw}: order stays pending`, order(db).status, 'pending');
  eq(`${raw}: marker rawStatus`, pendingMarker(db)?.rawStatus, raw);
  eq(`${raw}: marker attemptId`, pendingMarker(db)?.attemptId, ATTEMPT);
  ok(`${raw}: marker has at`, pendingMarker(db)?.at instanceof Timestamp);
  eq(`${raw}: paidAt untouched`, order(db).paidAt, null);
  eq(`${raw}: submission not flagged received`, db.read('vendorSubmissions', VID)!.paymentReceived, undefined);
  eq(`${raw}: no confirm call`, confirmCalls, 0);
  ok(`${raw}: no undefined own-properties`, !hasUndefinedOwnProp(order(db)));
  // Idempotent: a repeat delivery leaves the order pending.
  await deliver(db, raw);
  eq(`${raw}: repeat delivery still pending`, order(db).status, 'pending');
  // Later Complete (same attempt) settles; duplicate Complete does not re-stamp.
  await deliver(db, 'Complete');
  eq(`${raw}->Complete: paid`, order(db).status, 'paid');
  ok(`${raw}->Complete: paidAt set`, order(db).paidAt instanceof Timestamp);
  eq(`${raw}->Complete: submission flagged`, db.read('vendorSubmissions', VID)!.paymentReceived, true);
  const paidAt = (order(db).paidAt as Timestamp).toMillis();
  await deliver(db, 'Complete');
  eq(`${raw}->Complete: duplicate does not re-stamp`, (order(db).paidAt as Timestamp).toMillis(), paidAt);
  // A Cancelled arriving after paid cannot undo it.
  await deliver(db, 'Cancelled');
  eq(`${raw}->Complete->Cancelled: still paid`, order(db).status, 'paid');
}
// Pending -> Cancelled (same attempt): terminal cancelled.
{
  const db = seed();
  await deliver(db, 'Pending');
  await deliver(db, 'Cancelled');
  eq('Pending->Cancelled', order(db).status, 'cancelled');
}
// Terminal negatives.
{
  const db = seed();
  await deliver(db, 'Cancelled');
  eq('Cancelled -> cancelled', order(db).status, 'cancelled');
  ok('Cancelled stamps failedAt', order(db).failedAt instanceof Timestamp);
  await deliver(db, 'Complete');
  eq('Complete after Cancelled ignored (terminal)', order(db).status, 'cancelled');
}
{
  const db = seed();
  await deliver(db, 'Error');
  eq('Error -> failed', order(db).status, 'failed');
}
// Abandoned: NOT terminal, no write at all.
{
  const db = seed();
  const before = JSON.stringify(order(db));
  await deliver(db, 'Abandoned');
  eq('Abandoned leaves the order byte-identical', JSON.stringify(order(db)), before);
  await deliver(db, 'Complete');
  eq('Abandoned then Complete settles', order(db).status, 'paid');
}
// Unknown status string: no write.
{
  const db = seed();
  const before = JSON.stringify(order(db));
  await deliver(db, 'Declined');
  eq('unrecognised status leaves order untouched', JSON.stringify(order(db)), before);
}
// Fail-closed gates still apply to Pending: stale attempt, wrong amount, forged hash.
for (const [name, opts] of [
  ['stale attempt', { reference: STALE_REF }],
  ['wrong amount', { amount: '1.00' }],
  ['forged hash', { badHash: true }],
] as const) {
  const db = seed();
  const before = JSON.stringify(order(db));
  await deliver(db, 'Pending', opts);
  eq(`Pending ${name}: order untouched`, JSON.stringify(order(db)), before);
}
// Complete whose status-API confirmation disagrees (API says Pending): never paid.
{
  const db = seed();
  await deliver(db, 'Complete', { apiStatus: 'Pending' });
  eq('Complete not confirmed by Ozow API stays pending', order(db).status, 'pending');
}
finish();
