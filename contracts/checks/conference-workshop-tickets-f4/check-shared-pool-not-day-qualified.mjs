// F4 (conference-workshop-tickets, M2) — A6: the shared admission-early-bird pool check
// is NOT day-qualified — a weekend-pass-early-bird sale and an early-bird (day-visitor)
// sale on DIFFERENT days both draw from the SAME 500, regardless of day. Per the golden
// §7, this call deliberately passes requiresDaySelection: false for the pool-check,
// regardless of early-bird's OWN requiresDaySelection: true flag (that flag governs its
// SEPARATE day-qualified check, A4's concern, not this one). Composes the real
// resolveDayQualifiedPoolKey() (A1) with the real planPooledCapacity() — proving the
// pool collapses two different days into ONE counter, the opposite property A4 proves
// for day-visitor's per-day caps.
import { loadRepoModule, finish } from './_lib.mjs';

let mod;
try {
  mod = await loadRepoModule('lib/checkout-reservation.ts');
} catch (error) {
  finish('check-shared-pool-not-day-qualified.mjs', [`could not import lib/checkout-reservation.ts: ${error.message}`]);
}

const { resolveDayQualifiedPoolKey, planPooledCapacity } = mod;
if (typeof resolveDayQualifiedPoolKey !== 'function') {
  finish('check-shared-pool-not-day-qualified.mjs', ['resolveDayQualifiedPoolKey is not exported (see A1)']);
}

const failures = [];
const POOL_BASE = 'admission-early-bird';
const POOL_CAPACITY = 500;

// Both calls deliberately pass requiresDaySelection: false for the pool-check, even
// though early-bird's OWN product flag is true — see golden §7.
const fridayPoolKey = resolveDayQualifiedPoolKey(POOL_BASE, '2027-09-24', false);
const saturdayPoolKey = resolveDayQualifiedPoolKey(POOL_BASE, '2027-09-25', false);

if (fridayPoolKey !== POOL_BASE || saturdayPoolKey !== POOL_BASE) {
  failures.push(
    `expected BOTH calls to resolve to the unqualified base key ${JSON.stringify(POOL_BASE)}, got ${JSON.stringify(fridayPoolKey)} and ${JSON.stringify(saturdayPoolKey)}`,
  );
}

if (fridayPoolKey === saturdayPoolKey && typeof planPooledCapacity === 'function') {
  // 499 already sold (mixing weekend-pass-early-bird and early-bird), one more request on
  // a DIFFERENT day must still be rejected — the pool does not reset per day.
  const result = planPooledCapacity({
    requestedQtyByType: { 'weekend-pass-early-bird': 1, 'early-bird': 1 },
    soldCountsByType: { [fridayPoolKey]: 499 },
    capacityByType: { [fridayPoolKey]: POOL_CAPACITY },
    poolConfigByType: {
      'weekend-pass-early-bird': { pool: fridayPoolKey, headcountPerUnit: 1 },
      'early-bird': { pool: saturdayPoolKey, headcountPerUnit: 1 },
    },
  });
  // 499 sold + 2 requested (1 each) = 501 > 500 — over capacity, proving both draw from
  // the SAME counter even though "sold" was recorded under one unqualified key and the
  // requests are for two different products.
  if (result.kind !== 'over-capacity') {
    failures.push(`expected over-capacity (499 sold + 2 requested > 500 shared pool), got ${JSON.stringify(result)}`);
  }
}

finish(
  'check-shared-pool-not-day-qualified.mjs',
  failures,
  'the admission-early-bird pool collapses to ONE unqualified key regardless of chosenDay.',
);
