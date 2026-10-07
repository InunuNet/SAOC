// F2 (conference-workshop-tickets, M1) — A5: the early-bird slug (day-visitor's own EB) is
// 120, capacityPool 'admission-early-bird', headcountPerUnit 1, capacity 500,
// earlyBirdCutoff null, excludedDays ['2027-09-23']. Note this slug already exists today
// as the OLD 'Early-Bird Exhibition Ticket' (price 130/capacity 400/date-cutoff-based) —
// this feature re-shapes it in place to the new pool-based mechanism, it does not add a
// new slug (unlike weekend-pass-early-bird).
import { loadRepoModule, finish } from './_lib.mjs';

const { ADMISSION_PRODUCTS } = await loadRepoModule('lib/provisional-figures.ts');

const failures = [];
const earlyBird = ADMISSION_PRODUCTS.find((p) => p.slug === 'early-bird');

if (!earlyBird) {
  finish('check-day-visitor-early-bird-figures.mjs', ["no 'early-bird' product in ADMISSION_PRODUCTS"]);
}

if (earlyBird.price !== 120) {
  failures.push(`price is ${JSON.stringify(earlyBird.price)}, expected 120`);
}
if (earlyBird.capacityPool !== 'admission-early-bird') {
  failures.push(`capacityPool is ${JSON.stringify(earlyBird.capacityPool)}, expected 'admission-early-bird'`);
}
if (earlyBird.headcountPerUnit !== 1) {
  failures.push(`headcountPerUnit is ${JSON.stringify(earlyBird.headcountPerUnit)}, expected 1`);
}
if (earlyBird.capacity !== 500) {
  failures.push(`capacity is ${JSON.stringify(earlyBird.capacity)}, expected 500`);
}
if (earlyBird.earlyBirdCutoff !== null) {
  failures.push(`earlyBirdCutoff is ${JSON.stringify(earlyBird.earlyBirdCutoff)}, expected null (pool-based, not date-based)`);
}
if (!Array.isArray(earlyBird.excludedDays) || earlyBird.excludedDays.length !== 1 || earlyBird.excludedDays[0] !== '2027-09-23') {
  failures.push(`excludedDays is ${JSON.stringify(earlyBird.excludedDays)}, expected exactly ['2027-09-23']`);
}

finish(
  'check-day-visitor-early-bird-figures.mjs',
  failures,
  "early-bird is 120/'admission-early-bird'/1/500, no date cutoff, excludedDays ['2027-09-23'].",
);
