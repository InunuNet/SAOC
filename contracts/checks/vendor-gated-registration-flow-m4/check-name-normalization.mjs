#!/usr/bin/env node
// vendor-gated-registration-flow M4/F22 — real, executed proof of
// normalizeVendorCodeName() (lib/vendor-registration-code.ts) against every row in
// contracts/golden/vendor-gated-registration-flow-m4/vendor-registration-code-name-normalization.expected.md.
// Deterministic normalisation must forgive case/spacing/punctuation/accents WITHOUT collapsing
// genuinely different names into the same slug -- the second table (Fynbos Pottery vs Fynbos
// Potter) proves the function does not over-collapse.
//
// Run as: node --import tsx/esm contracts/checks/vendor-gated-registration-flow-m4/check-name-normalization.mjs

import { normalizeVendorCodeName } from '../../../lib/vendor-registration-code.ts';

const failures = [];

const CASES = [
  ['Fynbos Pottery', 'fynbospottery'],
  ['fynbos pottery', 'fynbospottery'],
  ['FYNBOS POTTERY', 'fynbospottery'],
  ['Fynbos-Pottery', 'fynbospottery'],
  ['Fynbos_Pottery', 'fynbospottery'],
  ['  Fynbos   Pottery  ', 'fynbospottery'],
  ['Fynbos Pottery!', 'fynbospottery'],
  ['Café Été', 'cafeete'],
  ['Ünique Örchids & Co.', 'uniqueorchidsco'],
  ['Cape-Town Orchid Co', 'capetownorchidco'],
  ['123 Plants', '123plants'],
  ['', ''],
];

for (const [input, expected] of CASES) {
  const actual = normalizeVendorCodeName(input);
  if (actual !== expected) {
    failures.push(`normalizeVendorCodeName(${JSON.stringify(input)}) = ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}.`);
  }
}

// Distinctness: two different names must not collapse to the same slug.
{
  const a = normalizeVendorCodeName('Fynbos Pottery');
  const b = normalizeVendorCodeName('Fynbos Potter');
  if (a === b) {
    failures.push(`'Fynbos Pottery' and 'Fynbos Potter' normalised to the same slug '${a}' -- over-collapsing widens the effective guess space.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: normalizeVendorCodeName() matches every golden case and never collapses distinct names.');
process.exit(0);
