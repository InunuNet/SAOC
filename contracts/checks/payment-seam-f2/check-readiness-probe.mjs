#!/usr/bin/env node
// A8 — THE READINESS PROBE IS A REAL QUESTION ABOUT CONFIG, NOT A CONSTANT.
//
// F2 introduced a defect F1 had explicitly pinned against: with gateway credentials unset, checkout
// wrote a reservation and THEN refused, because initiate() needs the booking reference and the
// server-derived amount and both only exist after reserveTicket(). fail-closed-guards.golden.md
// pins that guard as "Before reserveTicket(), i.e. before any Firestore write". A misconfigured
// gateway is the single most likely failure mode of a seam whose entire purpose is making gateway
// swaps cheap, and it lands while tickets are selling: silently converting a clean refusal into
// orphaned reservations that burn capacity until a TTL expires is the wrong trade.
//
// The fix is a sixth interface member — readiness(operation) — which the route can call BEFORE
// reserving without touching gateway env itself.
//
// WHAT MAKES THIS FAIL: readiness() not existing (pre-fix); returning a constant (case 3 mutates
// env on ONE instance and requires the verdict to flip, so a hardcoded `{ready:true}` dies);
// snapshotting config at construction (same case); requiring a passphrase for 'initiate', which
// would refuse purchases that succeed today and is a behaviour change F2 forbids (case 2);
// not naming what is missing (case 4); being async or making a network call (case 5) — a probe that
// costs a round trip cannot sit in front of every checkout.
//
// Run as: npx tsx contracts/checks/payment-seam-f2/check-readiness-probe.mjs

import { createPayfastProvider } from '../../../lib/payments/payfast.ts';

const failures = [];
const eq = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) failures.push(`${name}\n    expected: ${e}\n    actual:   ${a}`);
};
const ok = (name, cond, detail = '') => { if (!cond) failures.push(`${name}${detail ? `\n    ${detail}` : ''}`); };

const ID = '10000100';
const KEY = 'test-merchant-key-not-real';
const PASS = 'test-passphrase-not-real';

let fetchCalls = 0;
const make = (env) => createPayfastProvider({
  env,
  fetch: async () => { fetchCalls += 1; throw new Error('readiness() must not make a network call'); },
  resolveTrustedIps: async () => new Set(),
});

// Case 0 — the member exists at all. Checked first so the pre-fix state reports a clean, readable
// verdict instead of a TypeError stack: "readiness is not a function" buried in a trace is a worse
// failure message than a sentence saying which member is missing.
if (typeof make({}).readiness !== 'function') {
  console.error('FAIL A8 readiness probe — 1 case(s):');
  console.error('  - case 0: PaymentProvider has no readiness() member. The fail-closed guard');
  console.error('    cannot precede the reservation write without it — see');
  console.error('    contracts/golden/payment-seam-f1/fail-closed-guards.golden.md.');
  process.exit(1);
}

// Case 1 — POSITIVE CONTROL. Fully configured, 'initiate' is ready.
eq("case 1: fully configured -> ready for 'initiate'",
   make({ PAYFAST_SANDBOX_MERCHANT_ID: ID, PAYFAST_SANDBOX_MERCHANT_KEY: KEY, PAYFAST_SANDBOX_PASSPHRASE: PASS })
     .readiness('initiate'),
   { ready: true });

// Case 2 — THE ASYMMETRY F1 DOCUMENTED, PRESERVED. Checkout has never required a passphrase; the
// ITN path fails closed without one. A probe that demanded it for 'initiate' would refuse
// purchases that succeed today — a behaviour change under cover of a fix.
eq("case 2a: no passphrase is still ready to initiate",
   make({ PAYFAST_SANDBOX_MERCHANT_ID: ID, PAYFAST_SANDBOX_MERCHANT_KEY: KEY }).readiness('initiate'),
   { ready: true });
const verifyNoPass = make({ PAYFAST_SANDBOX_MERCHANT_ID: ID, PAYFAST_SANDBOX_MERCHANT_KEY: KEY })
  .readiness('verify-notification');
ok("case 2b: no passphrase is NOT ready to verify notifications", verifyNoPass.ready === false,
   JSON.stringify(verifyNoPass));

// Case 3 — NOT A CONSTANT, AND NOT SNAPSHOTTED. One instance, mutated env, verdict must flip.
// This is the case that kills a hardcoded return and a config captured at construction.
const mutable = {};
const probe = make(mutable);
const before = probe.readiness('initiate');
ok('case 3a: unconfigured -> not ready', before.ready === false, JSON.stringify(before));
mutable.PAYFAST_SANDBOX_MERCHANT_ID = ID;
mutable.PAYFAST_SANDBOX_MERCHANT_KEY = KEY;
const after = probe.readiness('initiate');
ok('case 3b: SAME instance flips to ready once env is populated', after.ready === true, JSON.stringify(after));

// Case 4 — IT NAMES WHAT IS MISSING. A bare boolean leaves the operator log useless; the whole
// point of refusing early is that somebody can tell WHY without a debugger.
const partial = make({ PAYFAST_SANDBOX_MERCHANT_ID: ID }).readiness('initiate');
ok('case 4a: partial credentials -> not ready', partial.ready === false, JSON.stringify(partial));
if (!partial.ready) {
  eq('case 4b: reason', partial.reason, 'not-configured');
  ok('case 4c: names the absent key and not the present one',
     Array.isArray(partial.missing)
       && partial.missing.some((m) => /MERCHANT_KEY/.test(m))
       && !partial.missing.some((m) => /MERCHANT_ID/.test(m)),
     JSON.stringify(partial.missing));
}
const none = make({}).readiness('initiate');
if (!none.ready) {
  ok('case 4d: with nothing set, both are named', none.missing.length >= 2, JSON.stringify(none.missing));
}

// Case 5 — SYNCHRONOUS AND OFFLINE. A probe in front of every checkout must not cost a round trip,
// and must not be a promise the caller could forget to await (a forgotten await on a readiness
// check is always truthy, which fails open).
ok('case 5a: readiness() is synchronous, not a promise',
   typeof make({}).readiness('initiate')?.then !== 'function');
eq('case 5b: zero network calls', fetchCalls, 0);

// Case 6 — NON-VACUITY. ready:true and ready:false are genuinely different verdicts, so cases 1-5
// cannot all be satisfied by a probe that returns the same shape every time.
ok('case 6: the probe discriminates',
   make({ PAYFAST_SANDBOX_MERCHANT_ID: ID, PAYFAST_SANDBOX_MERCHANT_KEY: KEY }).readiness('initiate').ready === true
   && make({}).readiness('initiate').ready === false);

if (failures.length) {
  console.error(`FAIL A8 readiness probe — ${failures.length} case(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('PASS A8 readiness probe');
