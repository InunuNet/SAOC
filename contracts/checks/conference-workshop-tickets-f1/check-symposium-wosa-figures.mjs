// F1 (conference-workshop-tickets, M1) — A4: saoc-symposium and wosa-conference carry the
// exact new shape (price 2000, capacity 80, earlyBirdCutoff null, no tranche field of any
// kind, sourceCitation set) per goldens/f1-provisional-figures.golden.json
// "updatedInPlace". Checks the REAL CONFERENCE_PRODUCTS array, not source text — a product
// object's own keys, not a grep for a string that could appear only in a comment.
//
// Run as: node contracts/checks/conference-workshop-tickets-f1/check-symposium-wosa-figures.mjs
// (also runs under `npx tsx` directly). Registers tsx's ESM loader programmatically — see
// check-retired-conference-slugs.mjs's own comment for why.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { register } from 'tsx/esm/api';

register();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { CONFERENCE_PRODUCTS } = await import(
  path.join(__dirname, '../../../lib/provisional-figures.ts')
);

const failures = [];

const EXPECTED = {
  'saoc-symposium': { name: 'SAOC Symposium' },
  'wosa-conference': { name: 'WOSA Conference' },
};

if (!Array.isArray(CONFERENCE_PRODUCTS)) {
  console.error('FAIL: check-symposium-wosa-figures.mjs');
  console.error('  - CONFERENCE_PRODUCTS is not an array');
  process.exit(1);
}

// Exactly these two live products — a stray extra family/variant would silently slip past a
// find()-only check, same defect class check-conference-product-families.mjs guards against.
const actualSlugs = CONFERENCE_PRODUCTS.map((p) => p.slug);
const expectedSlugs = Object.keys(EXPECTED);
if (actualSlugs.length !== expectedSlugs.length || !expectedSlugs.every((s) => actualSlugs.includes(s))) {
  failures.push(
    `CONFERENCE_PRODUCTS slugs are ${JSON.stringify(actualSlugs)}, expected exactly ${JSON.stringify(expectedSlugs)}`,
  );
}

for (const [slug, expected] of Object.entries(EXPECTED)) {
  const product = CONFERENCE_PRODUCTS.find((p) => p.slug === slug);
  if (!product) {
    failures.push(`'${slug}': no such product in CONFERENCE_PRODUCTS`);
    continue;
  }

  if (product.name !== expected.name) {
    failures.push(`'${slug}': name is ${JSON.stringify(product.name)}, expected ${JSON.stringify(expected.name)}`);
  }
  if (product.category !== 'conference') {
    failures.push(`'${slug}': category is ${JSON.stringify(product.category)}, expected 'conference'`);
  }
  if (product.price !== 2000) {
    failures.push(`'${slug}': price is ${JSON.stringify(product.price)}, expected 2000`);
  }
  if (product.capacity !== 80) {
    failures.push(`'${slug}': capacity is ${JSON.stringify(product.capacity)}, expected 80`);
  }
  if (product.releasedQuantity !== null) {
    failures.push(`'${slug}': releasedQuantity is ${JSON.stringify(product.releasedQuantity)}, expected null`);
  }
  if (product.earlyBirdCutoff !== null) {
    failures.push(`'${slug}': earlyBirdCutoff is ${JSON.stringify(product.earlyBirdCutoff)}, expected null`);
  }
  if (product.requiresDaySelection !== false) {
    failures.push(`'${slug}': requiresDaySelection is ${JSON.stringify(product.requiresDaySelection)}, expected false`);
  }
  if (product.requiresAttendeeNames !== true) {
    failures.push(`'${slug}': requiresAttendeeNames is ${JSON.stringify(product.requiresAttendeeNames)}, expected true`);
  }
  // provisional: false — flipped 2026-10-07 (team-lead approved, architect rationale
  // check): price (R2000) AND capacity (80) are both Brad's own direct, unambiguous
  // verbatim ruling, same precedent as VIP's own provisional: false — never a
  // council/Lee-Ann-sheet-sourced estimate awaiting confirmation. See
  // goldens/f1-provisional-figures.golden.json's updated _note on both entries.
  if (product.provisional !== false) {
    failures.push(`'${slug}': provisional is ${JSON.stringify(product.provisional)}, expected false`);
  }
  // regularPrice: no regular/discounted-price concept at all for these two products —
  // either unset (undefined, the convention every other no-regular-price product in this
  // file uses) or explicit null both mean "none".
  if (product.regularPrice !== undefined && product.regularPrice !== null) {
    failures.push(`'${slug}': regularPrice is ${JSON.stringify(product.regularPrice)}, expected null/unset`);
  }
  // capacityPool/headcountPerUnit: each product is its own singleton pool — unset is the
  // documented default for that, same convention as day-visitor/weekend-pass/vip.
  if (product.capacityPool !== undefined && product.capacityPool !== null) {
    failures.push(`'${slug}': capacityPool is ${JSON.stringify(product.capacityPool)}, expected null/unset`);
  }
  if (product.headcountPerUnit !== undefined) {
    failures.push(`'${slug}': headcountPerUnit is ${JSON.stringify(product.headcountPerUnit)}, expected unset`);
  }
  if (!product.sourceCitation) {
    failures.push(`'${slug}': sourceCitation is falsy (${JSON.stringify(product.sourceCitation)}), expected a non-null citation`);
  }
  // A1 covers the module-wide grep; this re-asserts it at the OBJECT level — no key named
  // any variant of "tranche" on the live product itself.
  const trancheKeys = Object.keys(product).filter((k) => /tranche/i.test(k));
  if (trancheKeys.length > 0) {
    failures.push(`'${slug}': unexpected tranche-named key(s) present: ${JSON.stringify(trancheKeys)}`);
  }
}

if (failures.length > 0) {
  console.error('FAIL: check-symposium-wosa-figures.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  'PASS: saoc-symposium and wosa-conference each carry the exact new shape — R2000, 80 ' +
    'places, no early-bird mechanism, real sourceCitation.',
);
