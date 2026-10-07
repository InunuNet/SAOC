// F2 (conference-workshop-tickets, M1) — A8: excludedDays is a new OPTIONAL field on
// ProvisionalAdmissionProduct. Every product that does not opt in is unaffected — no
// default exclusion is silently introduced for vip/weekend-pass/weekend-pass-early-bird
// (or any CONFERENCE_PRODUCTS/WORKSHOP_FIELD_TRIP_PRODUCTS entry). Only day-visitor and
// early-bird set it, and both to exactly ['2027-09-23'].
import { loadRepoModule, finish } from './_lib.mjs';

const { ADMISSION_PRODUCTS, CONFERENCE_PRODUCTS, WORKSHOP_FIELD_TRIP_PRODUCTS } = await loadRepoModule(
  'lib/provisional-figures.ts',
);

const failures = [];
const SCOPED_SLUGS = new Set(['day-visitor', 'early-bird']);

const allProducts = [...ADMISSION_PRODUCTS, ...CONFERENCE_PRODUCTS, ...WORKSHOP_FIELD_TRIP_PRODUCTS];

for (const product of allProducts) {
  if (SCOPED_SLUGS.has(product.slug)) {
    if (!Array.isArray(product.excludedDays) || product.excludedDays.length !== 1 || product.excludedDays[0] !== '2027-09-23') {
      failures.push(`'${product.slug}': excludedDays is ${JSON.stringify(product.excludedDays)}, expected exactly ['2027-09-23']`);
    }
  } else if (product.excludedDays !== undefined && product.excludedDays !== null) {
    failures.push(`'${product.slug}': excludedDays is ${JSON.stringify(product.excludedDays)}, expected null/unset (not in scope for this field)`);
  }
}

finish(
  'check-excluded-days-optional-and-scoped.mjs',
  failures,
  'excludedDays is set only on day-visitor/early-bird; every other product is unaffected.',
);
