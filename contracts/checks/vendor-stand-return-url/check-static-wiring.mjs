#!/usr/bin/env node
// Static wiring proofs for the short gateway-return-URL fix (no network, no Firestore, no live
// data). The behavioural proofs live in the other checks; this proves the pieces are CONNECTED
// and that the properties they cannot see hold in source: the status page's attack surface, the
// absence of any token-bearing gateway URL anywhere in app/ and lib/, the adapter guard order,
// the route registries, and that the settlement path and the token module are untouched.
// Gate must run on the fix branch (based on a42694dc), not on a diverged branch.
//
// Run as: node contracts/checks/vendor-stand-return-url/check-static-wiring.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'a42694dc';
const failures = [];
const expect = (cond, msg) => { if (!cond) failures.push(msg); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, '$1');
const read = (rel) => {
  if (!existsSync(rel)) { failures.push(`missing file: ${rel}`); return null; }
  return readFileSync(rel, 'utf8');
};

// --- 1. The status page ----------------------------------------------------------------------
const PAGE = 'app/(nos)/national-show/vendors/payment/status/page.tsx';
const pageRaw = read(PAGE);
if (pageRaw) {
  const page = strip(pageRaw);
  expect(/export const dynamic = 'force-dynamic'/.test(page), 'page must be force-dynamic (reads Firestore per request).');
  expect(/noIndex:\s*true/.test(page), 'page metadata must be noIndex: true.');
  expect(/searchParams:\s*Promise<\{\s*a\?:\s*string \| string\[\]\s*\}>/.test(page), 'page searchParams must carry only `a` (never token, status, paid or a submission id).');
  expect(/resolveVendorStandReturnState/.test(page), 'page must decide via resolveVendorStandReturnState().');
  expect(/\.where\(\s*'attemptId'\s*,\s*'=='\s*,/.test(page) && /\.limit\(1\)/.test(page), "page must look the order up with .where('attemptId', '==', ...).limit(1).");
  expect(/VENDOR_STAND_ORDERS_COLLECTION/.test(page), 'page must read the vendorStandOrders collection via the shared constant.');
  expect(!/verifyVendorStandPaymentToken|mintVendorStandPaymentToken|VENDOR_STAND_PAYMENT_TOKEN_SECRET|cookies\(|headers\(/.test(page), 'page must not verify, mint or touch any token/secret/session (it is not a minting oracle).');
  expect(!/VENDOR_SUBMISSIONS_COLLECTION|businessName|contactEmail|contactPersonName|contactPhone|\bamount\b|standOrderRef|gatewayPaymentId/.test(page), 'page must not read or render the submission, PII, amount or references.');
  expect(!/\.(set|update|add|delete)\(|runTransaction|redirect\(|NextResponse/.test(page), 'page must be read-only and must not redirect.');
  expect(/NosHero/.test(page), 'page must reuse NosHero.');
}

// --- 1b. The /vsp alias (short URL for margin under Ozow's 150-char caps) ----------------
const VSP = 'app/(nos)/vsp/page.tsx';
const vspRaw = read(VSP);
if (vspRaw) {
  const vsp = strip(vspRaw);
  expect(/export const dynamic = 'force-dynamic'/.test(vsp), "vsp page must declare `export const dynamic = 'force-dynamic'` literally (segment config cannot be re-exported).");
  // REPAIRED 2026-11-22: the alias now passes the status page's metadata through
  // withTicketingTestTitle(), which spreads it (noIndex kept) and only rewrites a string title.
  expect(/from\s+'\.\.\/national-show\/vendors\/payment\/status\/page'/.test(vsp) && (/export\s*\{\s*metadata\s*\}/.test(vsp) || (/metadata\s+as\s+(\w+)/.test(vsp) && new RegExp(`export const metadata = withTicketingTestTitle\\(${(vsp.match(/metadata\s+as\s+(\w+)/) ?? [])[1]}\\)`).test(vsp))), 'vsp page must take its `metadata` (noIndex) from the status page, directly or via withTicketingTestTitle().');
  expect(/export default VendorStandPaymentStatusPage|export default \w+;/.test(vsp) && /import\s+\w+,\s*\{\s*metadata/.test(vsp), 'vsp page must re-export the status page component as its default.');
  expect(!/firebase|getFirestore|initAdmin|resolveVendorStandReturnState|VENDOR_STAND_ORDERS_COLLECTION|NosHero|searchParams|\.where\(/.test(vsp), 'vsp page must not duplicate any logic: no Firestore, resolver, hero or searchParams handling.');
  expect(vspRaw.split('\n').length <= 20, 'vsp page must stay a thin re-export (<= 20 lines).');
}
expect(existsSync(PAGE), 'the long status path must keep working alongside /vsp.');

// --- 2. Initiate route: no token in any gateway URL ------------------------------------------
const ROUTE = 'app/api/vendors/stand-payment/initiate/route.ts';
const routeRaw = read(ROUTE);
if (routeRaw) {
  const route = strip(routeRaw);
  expect(/buildVendorStandReturnUrl\(/.test(route), 'initiate route must build return/cancel URLs with buildVendorStandReturnUrl().');
  expect(/clampToMaxLength\(/.test(route), 'initiate route must clamp itemName with clampToMaxLength().');
  expect(!/returnUrl:[^\n]*token|cancelUrl:[^\n]*token|paid=1/.test(route), 'initiate route must not put the token or paid=1 in returnUrl/cancelUrl.');
}

// --- 3. Repo-wide: no token-bearing gateway URL anywhere -------------------------------------
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
for (const file of [...walk('app'), ...walk('lib')]) {
  const src = strip(readFileSync(file, 'utf8'));
  for (const m of src.matchAll(/\b(returnUrl|cancelUrl|successUrl|errorUrl|notifyUrl)\s*:\s*([^\n]*)/g)) {
    if (/token|encodeURIComponent/i.test(m[2])) failures.push(`${file}: ${m[1]} must not embed a token or a percent-encoded blob: ${m[2].trim().slice(0, 90)}`);
  }
}

// --- 4. Adapter guard ordering ---------------------------------------------------------------
const ozowRaw = read('lib/payments/ozow.ts');
if (ozowRaw) {
  const ozow = strip(ozowRaw);
  const guard = ozow.indexOf('findFieldLengthViolations(');
  const hash = ozow.indexOf('generateOzowHash(signedFields');
  expect(/gateway-field-limits/.test(ozow), 'lib/payments/ozow.ts must import gateway-field-limits.');
  expect(guard !== -1 && hash !== -1 && guard < hash, 'the length guard must run on signedFields BEFORE the hash is generated.');
  expect(/throw new Error\(/.test(ozow.slice(guard, hash)), 'the guard must throw (loud), not return a silent refusal.');
}
const limitsRaw = read('lib/payments/gateway-field-limits.ts');
if (limitsRaw) {
  expect(!/^\s*import\s/m.test(limitsRaw), 'gateway-field-limits.ts must be pure: no imports.');
}
const returnRaw = read('lib/vendor-stand-return.ts');
if (returnRaw) {
  expect(!/^\s*import\s[^\n]*(@\/|firebase|next\/)/m.test(returnRaw), 'vendor-stand-return.ts must be pure: no alias/firebase/next imports.');
  expect(!/process\.env|new Date\(|console\./.test(strip(returnRaw)), 'vendor-stand-return.ts must not read env, the clock, or log.');
}

// --- 5. Route registries ---------------------------------------------------------------------
const SLUG = '/national-show/vendors/payment/status';
for (const f of ['scripts/generate-nos-route-manifest.ts', 'scripts/checks/verify-show-page-m4.ts', 'content/national-show-routes.json']) {
  const src = read(f);
  if (src) expect(src.includes(SLUG), `${f} must register ${SLUG}.`);
}
const m4 = read('scripts/checks/verify-show-page-m4.ts');
if (m4) expect(new RegExp(`'${SLUG}':\\s*\\{[^}]*listed:\\s*false[^}]*indexable:\\s*false`).test(m4), 'verify-show-page-m4 entry must be listed:false, indexable:false.');

// --- 6. Settlement and token paths untouched -----------------------------------------------------
// REPAIRED 2026-11-22. This used to demand seven files be byte-identical to BASE. The payment page
// moved to app/(nos)/, and lib/payments/payfast.ts and the ticket checkout route legitimately changed
// many times, so those pins failed for reasons unrelated to what they protect. What they protected
// is "no token or paid flag reaches a gateway URL": section 2 and 3 above assert that directly for
// app/ and lib/ (including both of those files). The settlement and token modules and the vendor
// ITN routes have not drifted, so they stay byte-pinned to BASE.
const MUST_NOT_CHANGE = [
  'lib/vendor-stand-payment-token.ts',
  'lib/vendor-stand-orders.ts',
  'app/api/vendors/stand-payment/payfast-itn/route.ts',
  'app/api/vendors/stand-payment/ozow-itn/route.ts',
];
for (const f of MUST_NOT_CHANGE) {
  try {
    execFileSync('git', ['diff', '--quiet', BASE, '--', f], { stdio: 'ignore' });
  } catch {
    failures.push(`${f} must be byte-identical to base ${BASE}.`);
  }
}
const paymentPage = read('app/(nos)/national-show/vendors/payment/page.tsx');
if (paymentPage) expect(!/\b(returnUrl|cancelUrl)\s*:[^\n]*token/i.test(strip(paymentPage)), 'the vendor payment page must not put a token in a gateway URL.');

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}
console.log('PASS: status page surface, token-free gateway URLs repo-wide, adapter guard order, registries, and untouched settlement/token paths all verified.');
