// F31-A5 - static wiring guards that the offline behavioural checks cannot see (handler order, single
// send sites, unchanged confirm gate, hold helper used by initiate + payment page, no new copy/emails).
// Run from the repo root: node contracts/checks/launch-weekend/f31/check-e-static.mjs
import { readFileSync } from 'node:fs';

const problems = [];
const read = (p) => readFileSync(p, 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const count = (s, needle) => s.split(needle).length - 1;
const must = (name, cond) => { if (!cond) problems.push(name); };

const types = read('lib/payments/types.ts');
must("PaymentStatus includes 'abandoned'", /type PaymentStatus =[^;]*'abandoned'/.test(types));

const ozow = stripComments(read('lib/payments/ozow.ts'));
must("ozow.ts names the Abandoned status", ozow.includes("'Abandoned'"));
must("ozow.ts names the PendingInvestigation status", ozow.includes("'PendingInvestigation'"));
must("ozow.ts names the Pending status", /'Pending'/.test(ozow));
must('confirmNotification still fail-closed on Status !== Complete', ozow.includes('matched.Status !== STATUS_COMPLETE'));
must('confirmed:true is still returned exactly once in ozow.ts', count(ozow, 'confirmed: true') === 1);

const itn = stripComments(read('lib/tickets-notification.ts'));
const iMap = itn.indexOf('paymentProvider.mapStatus(');
const iConfirm = itn.indexOf('paymentProvider.confirmNotification(');
const iPending = itn.indexOf('markOrderPaymentPendingByPaymentId(');
const iPaid = itn.indexOf('markOrderAndPositionPaidByPaymentId({');
must('tickets handler calls mapStatus before confirmNotification', iMap !== -1 && iConfirm !== -1 && iMap < iConfirm);
must('tickets handler calls markOrderPaymentPendingByPaymentId before confirmNotification', iPending !== -1 && iPending < iConfirm);
must('tickets handler still settles paid only after confirmNotification', iPaid > iConfirm);
must('confirmNotification is called exactly once', count(itn, 'confirmNotification(') === 1);
must('the ticket confirmation email has exactly one send site', count(itn, 'sendConfirmationEmail(') === 1);
must('amount match precedes the pending write', itn.indexOf('notificationAmountMatches(lookup') < iPending);
must("tickets handler still guards the paid write on status === 'paid'", /status !== 'paid'/.test(itn));

const vend = stripComments(read('lib/vendor-stand-payment-notification.ts'));
must('vendor admin notice has one send site', count(vend, 'sendVendorPaymentAdminNoticeEmail(') === 1);
must('vendor receipt has one send site', count(vend, 'sendVendorPaymentConfirmationEmail(') === 1);
must('vendor confirmNotification called exactly once', count(vend, 'confirmNotification(') === 1);
must("vendor handler has a 'pending' branch", /status === 'pending'/.test(vend));
must('vendor handler records gatewayPending', vend.includes('gatewayPending'));

const hold = stripComments(read('lib/payments/pending-hold.ts'));
must('hold constant exported', hold.includes('export const PENDING_PAYMENT_HOLD_MINUTES'));
const initiate = stripComments(read('app/api/vendors/stand-payment/initiate/route.ts'));
must('initiate refuses re-initiate during an active pending hold', initiate.includes('isPendingPaymentHoldActive') && /409/.test(initiate));
const page = stripComments(read('app/(marketing)/national-show/vendors/payment/page.tsx'));
must('vendor payment page branches on the pending hold', page.includes('isPendingPaymentHoldActive'));

// No new user-facing copy: the buyer-facing pending strings must be the EXISTING poller strings, reused verbatim.
const reused = ['Confirming your payment', "We're still waiting for payment confirmation. Please don't refresh or submit payment again."];
const vendorUi = stripComments(page + read('components/vendors/VendorStandPaymentForm.tsx') + initiate);
for (const s of reused) must(`vendor pending copy reuses the existing string: ${s}`, vendorUi.includes(s) || read('lib/payments/pending-hold.ts').includes(s));

if (problems.length > 0) { console.error(`FAIL F31-A5\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log('PASS F31-A5 static wiring');
