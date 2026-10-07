// F4 (conference-workshop-tickets, M2) — A8: VIP (200), Sunset Cocktails (200, shared
// pool), SAOC Symposium (80), WOSA Conference (80), and a workshop session (10) each
// still resolve their correct ceiling against the post-F1/F2/F3 data. Zero new
// mechanism — this is an assertion-only proof that F2's figure changes (vip.capacity
// 120 -> 200) didn't get lost, and that F1's conference figures and the workshop
// structure's capacity constant are all still correct, read directly from
// lib/provisional-figures.ts's live exports (not re-typed here).
import { loadRepoModule, finish } from './_lib.mjs';

const { ADMISSION_PRODUCTS, CONFERENCE_PRODUCTS, WORKSHOP_FIELD_TRIP_PRODUCTS, WORKSHOP_SESSION_CAPACITY } =
  await loadRepoModule('lib/provisional-figures.ts');

const failures = [];

const vip = ADMISSION_PRODUCTS.find((p) => p.slug === 'vip');
if (!vip) failures.push("no 'vip' product in ADMISSION_PRODUCTS");
else if (vip.capacity !== 200) failures.push(`vip.capacity is ${JSON.stringify(vip.capacity)}, expected 200 (post-F2)`);

const cocktailsSingle = WORKSHOP_FIELD_TRIP_PRODUCTS.find((p) => p.slug === 'sunset-cocktails-single');
const cocktailsCouple = WORKSHOP_FIELD_TRIP_PRODUCTS.find((p) => p.slug === 'sunset-cocktails-couple');
if (!cocktailsSingle || !cocktailsCouple) {
  failures.push('sunset-cocktails-single/couple missing from WORKSHOP_FIELD_TRIP_PRODUCTS');
} else {
  if (cocktailsSingle.capacity !== 200) failures.push(`sunset-cocktails-single.capacity is ${JSON.stringify(cocktailsSingle.capacity)}, expected 200`);
  if (cocktailsCouple.capacity !== 200) failures.push(`sunset-cocktails-couple.capacity is ${JSON.stringify(cocktailsCouple.capacity)}, expected 200`);
  if (cocktailsSingle.capacityPool !== cocktailsCouple.capacityPool) {
    failures.push('sunset-cocktails-single/couple do not share the same capacityPool');
  }
}

for (const slug of ['saoc-symposium', 'wosa-conference']) {
  const product = CONFERENCE_PRODUCTS.find((p) => p.slug === slug);
  if (!product) failures.push(`no '${slug}' product in CONFERENCE_PRODUCTS`);
  else if (product.capacity !== 80) failures.push(`${slug}.capacity is ${JSON.stringify(product.capacity)}, expected 80`);
}

if (WORKSHOP_SESSION_CAPACITY !== 10) {
  failures.push(`WORKSHOP_SESSION_CAPACITY is ${JSON.stringify(WORKSHOP_SESSION_CAPACITY)}, expected 10`);
}

finish(
  'check-per-product-caps-unaffected.mjs',
  failures,
  'VIP 200, Cocktails 200 (shared pool), Symposium 80, WOSA 80, workshop session 10 — all correct post-F1/F2/F3.',
);
