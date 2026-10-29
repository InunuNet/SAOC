// Golden for lib/vendor-stand-order-paid.ts (SEC-06 extension to vendorStandOrders): when does a
// stand order COUNT as paid. Frozen by @architect. @dev implements against this and never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/sec-stand-orders/goldens/stand-order-paid.golden.ts
// Pure module, client-safe: imports only types and lib/ticketing-test-mode.ts. No Firestore.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../../..');

async function main() {
  const paid = await import(path.join(ROOT, 'lib/vendor-stand-order-paid.ts'));
  const { standOrderCountsAsPaid, effectiveStandPaymentStatus, decideStandSettlement, vendorOfficePaymentReceived } = paid;
  const LIVE = { liveMode: true };
  const TEST = { liveMode: false };

  // 1. standOrderCountsAsPaid. Same rule as lib/checkin-test-ticket-guard.ts: live admits only
  //    the literal boolean false; test mode counts every paid order (committee testing unchanged).
  const unreadable: unknown[] = [undefined, null, true, 'false', 'true', '', 0, 1, {}, [], [false], NaN];
  for (const stamp of unreadable) {
    assert.equal(standOrderCountsAsPaid({ status: 'paid', issuedInTestMode: stamp }, LIVE), false, `live: stamp ${String(stamp)} must not count`);
    assert.equal(standOrderCountsAsPaid({ status: 'paid', issuedInTestMode: stamp }, TEST), true, `test: stamp ${String(stamp)} still counts`);
  }
  assert.equal(standOrderCountsAsPaid({ status: 'paid', issuedInTestMode: false }, LIVE), true);
  assert.equal(standOrderCountsAsPaid({ status: 'paid', issuedInTestMode: false }, TEST), true);
  assert.equal(standOrderCountsAsPaid({ status: 'paid' }, LIVE), false, 'absent key is untagged, which means test');
  for (const status of ['pending', 'failed', 'cancelled', 'PAID', 'Paid', ' paid', '', undefined, null, 1, {}]) {
    for (const mode of [LIVE, TEST]) {
      assert.equal(standOrderCountsAsPaid({ status, issuedInTestMode: false }, mode), false, `status ${String(status)} never counts`);
    }
  }
  for (const order of [null, undefined, 'paid', 0, true, [], [{ status: 'paid' }]]) {
    for (const mode of [LIVE, TEST]) {
      assert.equal(standOrderCountsAsPaid(order, mode), false, 'a non-object is not a paid order');
    }
  }
  assert.equal(standOrderCountsAsPaid(Object.assign([], { status: 'paid', issuedInTestMode: false }), LIVE), false, 'an array carrying the keys is not an order');
  assert.equal(standOrderCountsAsPaid(Object.assign([], { status: 'paid' }), TEST), false);
  // Only the literal own value counts; an inherited stamp is not provenance.
  assert.equal(standOrderCountsAsPaid(Object.create({ issuedInTestMode: false, status: 'paid' }), LIVE), false);

  // 2. The two prod-shaped documents (fixture): untagged, so they are test once live, paid today.
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/prod-stand-orders.json'), 'utf8'));
  assert.equal(fixture.orders.length, 2);
  for (const order of fixture.orders) {
    assert.equal('issuedInTestMode' in order, false);
    assert.equal(standOrderCountsAsPaid(order, LIVE), false, `${order.id} live`);
    assert.equal(standOrderCountsAsPaid(order, TEST), true, `${order.id} test`);
    assert.equal(effectiveStandPaymentStatus(order, LIVE), 'test-paid');
    assert.equal(effectiveStandPaymentStatus(order, TEST), 'paid');
  }

  // 3. effectiveStandPaymentStatus: what the admin views and the vendor page show.
  assert.equal(effectiveStandPaymentStatus(null, LIVE), 'not-started');
  assert.equal(effectiveStandPaymentStatus(undefined, TEST), 'not-started');
  assert.equal(effectiveStandPaymentStatus({ status: 'weird' }, LIVE), 'not-started', 'unknown status is not started, as app/admin/(shell)/vendors/[id]/page.tsx does today');
  assert.equal(effectiveStandPaymentStatus({ status: 'pending' }, LIVE), 'pending');
  assert.equal(effectiveStandPaymentStatus({ status: 'failed' }, LIVE), 'failed');
  assert.equal(effectiveStandPaymentStatus({ status: 'cancelled' }, TEST), 'cancelled');
  assert.equal(effectiveStandPaymentStatus({ status: 'paid', issuedInTestMode: false }, LIVE), 'paid');
  assert.equal(effectiveStandPaymentStatus({ status: 'paid', issuedInTestMode: true }, LIVE), 'test-paid');
  assert.equal(effectiveStandPaymentStatus({ status: 'paid', issuedInTestMode: true }, TEST), 'paid');

  // 4. decideStandSettlement: the settlement transaction reads the order while it is still
  //    'pending', so the input is the stamp, not a status. Settlement never relabels provenance:
  //    this function only decides the two side effects. The status/paidAt/gatewayPaymentId write
  //    is not its concern and always happens (money moved).
  assert.deepEqual(decideStandSettlement({ issuedInTestMode: false }, LIVE), { paymentReceived: true, sendNotices: true });
  for (const stamp of unreadable) {
    assert.deepEqual(decideStandSettlement({ issuedInTestMode: stamp }, LIVE), { paymentReceived: false, sendNotices: false }, `live: ${String(stamp)}`);
    assert.deepEqual(decideStandSettlement({ issuedInTestMode: stamp }, TEST), { paymentReceived: true, sendNotices: true }, `test: ${String(stamp)}`);
  }
  assert.deepEqual(decideStandSettlement({}, LIVE), { paymentReceived: false, sendNotices: false });
  assert.deepEqual(decideStandSettlement(undefined, LIVE), { paymentReceived: false, sendNotices: false });
  assert.deepEqual(decideStandSettlement(null, TEST), { paymentReceived: true, sendNotices: true });

  // 5. vendorOfficePaymentReceived: the submission's `paymentReceived` is set both by the
  //    gateway settlement (no paymentConfirmedBy) and by the admin payment route (always sets
  //    paymentConfirmedBy). A gateway-set flag is trusted only through the stand order.
  const untaggedPaid = { status: 'paid' };
  const livePaid = { status: 'paid', issuedInTestMode: false };
  for (const submission of fixture.submissionsWithGatewaySetFlag) {
    assert.equal(vendorOfficePaymentReceived(submission, untaggedPaid, LIVE), false, 'prod-shaped: gateway flag from a sandbox payment');
    assert.equal(vendorOfficePaymentReceived(submission, untaggedPaid, TEST), true);
    assert.equal(vendorOfficePaymentReceived(submission, null, LIVE), false);
    assert.equal(vendorOfficePaymentReceived(submission, livePaid, LIVE), true);
  }
  assert.equal(vendorOfficePaymentReceived({ paymentReceived: true, paymentConfirmedBy: 'a@b.example' }, null, LIVE), true, 'office-recorded (EFT) receipt is independent of the gateway');
  assert.equal(vendorOfficePaymentReceived({ paymentReceived: true, paymentConfirmedBy: 'a@b.example' }, untaggedPaid, LIVE), true);
  assert.equal(vendorOfficePaymentReceived({ paymentReceived: true, paymentConfirmedBy: '   ' }, untaggedPaid, LIVE), false, 'blank confirmer is not office-recorded');
  assert.equal(vendorOfficePaymentReceived({ paymentReceived: true, paymentConfirmedBy: '' }, livePaid, LIVE), true, 'blank confirmer falls back to the order');
  for (const flag of [false, undefined, null, 'true', 1, {}]) {
    assert.equal(vendorOfficePaymentReceived({ paymentReceived: flag, paymentConfirmedBy: 'a@b.example' }, livePaid, TEST), false, `flag ${String(flag)}`);
  }
  assert.equal(vendorOfficePaymentReceived({}, livePaid, LIVE), false);

  console.log('stand-order-paid.golden.ts: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
