// A11 — Codex GPT-5.5 cross-model review (2026-08-22) found CheckoutRedirectNotice.tsx reading
// `fields.amount` (lowercase) for display. PayFast's initiate() returns a `fields.amount`
// (lowercase, per PayFast's own signed-field convention); Ozow's initiate() returns
// `fields.Amount` (capital A, per lib/ozow.ts's OZOW_OUTBOUND_FIELD_ORDER). Reading the lowercase
// key against an Ozow checkout silently renders "R undefined".
//
// Proves TWO things, offline, against the REAL adapters (no HTTP, deps-injected env):
//   1. The wire-format mismatch is real: PayFast's initiate() result has `fields.amount` and NOT
//      `fields.Amount`; Ozow's has `fields.Amount` and NOT `fields.amount`. This is the exact
//      defect shape — proof the bug was real, not merely asserted.
//   2. The fix holds: app/api/tickets/checkout/route.ts's POST handler source declares a
//      provider-neutral `amount: amountFormatted` field on its JSON response (never derived from
//      `fields`), and CheckoutRedirectNotice.tsx's source neither reads `fields.amount` nor
//      `fields.Amount` for its displayed value — it renders a dedicated `amount` prop instead.
//
// WHAT MAKES THIS FAIL: either adapter's `fields` shape changing away from what's asserted above;
// the checkout route response losing its `amount` field or re-deriving it from `fields`;
// CheckoutRedirectNotice.tsx reading `fields.amount`/`fields.Amount` for display (the exact
// regression this check exists to catch — see the revert-and-confirm-red note in
// contracts/golden/ozow-m1-f2/README.md).
//
// Run as: npx tsx contracts/checks/ozow-m1-f2/check-amount-display-provider-neutral.mjs

import { readFileSync } from 'node:fs';
import { createPayfastProvider } from '../../../lib/payments/payfast.ts';
import { createOzowProvider } from '../../../lib/payments/ozow.ts';

let FAIL = false;
function fail(msg) {
  console.error(`FAIL: ${msg}`);
  FAIL = true;
}

const baseInput = {
  reference: 'A11-TEST-REF',
  amountFormatted: '250.00',
  itemName: 'Test Item',
  returnUrl: 'https://example.test/return',
  cancelUrl: 'https://example.test/cancel',
  notifyUrl: 'https://example.test/notify',
};

const payfast = createPayfastProvider({
  env: {
    PAYFAST_SANDBOX_MERCHANT_ID: '10000100',
    PAYFAST_SANDBOX_MERCHANT_KEY: '46f0cd694581a',
  },
});
const ozow = createOzowProvider({
  env: {
    OZOW_SANDBOX_SITE_CODE: 'TSTSITE0001',
    OZOW_SANDBOX_PRIVATE_KEY: 'test-private-key',
  },
});

const payfastResult = await payfast.initiate(baseInput);
const ozowResult = await ozow.initiate(baseInput);

if (!payfastResult.ok) fail('PayFast initiate() unexpectedly refused — cannot compare field shapes');
if (!ozowResult.ok) fail('Ozow initiate() unexpectedly refused — cannot compare field shapes');

if (payfastResult.ok) {
  if (!('amount' in payfastResult.fields)) {
    fail("PayFast's fields no longer include lowercase 'amount' — case 1 assumption invalid");
  }
  if ('Amount' in payfastResult.fields) {
    fail("PayFast's fields unexpectedly include capital 'Amount' — case 1 assumption invalid");
  }
}
if (ozowResult.ok) {
  if (!('Amount' in ozowResult.fields)) {
    fail("Ozow's fields no longer include capital 'Amount' — case 2 assumption invalid");
  }
  if ('amount' in ozowResult.fields) {
    fail("Ozow's fields unexpectedly include lowercase 'amount' — the mismatch this check exists to prove is gone");
  }
}

// Static proof the FIX holds: the route response carries a provider-neutral `amount` field never
// derived from `fields`, and the component never reads fields.amount/fields.Amount for display.
const routeSource = readFileSync('app/api/tickets/checkout/route.ts', 'utf8');
if (!/amount:\s*amountFormatted/.test(routeSource)) {
  fail('app/api/tickets/checkout/route.ts response no longer includes `amount: amountFormatted`');
}

const noticeSource = readFileSync('components/tickets/CheckoutRedirectNotice.tsx', 'utf8');
if (/fields\.amount/.test(noticeSource) || /fields\.Amount/.test(noticeSource) || /fields\[['"]amount['"]\]/i.test(noticeSource)) {
  fail('CheckoutRedirectNotice.tsx reads fields.amount/fields.Amount for display — the exact regression this check exists to catch');
}
if (!/\bamount\b/.test(noticeSource.match(/interface CheckoutRedirectNoticeProps[^}]*}/s)?.[0] ?? '')) {
  fail('CheckoutRedirectNotice.tsx no longer declares a dedicated `amount` prop');
}

if (FAIL) {
  console.error('OVERALL: FAIL');
  process.exit(1);
}
console.log(
  "OVERALL: PASS — PayFast/Ozow field casing genuinely differs (amount vs Amount), and the checkout " +
    'response + CheckoutRedirectNotice both use a provider-neutral `amount` field, never `fields.amount`/`fields.Amount`.'
);
