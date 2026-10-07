// F2 (conference-workshop-tickets, M1) — A3: a NEW weekend-pass-early-bird product exists
// — price 360, capacity 500, capacityPool 'admission-early-bird', headcountPerUnit 1,
// earlyBirdCutoff null. This is the genuinely new SKU Brad's message 6 requires: the
// early-bird mechanism moves from a per-slug date cutoff to a shared 500-ticket pool with
// day-visitor's own 'early-bird' sibling (see check-shared-pool-key-identical.mjs).
import { loadRepoModule, finish } from './_lib.mjs';

const { ADMISSION_PRODUCTS } = await loadRepoModule('lib/provisional-figures.ts');

const failures = [];
const weekendPassEb = ADMISSION_PRODUCTS.find((p) => p.slug === 'weekend-pass-early-bird');

if (!weekendPassEb) {
  finish('check-weekend-pass-early-bird-figures.mjs', [
    "no 'weekend-pass-early-bird' product in ADMISSION_PRODUCTS — this is a NEW slug this feature must add, not an edit to an existing one",
  ]);
}

if (weekendPassEb.price !== 360) {
  failures.push(`price is ${JSON.stringify(weekendPassEb.price)}, expected 360`);
}
if (weekendPassEb.capacity !== 500) {
  failures.push(`capacity is ${JSON.stringify(weekendPassEb.capacity)}, expected 500`);
}
if (weekendPassEb.capacityPool !== 'admission-early-bird') {
  failures.push(`capacityPool is ${JSON.stringify(weekendPassEb.capacityPool)}, expected 'admission-early-bird'`);
}
if (weekendPassEb.headcountPerUnit !== 1) {
  failures.push(`headcountPerUnit is ${JSON.stringify(weekendPassEb.headcountPerUnit)}, expected 1`);
}
if (weekendPassEb.earlyBirdCutoff !== null) {
  failures.push(`earlyBirdCutoff is ${JSON.stringify(weekendPassEb.earlyBirdCutoff)}, expected null (pool-based, not date-based)`);
}

finish(
  'check-weekend-pass-early-bird-figures.mjs',
  failures,
  "weekend-pass-early-bird is a new 360/500/'admission-early-bird'/1 pool-sibling product.",
);
