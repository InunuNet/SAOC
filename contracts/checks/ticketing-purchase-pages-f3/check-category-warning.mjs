// F3 (ticketing-conferences-and-events, M2) — DEFECT REPAIR follow-up. The null-category
// read-time fallback (check-category-query-null-fallback.mjs) keeps /tickets non-empty
// regardless of migration timing, but a permanent, silent fallback risks masking a REAL future
// data bug forever: if someone ever creates a genuinely non-admission ticketType document and
// leaves `category` unset by mistake, the fallback would make it show up on /tickets as if it
// were an admission product, with nothing ever surfacing that mistake. See
// contracts/golden/ticketing-purchase-pages-f3/README.md, "Defect repair", point 2.
//
// lib/tickets-category-warning.ts must export a pure function `warnMissingCategoryFallback`
// that CategoryTicketsPage.tsx calls on every fetch. This check imports the REAL function (not
// source text) and observes its actual console.warn behavior against synthetic product lists.
//
// Run as: npx tsx contracts/checks/ticketing-purchase-pages-f3/check-category-warning.mjs

import { warnMissingCategoryFallback } from '../../../lib/tickets-category-warning.ts';

const failures = [];
const calls = [];
const originalWarn = console.warn;
console.warn = (...args) => calls.push(args.join(' '));

function reset() {
  calls.length = 0;
}

// Case 1: admission request, one product missing category — must warn, must name the slug.
reset();
warnMissingCategoryFallback(
  [
    { slug: 'vip', category: 'admission' },
    { slug: 'legacy-null-category', category: null },
  ],
  'admission',
);
if (calls.length !== 1) {
  failures.push(`admission + one missing category: expected exactly 1 warning, got ${calls.length}`);
} else if (!calls[0].includes('legacy-null-category')) {
  failures.push(`admission + one missing category: warning did not name the slug, got: ${calls[0]}`);
}

// Case 2: admission request, every product fully categorized — must not warn at all.
reset();
warnMissingCategoryFallback([{ slug: 'vip', category: 'admission' }], 'admission');
if (calls.length !== 0) {
  failures.push(`admission + fully categorized: expected 0 warnings, got ${calls.length}`);
}

// Case 3: conference request, a missing-category product present — must NOT warn as if it were
// an admission fallback (the fallback doesn't apply to this category at all — see
// check-category-query-null-fallback.mjs's "no leakage" cases). A silent product here is a
// separate, pre-existing visibility problem, not something this function claims to fix.
reset();
warnMissingCategoryFallback(
  [{ slug: 'mystery-product', category: null }],
  'conference',
);
if (calls.length !== 0) {
  failures.push(
    `conference + missing category: expected 0 warnings (fallback is admission-only), got ${calls.length}`,
  );
}

console.warn = originalWarn;

if (failures.length > 0) {
  console.error('FAIL: check-category-warning.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  'PASS: warnMissingCategoryFallback warns exactly once per null/missing-category admission ' +
    'product, names the slug, and stays silent everywhere the fallback does not apply.',
);
