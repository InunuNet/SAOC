// ozow-sandbox-toggle F1 — structural check that the admin toggle route is gated by
// getAdminSession() + hasCapability(..., 'manage-payment-settings', ...) BEFORE any Firestore
// write, mirroring app/api/admin/vendors/route.ts's own wiring. Source-position technique, same
// as check-checkout-route-wiring.mjs.
//
// See contracts/golden/ozow-sandbox-toggle-f1/README.md §4.
//
// Run as: node contracts/checks/ozow-sandbox-toggle-f1/check-admin-route-gate.mjs

import { readFileSync } from 'node:fs';

const path = 'app/api/admin/settings/ozow-sandbox-test-mode/route.ts';

let FAIL = false;
function fail(msg) {
  console.error(`FAIL: ${msg}`);
  FAIL = true;
}

let src;
try {
  src = readFileSync(path, 'utf8');
} catch {
  fail(`${path} does not exist`);
  console.error('FAIL: admin toggle route is missing.');
  process.exit(1);
}

if (!/from ['"]@\/lib\/admin-auth['"]/.test(src) || !/getAdminSession/.test(src)) {
  fail('route does not import/call getAdminSession from @/lib/admin-auth');
}
if (!/hasCapability\s*\([^)]*['"]manage-payment-settings['"]/s.test(src)) {
  fail("route does not call hasCapability(..., 'manage-payment-settings', ...)");
}

const sessionIdx = src.indexOf('getAdminSession');
const capabilityIdx = src.indexOf('manage-payment-settings');
const writeIdx = src.search(/\.doc\([^)]*\)\.set\(/);

if (sessionIdx === -1 || capabilityIdx === -1) {
  fail('cannot locate both getAdminSession and manage-payment-settings to check ordering');
} else if (writeIdx !== -1 && (writeIdx < sessionIdx || writeIdx < capabilityIdx)) {
  fail('Firestore .doc(...).set(...) write appears BEFORE the session/capability check — not gated');
}

if (FAIL) {
  process.exit(1);
}
console.log('PASS: admin toggle route checks getAdminSession + manage-payment-settings capability before any write.');
