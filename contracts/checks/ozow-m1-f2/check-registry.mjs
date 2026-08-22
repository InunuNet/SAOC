#!/usr/bin/env node
// A1 — lib/payments/index.ts BECOMES A REGISTRY, NOT A SECOND HARDCODED CONST.
//
// F1's index.ts exported one const, `paymentProvider: PaymentProvider`, permanently bound to
// PayFast. F2's whole job is making a SECOND provider selectable per-checkout, which a single
// const structurally cannot do. The architect spec (§2.2) specifies the smallest structural fix:
// a keyed map, `paymentProviders: Readonly<Record<string, PaymentProvider>>`, plus a
// `resolveProvider(id): PaymentProvider | null` lookup that returns null (never throws, never
// falls back) for anything not in the map — REJECTED alternatives were an if/else in the route
// (the exact inversion payment-provider-seam F2 fixed) and a dynamic-import plugin registry
// (over-engineering for two known providers).
//
// WHAT MAKES THIS FAIL: the old single `paymentProvider` const surviving as the only export
// (nothing to key by); `paymentProviders` missing either 'payfast' or 'ozow', or containing an
// extra/misspelled key; `resolveProvider` throwing instead of returning null on an unknown id;
// `resolveProvider` returning a truthy value for '', 'PayFast' (wrong case), or
// '__proto__'/'constructor' (prototype-pollution-shaped lookups — Object.prototype.hasOwnProperty
// is exactly the guard the spec's own snippet uses, and a naive `paymentProviders[id]` lookup
// returns Object.prototype methods for these, which is truthy and NOT null); resolveProvider('ozow')
// and resolveProvider('payfast') not returning the object whose own `.id` matches.
//
// Run as: npx tsx contracts/checks/ozow-m1-f2/check-registry.mjs

import { paymentProviders, resolveProvider } from '../../../lib/payments/index.ts';

const failures = [];
const ok = (name, cond, detail = '') => {
  if (!cond) failures.push(`${name}${detail ? `\n    ${detail}` : ''}`);
};

// 1. The registry has EXACTLY the two known providers, keyed correctly.
const keys = Object.keys(paymentProviders).sort();
ok('case 1: registry has exactly [ozow, payfast]', JSON.stringify(keys) === JSON.stringify(['ozow', 'payfast']),
  `actual keys: ${JSON.stringify(keys)}`);
ok('case 1b: payfast entry id is "payfast"', paymentProviders.payfast?.id === 'payfast');
ok('case 1c: ozow entry id is "ozow"', paymentProviders.ozow?.id === 'ozow');

// 2. resolveProvider resolves known ids to the SAME instances as the map.
ok('case 2: resolveProvider("payfast") === paymentProviders.payfast',
  resolveProvider('payfast') === paymentProviders.payfast);
ok('case 2b: resolveProvider("ozow") === paymentProviders.ozow',
  resolveProvider('ozow') === paymentProviders.ozow);

// 3. Unknown ids resolve to null — never throw, never fall back to a default provider.
const unknownCases = ['', 'stripe', 'PayFast', 'PAYFAST', 'Ozow', ' payfast', 'payfast ', 'null', 'undefined'];
for (const bad of unknownCases) {
  let result;
  let threw = false;
  try {
    result = resolveProvider(bad);
  } catch {
    threw = true;
  }
  ok(`case 3 (${JSON.stringify(bad)}): resolveProvider does not throw`, !threw);
  ok(`case 3 (${JSON.stringify(bad)}): resolveProvider returns null, not a provider`, result === null,
    `actual: ${JSON.stringify(result)}`);
}

// 4. Prototype-pollution-shaped lookups must not resolve to an Object.prototype method — the
// exact failure mode a bare `paymentProviders[id]` (no hasOwnProperty guard) produces.
for (const poison of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
  let result;
  try {
    result = resolveProvider(poison);
  } catch {
    result = 'threw';
  }
  ok(`case 4 (${poison}): does not resolve to an inherited Object.prototype member`,
    result === null, `actual: ${JSON.stringify(result)} (typeof ${typeof result})`);
}

if (failures.length > 0) {
  console.error(`FAIL — ${failures.length} case(s):\n\n${failures.join('\n\n')}`);
  process.exit(1);
}
console.log('PASS — registry shape and resolveProvider fail-closed lookup verified.');
