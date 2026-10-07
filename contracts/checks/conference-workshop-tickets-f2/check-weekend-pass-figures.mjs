// F2 (conference-workshop-tickets, M1) — A2: weekend-pass is now a single-price product —
// price 380, regularPrice null, earlyBirdCutoff null, capacityPool null. The old
// date-cutoff early-bird mechanism (regularPrice 400 + EARLY_BIRD_CUTOFF) is superseded by
// the new shared-pool 'weekend-pass-early-bird' sibling SKU (see check-weekend-pass-early-
// bird-figures.mjs) — this slug itself must no longer carry any trace of it.
import { loadRepoModule, finish } from './_lib.mjs';

const { ADMISSION_PRODUCTS } = await loadRepoModule('lib/provisional-figures.ts');

const failures = [];
const weekendPass = ADMISSION_PRODUCTS.find((p) => p.slug === 'weekend-pass');

if (!weekendPass) {
  finish('check-weekend-pass-figures.mjs', ["no 'weekend-pass' product in ADMISSION_PRODUCTS"]);
}

if (weekendPass.price !== 380) {
  failures.push(`price is ${JSON.stringify(weekendPass.price)}, expected 380`);
}
if (weekendPass.regularPrice !== undefined && weekendPass.regularPrice !== null) {
  failures.push(`regularPrice is ${JSON.stringify(weekendPass.regularPrice)}, expected null/unset (date-cutoff mechanism retired)`);
}
if (weekendPass.earlyBirdCutoff !== null) {
  failures.push(`earlyBirdCutoff is ${JSON.stringify(weekendPass.earlyBirdCutoff)}, expected null (date-cutoff mechanism retired)`);
}
if (weekendPass.capacityPool !== undefined && weekendPass.capacityPool !== null) {
  failures.push(`capacityPool is ${JSON.stringify(weekendPass.capacityPool)}, expected null/unset (its own singleton, not pooled)`);
}

finish(
  'check-weekend-pass-figures.mjs',
  failures,
  'weekend-pass is a single-price 380 product with no date-cutoff mechanism and no pool.',
);
