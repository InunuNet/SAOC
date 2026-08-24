// Behavioural check for resolveEffectivePrice() (contracts/golden/ticketing-flow-redesign-f1/
// pricing-model.golden.md truth table). Exercises the pure function directly — no Firestore/
// Sanity connection needed.
import { resolveEffectivePrice } from '../../../lib/checkout-reservation.ts';

const FUTURE_CUTOFF = '2099-01-01';
const PAST_CUTOFF = '2000-01-01';
const NOW = new Date('2026-08-24T00:00:00Z');

const cases = [
  {
    name: 'no cutoff, no regularPrice -> price',
    input: { price: 150, regularPrice: null, earlyBirdCutoff: null, now: NOW },
    expect: 150,
  },
  {
    name: 'no cutoff, regularPrice set but irrelevant -> price',
    input: { price: 150, regularPrice: 999, earlyBirdCutoff: null, now: NOW },
    expect: 150,
  },
  {
    name: 'within window -> price (early-bird rate)',
    input: { price: 380, regularPrice: 400, earlyBirdCutoff: FUTURE_CUTOFF, now: NOW },
    expect: 380,
  },
  {
    name: 'past window, regularPrice set -> regularPrice',
    input: { price: 380, regularPrice: 400, earlyBirdCutoff: PAST_CUTOFF, now: NOW },
    expect: 400,
  },
  {
    name: 'past window, no regularPrice -> null (refuse, current legacy behavior)',
    input: { price: 130, regularPrice: null, earlyBirdCutoff: PAST_CUTOFF, now: NOW },
    expect: null,
  },
];

let failed = false;
for (const testCase of cases) {
  const result = resolveEffectivePrice(testCase.input);
  if (result !== testCase.expect) {
    failed = true;
    console.error(`FAIL: ${testCase.name} — expected ${testCase.expect}, got ${result}`);
  }
}

if (failed) {
  console.error('resolveEffectivePrice does not match the golden truth table.');
  process.exit(1);
}
console.log('PASS: resolveEffectivePrice matches the golden truth table for all cases.');
