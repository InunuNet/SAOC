// F2 (conference-workshop-tickets, M1) — A6: weekend-pass-early-bird and the early-bird
// slug share the IDENTICAL capacityPool string literal — a typo between them (e.g.
// 'admission-early-bird' vs 'admission-earlybird') would silently create two SEPARATE
// pools instead of one shared 500-ticket pool, defeating the entire point of Brad's
// message 6 design. Checked by strict === on the live values, not by re-typing the
// literal here twice (that would just move the typo risk into this script).
import { loadRepoModule, finish } from './_lib.mjs';

const { ADMISSION_PRODUCTS } = await loadRepoModule('lib/provisional-figures.ts');

const failures = [];
const weekendPassEb = ADMISSION_PRODUCTS.find((p) => p.slug === 'weekend-pass-early-bird');
const earlyBird = ADMISSION_PRODUCTS.find((p) => p.slug === 'early-bird');

if (!weekendPassEb) failures.push("no 'weekend-pass-early-bird' product in ADMISSION_PRODUCTS");
if (!earlyBird) failures.push("no 'early-bird' product in ADMISSION_PRODUCTS");

if (weekendPassEb && earlyBird) {
  if (!weekendPassEb.capacityPool) {
    failures.push(`weekend-pass-early-bird.capacityPool is falsy (${JSON.stringify(weekendPassEb.capacityPool)})`);
  }
  if (!earlyBird.capacityPool) {
    failures.push(`early-bird.capacityPool is falsy (${JSON.stringify(earlyBird.capacityPool)})`);
  }
  if (weekendPassEb.capacityPool && earlyBird.capacityPool && weekendPassEb.capacityPool !== earlyBird.capacityPool) {
    failures.push(
      `weekend-pass-early-bird.capacityPool (${JSON.stringify(weekendPassEb.capacityPool)}) !== ` +
        `early-bird.capacityPool (${JSON.stringify(earlyBird.capacityPool)}) — these two must share ONE pool key`,
    );
  }
}

finish(
  'check-shared-pool-key-identical.mjs',
  failures,
  'weekend-pass-early-bird and early-bird share the identical, non-empty capacityPool literal.',
);
