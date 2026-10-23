// Admin ticket-sale notice (Brad via SAOC: "Admin emails must also get sent to Lee-Ann for tickets").
// Behavioural half runs the real sender under tsx with an injected mailer, so nothing is ever sent.
// The settlement handler cannot run without Firestore, so its exactly-once and isolation properties
// are proved by wiring order: the call sits after the `!outcome.committed` return, inside
// deliverConfirmationEmailAfterCommit, and the transaction only reports `committed: true` for the call
// that moved the order out of 'reserved'.
// Run as: pnpm exec tsx scripts/checks/ticket-sale-notice.mjs
import { readFileSync } from 'node:fs';

import { renderToStaticMarkup } from 'react-dom/server';

import { deliverConfirmationEmailAfterCommit } from '../../lib/confirmation-email.ts';
import {
  buildTicketSaleLines,
  sendTicketSaleAdminNotice,
} from '../../lib/ticket-sale-admin-notice.ts';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
  if (!ok) failures += 1;
}

const input = {
  orderReference: 'ORD-TEST-1',
  buyerName: 'Test Buyer',
  buyerEmail: 'buyer@example.test',
  positions: [
    { ticketType: 'Day Visitor', chosenDay: '2027-09-24' },
    { ticketType: 'Day Visitor', chosenDay: '2027-09-25' },
    { ticketType: 'Weekend Pass', chosenDay: null },
  ],
  total: 450,
  adminUrl: 'https://saoc.example.test/admin/tickets',
};

function recordingMailer() {
  const sent = [];
  return { sent, send: async (args) => void sent.push(args) };
}

// Content: every field reaches the rendered email.
process.env.ADMIN_EMAIL_ALLOWLIST = 'Lee-Ann@Example.test, admin@example.test';
const mailer = recordingMailer();
await sendTicketSaleAdminNotice(input, { mailer });
check('one email per allowlisted recipient', mailer.sent.length === 2, `sent=${mailer.sent.length}`);
check(
  'recipients are the lowercased allowlist',
  mailer.sent.map((m) => m.to).join() === 'lee-ann@example.test,admin@example.test',
);
const html = renderToStaticMarkup(mailer.sent[0].react);
for (const [label, needle] of [
  ['order reference', 'ORD-TEST-1'],
  ['buyer name', 'Test Buyer'],
  ['buyer email', 'buyer@example.test'],
  ['product with quantity and days', 'Day Visitor'],
  ['both chosen days', '2027-09-24, 2027-09-25'],
  ['second product', 'Weekend Pass'],
  ['total', 'R450.00'],
  ['admin link', 'https://saoc.example.test/admin/tickets'],
]) {
  check(`content includes the ${label}`, html.includes(needle), needle);
}
const lines = buildTicketSaleLines(input.positions);
check(
  'lines group by product with quantities',
  lines.length === 2 && lines[0].quantity === 2 && lines[1].quantity === 1 && lines[1].days.length === 0,
  JSON.stringify(lines),
);

// Empty allowlist: nothing sent, one warning, no recipient or buyer detail logged.
delete process.env.ADMIN_EMAIL_ALLOWLIST;
const warnings = [];
const originalWarn = console.warn;
console.warn = (...args) => void warnings.push(args.join(' '));
const emptyMailer = recordingMailer();
await sendTicketSaleAdminNotice(input, { mailer: emptyMailer });
console.warn = originalWarn;
check('empty allowlist sends nothing', emptyMailer.sent.length === 0);
check(
  'empty allowlist logs one non-PII warning',
  warnings.length === 1 && !warnings[0].includes('buyer@example.test') && !warnings[0].includes('ORD-TEST-1'),
  warnings.join(' | '),
);

// A send throw is isolated by the same wrapper the handler uses, and reported once.
process.env.ADMIN_EMAIL_ALLOWLIST = 'admin@example.test';
const errors = [];
let resolved = false;
await deliverConfirmationEmailAfterCommit(
  () => sendTicketSaleAdminNotice(input, { mailer: { send: async () => { throw new Error('boom'); } } }),
  (error) => void errors.push(error),
);
resolved = true;
check('a send throw resolves the wrapper (order stays paid)', resolved && errors.length === 1);

// Wiring: exactly-once and isolation in the settlement handler.
const handler = readFileSync('lib/tickets-notification.ts', 'utf8');
const calls = handler.split('sendTicketSaleAdminNotice(').length - 1;
const committedGuard = handler.indexOf('if (!outcome.committed)');
const noticeAt = handler.indexOf('sendTicketSaleAdminNotice(');
const noticeWrapped = /deliverConfirmationEmailAfterCommit\(\s*\(\) =>\s*sendTicketSaleAdminNotice\(/.test(handler);
check('the handler sends the notice from exactly one place', calls === 1, `calls=${calls}`);
check('the notice comes after the committed-only guard', committedGuard > 0 && noticeAt > committedGuard);
check('the notice is isolated by deliverConfirmationEmailAfterCommit', noticeWrapped);

const orders = readFileSync('lib/orders.ts', 'utf8');
const txStart = orders.indexOf('export async function markOrderAndPositionPaidByPaymentId');
const tx = orders.slice(txStart);
const notReserved = tx.indexOf("reason: 'order-not-reserved'");
const paidWrite = tx.indexOf("status: 'paid'");
const committedTrue = tx.indexOf('committed: true');
check(
  'only the call that moves reserved to paid reports committed: true',
  notReserved > 0 && paidWrite > notReserved && committedTrue > paidWrite,
  `${notReserved} ${paidWrite} ${committedTrue}`,
);

process.exit(failures ? 1 : 0);
