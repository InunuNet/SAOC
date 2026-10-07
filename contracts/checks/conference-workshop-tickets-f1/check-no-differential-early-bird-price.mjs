// F1 (conference-workshop-tickets, M1) — A8: no silent fabricated discount survives in the
// live, non-retired product list. The OLD model's differential early-bird/normal prices
// (450/550 for SAOC Symposium and WOSA Conference individually, 750/900 for the SAOC/WOSA
// joint bundle) must not appear on any live CONFERENCE_PRODUCTS entry, and none of the four
// RETIRED_CONFERENCE_SLUGS names may appear in the live array at all (retired means absent
// from the live export, tracked only by name for the migration script — see
// RETIRED_FIELD_TRIP_SLUGS's own convention).
//
// Run as: node contracts/checks/conference-workshop-tickets-f1/check-no-differential-early-bird-price.mjs
// (also runs under `npx tsx` directly). Registers tsx's ESM loader programmatically — see
// check-retired-conference-slugs.mjs's own comment for why.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { register } from 'tsx/esm/api';

register();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { CONFERENCE_PRODUCTS, RETIRED_CONFERENCE_SLUGS } = await import(
  path.join(__dirname, '../../../lib/provisional-figures.ts')
);

const failures = [];

// The four old differential prices this feature retires, by value — a live product
// carrying any of these numbers would mean the old pricing ladder survived under a new name.
const OLD_DIFFERENTIAL_PRICES = new Set([450, 550, 750, 900]);

for (const product of CONFERENCE_PRODUCTS) {
  if (OLD_DIFFERENTIAL_PRICES.has(product.price)) {
    failures.push(`'${product.slug}': price ${product.price} matches an old retired differential price`);
  }
  if (/early-bird/i.test(product.slug)) {
    failures.push(`'${product.slug}': slug still carries an '-early-bird' suffix — the old differential-price model`);
  }
  if (product.earlyBirdCutoff !== null) {
    failures.push(`'${product.slug}': earlyBirdCutoff is ${JSON.stringify(product.earlyBirdCutoff)}, expected null (no early-bird mechanism)`);
  }
}

const liveSlugs = new Set(CONFERENCE_PRODUCTS.map((p) => p.slug));
for (const retiredSlug of RETIRED_CONFERENCE_SLUGS) {
  if (liveSlugs.has(retiredSlug)) {
    failures.push(`'${retiredSlug}': retired slug is still present in the live CONFERENCE_PRODUCTS array`);
  }
}

if (failures.length > 0) {
  console.error('FAIL: check-no-differential-early-bird-price.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  'PASS: no old differential early-bird price, no -early-bird slug, and no retired slug ' +
    'survives in the live CONFERENCE_PRODUCTS list.',
);
