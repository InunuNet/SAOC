// F4 (conference-workshop-tickets, M2) — A7: Weekend Pass does NOT draw against
// day-visitor's per-day 1000 cap by default — this feature's shipped default (needs-Brad,
// flagged in the golden §2), not a silent assumption left unstated. Proven two ways: (1)
// weekend-pass's OWN requiresDaySelection is false (F2's figure — unaffected by this
// feature), and (2) resolveDayQualifiedPoolKey() given that false flag leaves
// weekend-pass's pool key untouched — it can never land inside a day-qualified
// `::<day>` key, so it structurally cannot be counted against any day-visitor per-day
// pool.
import { loadRepoModule, finish } from './_lib.mjs';

const { ADMISSION_PRODUCTS } = await loadRepoModule('lib/provisional-figures.ts');

const failures = [];
const weekendPass = ADMISSION_PRODUCTS.find((p) => p.slug === 'weekend-pass');

if (!weekendPass) {
  finish('check-weekend-pass-excluded-from-day-cap-default.mjs', ["no 'weekend-pass' product in ADMISSION_PRODUCTS"]);
}
if (weekendPass.requiresDaySelection !== false) {
  failures.push(`weekend-pass.requiresDaySelection is ${JSON.stringify(weekendPass.requiresDaySelection)}, expected false`);
}

let checkoutMod;
try {
  checkoutMod = await loadRepoModule('lib/checkout-reservation.ts');
} catch (error) {
  finish('check-weekend-pass-excluded-from-day-cap-default.mjs', [`could not import lib/checkout-reservation.ts: ${error.message}`]);
}

if (typeof checkoutMod.resolveDayQualifiedPoolKey !== 'function') {
  failures.push('resolveDayQualifiedPoolKey is not exported (see A1) — cannot prove weekend-pass stays unqualified');
} else {
  const resolved = checkoutMod.resolveDayQualifiedPoolKey('weekend-pass', '2027-09-24', weekendPass.requiresDaySelection);
  if (resolved !== 'weekend-pass') {
    failures.push(
      `resolveDayQualifiedPoolKey('weekend-pass', '2027-09-24', weekendPass.requiresDaySelection) returned ${JSON.stringify(resolved)}, expected the unqualified 'weekend-pass' — it must never draw against any day-qualified pool by default`,
    );
  }
}

finish(
  'check-weekend-pass-excluded-from-day-cap-default.mjs',
  failures,
  "weekend-pass's requiresDaySelection is false, so it never resolves to a day-qualified pool key — excluded from the day-visitor per-day cap by default.",
);
