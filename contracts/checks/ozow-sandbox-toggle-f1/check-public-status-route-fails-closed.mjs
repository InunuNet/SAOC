// ozow-sandbox-toggle F1 — structural check that the PUBLIC checkout-facing status route
// (no admin gate — see README §4 for why that's deliberate) never surfaces a non-200/error to a
// buyer mid-checkout: any Firestore read failure must fail closed to { enabled: false }, not a
// 500. Also confirms this route is NOT admin-gated (its whole purpose is to be readable by an
// anonymous buyer's browser before they've authenticated as anything).
//
// See contracts/golden/ozow-sandbox-toggle-f1/README.md §4.
//
// Run as: node contracts/checks/ozow-sandbox-toggle-f1/check-public-status-route-fails-closed.mjs

import { readFileSync } from 'node:fs';

const path = 'app/api/tickets/ozow-sandbox-test-mode/route.ts';

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
  console.error('FAIL: public status route is missing.');
  process.exit(1);
}

// It must call the shared fail-closed helper — not reimplement its own Firestore read.
if (!/isOzowSandboxTestModeEnabled\s*\(/.test(src)) {
  fail('route does not call isOzowSandboxTestModeEnabled() from lib/ozow-sandbox-test-mode');
}

// It must NOT import/call the admin gate — this route is deliberately public.
if (/getAdminSession/.test(src) || /hasCapability/.test(src)) {
  fail('public status route must not be admin-gated — it is read by anonymous buyers pre-checkout');
}

// It must never return a NextResponse with a >= 300 status for this endpoint's GET — search for
// any explicit non-2xx status code literal in the file, which would mean some path can surface
// an error to the buyer instead of failing closed to enabled:false.
if (/status:\s*[3-5]\d\d/.test(src)) {
  fail('route contains a non-2xx status code — this endpoint must always resolve 200 with enabled:false on failure, never surface an error');
}

if (FAIL) {
  process.exit(1);
}
console.log('PASS: public status route is unauthenticated, uses the shared fail-closed helper, and never returns a non-2xx status.');
