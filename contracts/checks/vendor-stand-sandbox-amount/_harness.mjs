// Shared setup for the F5 route-runner checks (not a check itself). Real initiate route, real
// ozow-itn / payfast-itn routes and real settlement handler; only Firestore, payments (fake
// providers) and mailers are fixtures. The Ozow Sandbox Test Mode flag is the real
// adminSettings/ozowSandboxTestMode doc in the in-memory store. No live data is touched.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const store = require('../../harness/route-runner/store.mjs');
export const payments = require('../../harness/route-runner/fixture-payments.mjs');
export const { setActiveGateway } = require('../../harness/route-runner/fixture-active-gateway.mjs');
const { setShowWindowFixture } = require('../../harness/route-runner/fixture-show-window-lookup.mjs');
const conf = require('../../harness/route-runner/fixture-vendor-payment-confirmation.mjs');
const notice = require('../../harness/route-runner/fixture-vendor-payment-admin-notice.mjs');
export const sentConfirmations = conf.sentVendorPaymentConfirmations;
export const sentAdminNotices = notice.sentVendorPaymentAdminNotices;

export const { POST: initiatePost } = await import('../../../app/api/vendors/stand-payment/initiate/route.ts');
export const { POST: ozowItnPost } = await import('../../../app/api/vendors/stand-payment/ozow-itn/route.ts');
export const { POST: payfastItnPost } = await import('../../../app/api/vendors/stand-payment/payfast-itn/route.ts');
const { mintVendorStandPaymentToken } = await import('../../../lib/vendor-stand-payment-token.ts');

const SECRET = 'test-stand-payment-secret-not-real';
process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET = SECRET;
process.env.ADMIN_EMAIL_ALLOWLIST = 'admin-one@example.com';
process.env.SITE_URL = 'https://saoc.co.za';
setShowWindowFixture({ startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-04T23:59:59Z') });

export function resetAll() {
  store.resetAllCollections();
  payments.resetPaymentsFixture();
  conf.resetVendorPaymentConfirmationFixture();
  notice.resetVendorPaymentAdminNoticeFixture();
}

export function setTestMode(enabled) {
  const settings = store.getCollectionMap('adminSettings');
  if (enabled === null) settings.delete('ozowSandboxTestMode');
  else settings.set('ozowSandboxTestMode', { enabled });
}

export function seedSubmission(id) {
  store.vendorSubmissions.set(id, { status: 'approved', businessName: 'Fynbos Pottery', contactPersonName: 'Jane Vendor', contactEmail: 'jane@fynbospottery.example' });
}

export async function initiate(id, gateway) {
  setActiveGateway(gateway);
  const token = mintVendorStandPaymentToken({ vendorSubmissionId: id, secret: SECRET, now: new Date() }).token;
  const res = await initiatePost({ json: async () => ({ token, boothSize: 1 }) });
  const body = await res.json();
  return { status: res.status, body, call: payments.initiateCalls.at(-1), order: store.vendorStandOrders.get(id) };
}

export async function notify(gateway, payload) {
  const post = gateway === 'ozow' ? ozowItnPost : payfastItnPost;
  const res = await post({ text: async () => JSON.stringify(payload), headers: new Headers() });
  return res.status;
}
