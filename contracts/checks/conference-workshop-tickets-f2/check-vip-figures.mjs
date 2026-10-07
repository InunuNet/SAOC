// F2 (conference-workshop-tickets, M1) — A1: vip's shape is unchanged by this feature
// (price 300, regularPrice null, capacity 200, no early-bird mechanism) and its
// sourceCitation names the VIP override explicitly (team-lead's second-pass default,
// still a needs-Brad item, but shipped as the working figure rather than blocked —
// see goldens/f2-admission-evening-figures.golden.json).
import { loadRepoModule, finish } from './_lib.mjs';

const { ADMISSION_PRODUCTS } = await loadRepoModule('lib/provisional-figures.ts');

const failures = [];
const vip = ADMISSION_PRODUCTS.find((p) => p.slug === 'vip');

if (!vip) {
  finish('check-vip-figures.mjs', ["no 'vip' product in ADMISSION_PRODUCTS"]);
}

if (vip.price !== 300) {
  failures.push(`price is ${JSON.stringify(vip.price)}, expected 300`);
}
if (vip.regularPrice !== undefined && vip.regularPrice !== null) {
  failures.push(`regularPrice is ${JSON.stringify(vip.regularPrice)}, expected null/unset`);
}
if (vip.capacity !== 200) {
  failures.push(`capacity is ${JSON.stringify(vip.capacity)}, expected 200`);
}
if (vip.earlyBirdCutoff !== null) {
  failures.push(`earlyBirdCutoff is ${JSON.stringify(vip.earlyBirdCutoff)}, expected null (no early-bird mechanism)`);
}
if (typeof vip.sourceCitation !== 'string' || vip.sourceCitation.length === 0) {
  failures.push(`sourceCitation is ${JSON.stringify(vip.sourceCitation)}, expected a non-empty string`);
} else if (!/override/i.test(vip.sourceCitation) || !vip.sourceCitation.includes('2026-09-08')) {
  failures.push(
    `sourceCitation ${JSON.stringify(vip.sourceCitation)} does not explicitly name this as an override of the 2026-09-08 ruling`,
  );
}

finish('check-vip-figures.mjs', failures, "vip is price 300, capacity 200, no early-bird, override sourceCitation present.");
