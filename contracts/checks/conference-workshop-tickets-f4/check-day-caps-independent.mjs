// F4 (conference-workshop-tickets, M2) — A4: a day-visitor reservation for Friday and one
// for Saturday draw from INDEPENDENT 1000-unit counters — selling out Friday does not
// block Saturday. Proven by composing the real resolveDayQualifiedPoolKey() (A1) with the
// real, UNMODIFIED planPooledCapacity() (lib/checkout-reservation.ts:440) — exactly the
// shape route.ts's day-qualified call site must build. Fails today because
// resolveDayQualifiedPoolKey doesn't exist yet (A1) — the property is new, even though
// planPooledCapacity itself needs no change.
import { loadRepoModule, finish } from './_lib.mjs';

let mod;
try {
  mod = await loadRepoModule('lib/checkout-reservation.ts');
} catch (error) {
  finish('check-day-caps-independent.mjs', [`could not import lib/checkout-reservation.ts: ${error.message}`]);
}

const { resolveDayQualifiedPoolKey, planPooledCapacity } = mod;
if (typeof resolveDayQualifiedPoolKey !== 'function') {
  finish('check-day-caps-independent.mjs', ['resolveDayQualifiedPoolKey is not exported (see A1)']);
}
if (typeof planPooledCapacity !== 'function') {
  finish('check-day-caps-independent.mjs', ['planPooledCapacity is not exported — this should already exist, unmodified']);
}

const failures = [];
const FRIDAY = '2027-09-24';
const SATURDAY = '2027-09-25';
const DAY_CAP = 1000;

const fridayKey = resolveDayQualifiedPoolKey('day-visitor', FRIDAY, true);
const saturdayKey = resolveDayQualifiedPoolKey('day-visitor', SATURDAY, true);

if (fridayKey === saturdayKey) {
  failures.push(`Friday and Saturday resolved to the SAME pool key (${JSON.stringify(fridayKey)}) — they must be independent`);
}

// Friday is already sold out (1000/1000) — one more request for Friday must be rejected,
// while the SAME call's Saturday counter (0/1000, even though this is the SAME
// planPooledCapacity() invocation) must still succeed — proving the two days do not share
// one aggregate counter.
const result = planPooledCapacity({
  requestedQtyByType: { [fridayKey]: 1, [saturdayKey]: 1 },
  soldCountsByType: { [fridayKey]: DAY_CAP, [saturdayKey]: 0 },
  capacityByType: { [fridayKey]: DAY_CAP, [saturdayKey]: DAY_CAP },
  poolConfigByType: {},
});

if (result.kind !== 'over-capacity') {
  failures.push(`expected an over-capacity result (Friday is sold out), got ${JSON.stringify(result)}`);
} else {
  if (!result.ticketTypes.includes(fridayKey)) {
    failures.push(`over-capacity result does not name the sold-out Friday key ${JSON.stringify(fridayKey)}: ${JSON.stringify(result.ticketTypes)}`);
  }
  if (result.ticketTypes.includes(saturdayKey)) {
    failures.push(`Saturday's key ${JSON.stringify(saturdayKey)} was wrongly rejected alongside Friday's sellout — the two days are not independent`);
  }
}

// Cross-slug regression (QA repro, 2026-10-07): day-visitor and early-bird are SIBLING
// slugs sharing Friday's SAME physical day-qualified pool (DAY_VISITOR_SHAPED_SLUGS,
// lib/provisional-figures.ts) — the caller must map BOTH slugs' day-qualified keys to
// one pool key, not just whichever slug happens to be in the current request.
// CONTROL reproduces the real bug: a poolConfigByType built from only the CURRENT
// request's own slug (the cart-only shape route.ts used before its fix) leaves the
// OTHER slug's prior sold units keyed to themselves, never summed into the request's
// pool — planPooledCapacity() then wrongly allows an oversell. This MUST happen under
// an empty poolConfigByType, or the FIX assertions below prove nothing about the real
// defect class.
const dayVisitorFridayKey = resolveDayQualifiedPoolKey('day-visitor', FRIDAY, true);
const earlyBirdFridayKey = resolveDayQualifiedPoolKey('early-bird', FRIDAY, true);
const SHARED_FRIDAY_POOL_KEY = 'day-visitor::2027-09-24';
const sharedPoolConfig = {
  [dayVisitorFridayKey]: { pool: SHARED_FRIDAY_POOL_KEY, headcountPerUnit: 1 },
  [earlyBirdFridayKey]: { pool: SHARED_FRIDAY_POOL_KEY, headcountPerUnit: 1 },
};

// Direction 1: 950 early-bird already sold against Friday's shared pool; a NEW
// 60-unit day-visitor request must be rejected (950 + 60 = 1010 > 1000) — the exact
// shape of QA's repro (950 prior early-bird::Fri + 60 new day-visitor).
const controlDir1 = planPooledCapacity({
  requestedQtyByType: { [dayVisitorFridayKey]: 60 },
  soldCountsByType: { [earlyBirdFridayKey]: 950, [dayVisitorFridayKey]: 0 },
  capacityByType: { [dayVisitorFridayKey]: DAY_CAP, [SHARED_FRIDAY_POOL_KEY]: DAY_CAP },
  poolConfigByType: {}, // BUGGY: cart-only construction never maps early-bird's key
});
if (controlDir1.kind !== 'ok') {
  failures.push(
    `CONTROL dir1 (cross-slug): the pre-fix cart-only poolConfigByType shape was expected to WRONGLY ALLOW 950 prior early-bird + 60 new day-visitor (1010 > 1000), got ${JSON.stringify(controlDir1)} — the harness proves nothing about this defect class`,
  );
}
const fixDir1 = planPooledCapacity({
  requestedQtyByType: { [dayVisitorFridayKey]: 60 },
  soldCountsByType: { [earlyBirdFridayKey]: 950, [dayVisitorFridayKey]: 0 },
  capacityByType: { [SHARED_FRIDAY_POOL_KEY]: DAY_CAP },
  poolConfigByType: sharedPoolConfig,
});
if (fixDir1.kind !== 'over-capacity' || !fixDir1.ticketTypes.includes(dayVisitorFridayKey)) {
  failures.push(
    `FIX dir1 (cross-slug): 950 prior early-bird::Fri + 60 new day-visitor against Friday's shared 1000 pool must reject, got ${JSON.stringify(fixDir1)}`,
  );
}

// Direction 2 (symmetric): 950 day-visitor already sold; a NEW 60-unit early-bird
// request must be rejected too — the bug is not slug-order-dependent.
const controlDir2 = planPooledCapacity({
  requestedQtyByType: { [earlyBirdFridayKey]: 60 },
  soldCountsByType: { [dayVisitorFridayKey]: 950, [earlyBirdFridayKey]: 0 },
  capacityByType: { [earlyBirdFridayKey]: DAY_CAP, [SHARED_FRIDAY_POOL_KEY]: DAY_CAP },
  poolConfigByType: {},
});
if (controlDir2.kind !== 'ok') {
  failures.push(
    `CONTROL dir2 (cross-slug): the pre-fix cart-only poolConfigByType shape was expected to WRONGLY ALLOW 950 prior day-visitor + 60 new early-bird (1010 > 1000), got ${JSON.stringify(controlDir2)} — the harness proves nothing about this defect class`,
  );
}
const fixDir2 = planPooledCapacity({
  requestedQtyByType: { [earlyBirdFridayKey]: 60 },
  soldCountsByType: { [dayVisitorFridayKey]: 950, [earlyBirdFridayKey]: 0 },
  capacityByType: { [SHARED_FRIDAY_POOL_KEY]: DAY_CAP },
  poolConfigByType: sharedPoolConfig,
});
if (fixDir2.kind !== 'over-capacity' || !fixDir2.ticketTypes.includes(earlyBirdFridayKey)) {
  failures.push(
    `FIX dir2 (cross-slug): 950 prior day-visitor::Fri + 60 new early-bird against Friday's shared 1000 pool must reject, got ${JSON.stringify(fixDir2)}`,
  );
}

finish(
  'check-day-caps-independent.mjs',
  failures,
  'Friday (sold out) and Saturday (available) resolve independently from the same day-visitor product; cross-slug day-visitor/early-bird sales against the shared Friday pool correctly aggregate in both directions (control arm proves the harness can express the cross-slug defect QA found 2026-10-07).',
);
