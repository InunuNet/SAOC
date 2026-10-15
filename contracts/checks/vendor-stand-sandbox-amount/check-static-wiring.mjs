#!/usr/bin/env node
// Static wiring proofs for F5 (vendor stand payment honours the Ozow Sandbox Test Mode toggle):
// the existing helpers are REUSED (no new mechanism), the flag is read once before the initiate
// transaction, the stored expectation drives the amount sent, both settlement amount guards use the
// shared helper, the banner is the existing component with the existing string, and nothing on the
// ticket or PayFast side moved. The behavioural proofs live in the other checks.
//
// Run as: node contracts/checks/vendor-stand-sandbox-amount/check-static-wiring.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const BASE = 'a42694dc';
const failures = [];
const expect = (cond, msg) => { if (!cond) failures.push(msg); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, '$1');
const read = (rel) => {
  if (!existsSync(rel)) { failures.push(`missing file: ${rel}`); return null; }
  return readFileSync(rel, 'utf8');
};

// --- 1. Initiate route -------------------------------------------------------------------------
const routeRaw = read('app/api/vendors/stand-payment/initiate/route.ts');
if (routeRaw) {
  const route = strip(routeRaw);
  expect(/from '@\/lib\/ozow-sandbox-test-mode'/.test(route), 'initiate route must import the EXISTING helpers from @/lib/ozow-sandbox-test-mode.');
  for (const fn of ['isOzowSandboxTestModeEnabled', 'resolveExpectedGatewayAmount', 'resolveOzowInitiateAmount']) {
    expect(new RegExp(`\\b${fn}\\b`).test(route), `initiate route must use ${fn}.`);
  }
  expect((route.match(/isOzowSandboxTestModeEnabled\(/g) ?? []).length === 1, 'the flag must be read exactly once (a second read could split the stored and sent amounts).');
  const flagAt = route.indexOf('isOzowSandboxTestModeEnabled(');
  const txAt = route.indexOf('db.runTransaction(');
  const initAt = route.indexOf('paymentProvider.initiate(');
  expect(flagAt !== -1 && txAt !== -1 && flagAt < txAt && txAt < initAt, 'order must be: flag read, then the initiate transaction, then paymentProvider.initiate().');
  expect(/resolveExpectedGatewayAmount\(\s*activeGateway\s*,/.test(route), 'expectedGatewayAmount must be derived from the ACTIVE gateway id (so PayFast stays null).');
  expect(/transaction\.set\(standOrderRef,\s*\{[\s\S]*?\bexpectedGatewayAmount\b[\s\S]*?\}\)/.test(route), 'the order .set() must store expectedGatewayAmount.');
  expect(/resolveOzowInitiateAmount\(\s*expectedGatewayAmount\s*,/.test(route), 'the amount sent must come from resolveOzowInitiateAmount(expectedGatewayAmount, ...), i.e. the same stored expectation.');
  expect(/amountFormatted:\s*initiateAmountFormatted|amountFormatted:\s*resolveOzowInitiateAmount\(/.test(route), 'initiate() must be given the resolved amount.');
  expect(/amount:\s*amount\.toFixed\(2\)/.test(route), 'the JSON response must keep the REAL amount for display.');
  expect(!/['"`]0\.01['"`]|\b0\.01\b/.test(route), 'no literal 0.01 in the route: the amount constant lives only in the shared helper.');
}

// --- 2. Settlement handler ---------------------------------------------------------------------
const notifRaw = read('lib/vendor-stand-payment-notification.ts');
if (notifRaw) {
  const notif = strip(notifRaw);
  expect(/vendorStandOrderAmountMatches/.test(notif) && /from '@\/lib\/vendor-stand-order-amount'/.test(notif), 'handler must import vendorStandOrderAmountMatches from @/lib/vendor-stand-order-amount.');
  expect((notif.match(/vendorStandOrderAmountMatches\(/g) ?? []).length >= 2, 'BOTH amount guards (pre-read and in-transaction) must call vendorStandOrderAmountMatches.');
  expect(!/grossAmountCents\s*!==\s*(pre)?[oO]rderAmountCents/.test(notif), 'no raw `grossAmountCents !== orderAmountCents` comparison may remain.');
  expect(/amount:\s*orderAmount\b/.test(notif) && /order\?\.amount as number/.test(notif), 'receipt/admin notice must keep sourcing the REAL order.amount.');
  expect(!/['"`]0\.01['"`]|\b0\.01\b/.test(notif), 'no literal 0.01 in the handler.');
  const confirmAt = notif.indexOf('confirmNotification(');
  const firstGuardAt = notif.indexOf('vendorStandOrderAmountMatches(');
  expect(firstGuardAt !== -1 && confirmAt !== -1 && firstGuardAt < confirmAt, 'the amount guard must still run BEFORE confirmNotification().');
}

// --- 3. Pure helper ----------------------------------------------------------------------------
const helperRaw = read('lib/vendor-stand-order-amount.ts');
if (helperRaw) {
  expect(!/^\s*import\s/m.test(helperRaw), 'vendor-stand-order-amount.ts must be pure: no imports.');
  expect(!/process\.env|new Date\(|console\./.test(strip(helperRaw)), 'helper must not read env, the clock, or log.');
  expect(/\?\?/.test(helperRaw), 'helper must fall back with ?? exactly like the ticket path.');
}

// --- 4. Banner ---------------------------------------------------------------------------------
const formRaw = read('components/vendors/VendorStandPaymentForm.tsx');
if (formRaw) {
  const form = strip(formRaw);
  expect(/import\s*\{\s*OzowSandboxTestModeBanner\s*\}\s*from\s*'@\/components\/tickets\/OzowSandboxTestModeBanner'/.test(form), 'form must import the EXISTING OzowSandboxTestModeBanner.');
  expect(/<OzowSandboxTestModeBanner\s*\/>/.test(form), 'form must render <OzowSandboxTestModeBanner />.');
  expect(!/TEST MODE/i.test(form), 'form must not hardcode a second copy of the banner text.');
}
const shared = read('lib/ozow-sandbox-test-mode-shared.ts');
if (shared) expect(shared.includes('TEST MODE — Ozow charges R0.01 instead of the displayed price'), 'banner text constant must be the existing string.');

// --- 5. Untouched vs BASE ----------------------------------------------------------------------
const MUST_NOT_CHANGE = [
  'lib/ozow-sandbox-test-mode.ts',
  'lib/ozow-sandbox-test-mode-shared.ts',
  'components/tickets/OzowSandboxTestModeBanner.tsx',
  'lib/tickets-notification.ts',
  'lib/orders.ts',
  'lib/checkout-reservation.ts',
  'app/api/tickets/checkout/route.ts',
  'lib/payments/payfast.ts',
  'lib/vendor-stand-orders.ts',
  'lib/vendor-stand-payment-token.ts',
];
for (const f of MUST_NOT_CHANGE) {
  try { execFileSync('git', ['diff', '--quiet', BASE, '--', f], { stdio: 'ignore' }); }
  catch { failures.push(`${f} must be byte-identical to base ${BASE}.`); }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}
console.log('PASS: F5 reuses the existing toggle helpers and banner, reads the flag once, drives sent and accepted amounts from the stored expectation, and leaves ticket/PayFast code untouched.');
