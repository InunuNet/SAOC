// F2 (ticketing-complete, M1) — A15's real-mechanism replacement for the inline
// `node --import tsx/esm -e "..."` shell one-liner contract-f2.yaml originally carried.
//
// WHY THIS FILE EXISTS
// The team lead traced A15's contract.py failure to its own command, not the harness: a
// ~700-character `node -e "..."` string with nested single-quoted JS embedded in a
// double-quoted shell argument, inside a YAML block scalar. That is exactly the pattern this
// project's contract-authoring mandate forbids (see the architect's F8/A10 precedent, which
// hit the identical failure and moved its logic into a proper helper script rather than
// fighting the quoting). An assertion that cannot execute through `contract.py` is not
// actually in the gate — it runs only when a human remembers to run it by hand, which after
// this mission closes is never. So this script is what A15 should have been from the start,
// not an add-on.
//
// WHAT A15 IS ACTUALLY GUARDING (and why prefix-counting was already weak)
// F2 seeds exactly THREE conference purchase concepts (SAOC Symposium, WOSA Conference,
// SAOC/WOSA Joint), each as an early-bird/normal pair — never a fourth family, and never a
// duplicate product minted per content-page route (/national-show/symposium and
// /national-show/wosa-conference are content pages with a CTA through to the single
// purchase surface /national-show/conferences — see goldens/f2-README.md §11). The contract's
// original command counted DISTINCT MATCHED NAME PREFIXES, which is satisfiable by a
// genuinely new 4th product whose name happens to start with an already-allowed prefix (e.g.
// "WOSA Conference Extra Track") — a contract weakness reported in this feature's own
// dev-result. This script checks IDENTITY instead: the exact set of 6 expected `slug`s (3
// families × early-bird/normal), no more, no fewer, no substitutes — which a same-prefix
// impostor product cannot satisfy, because its slug would not be in the expected set.
//
// Run as: npx tsx contracts/checks/ticketing-complete-f2/check-conference-product-families.mjs

import { CONFERENCE_PRODUCTS } from '../../../lib/provisional-figures.ts';

const failures = [];

// The exact, literal identity set — 3 families × {early-bird, normal}. Not derived from a
// pattern at runtime (that would just re-implement the same prefix-matching weakness this
// check exists to close); hand-enumerated once, against the real live array below.
const EXPECTED_SLUGS = [
  'saoc-symposium-early-bird',
  'saoc-symposium',
  'wosa-conference-early-bird',
  'wosa-conference',
  'saoc-wosa-joint-early-bird',
  'saoc-wosa-joint',
];

const EXPECTED_NAME_BY_SLUG = {
  'saoc-symposium-early-bird': 'SAOC Symposium (Early-Bird)',
  'saoc-symposium': 'SAOC Symposium',
  'wosa-conference-early-bird': 'WOSA Conference (Early-Bird)',
  'wosa-conference': 'WOSA Conference',
  'saoc-wosa-joint-early-bird': 'SAOC/WOSA Joint (Early-Bird)',
  'saoc-wosa-joint': 'SAOC/WOSA Joint',
};

if (!Array.isArray(CONFERENCE_PRODUCTS)) {
  console.error('FAIL: check-conference-product-families.mjs');
  console.error('  - CONFERENCE_PRODUCTS is not an array');
  process.exit(1);
}

const actualSlugs = CONFERENCE_PRODUCTS.map((p) => p.slug);
const actualSlugSet = new Set(actualSlugs);
const expectedSlugSet = new Set(EXPECTED_SLUGS);

// Duplicates would silently collapse into the same Set entry and hide behind a
// same-length/same-membership check below, so count them explicitly first.
const duplicateSlugs = actualSlugs.filter((slug, i) => actualSlugs.indexOf(slug) !== i);
if (duplicateSlugs.length > 0) {
  failures.push(`duplicate slug(s) in CONFERENCE_PRODUCTS: ${JSON.stringify([...new Set(duplicateSlugs)])}`);
}

const missing = EXPECTED_SLUGS.filter((slug) => !actualSlugSet.has(slug));
if (missing.length > 0) {
  failures.push(`missing expected conference product slug(s): ${JSON.stringify(missing)}`);
}

const unexpected = actualSlugs.filter((slug) => !expectedSlugSet.has(slug));
if (unexpected.length > 0) {
  failures.push(
    `unexpected conference product slug(s) not in the 3-family set: ${JSON.stringify(unexpected)} ` +
      '— this is exactly the "fourth family" or "duplicate per content-page route" defect A15 guards against'
  );
}

for (const product of CONFERENCE_PRODUCTS) {
  const expectedName = EXPECTED_NAME_BY_SLUG[product.slug];
  if (expectedName !== undefined && product.name !== expectedName) {
    failures.push(`'${product.slug}': name is ${JSON.stringify(product.name)}, expected ${JSON.stringify(expectedName)}`);
  }
  if (product.category !== 'conference') {
    failures.push(`'${product.slug}': category is ${JSON.stringify(product.category)}, expected 'conference'`);
  }
}

if (failures.length > 0) {
  console.error('FAIL: check-conference-product-families.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  'PASS: CONFERENCE_PRODUCTS is exactly the 3 purchase-concept families (SAOC Symposium, ' +
    'WOSA Conference, SAOC/WOSA Joint), each an early-bird/normal pair, identified by slug ' +
    '— no fourth family, no duplicate, no substitution.'
);
