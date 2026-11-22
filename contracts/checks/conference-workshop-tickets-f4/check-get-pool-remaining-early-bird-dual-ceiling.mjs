// F4 (conference-workshop-tickets, M2) — A19: a day-qualified call
// (requiresDaySelection: true) and an unqualified call (false) against the SAME
// poolKeyBase return INDEPENDENTLY correct remaining counts for early-bird's two
// simultaneous ceilings (its day cap share + its shared-pool share) — proven by
// fixture, not just type-checked. Uses the optional `deps` DI parameter the golden's
// check-authoring addendum specifies, injecting stub sold-count functions so this runs
// with no live Firestore read, while still exercising the REAL getPoolRemaining() and
// the REAL resolveDayQualifiedPoolKey() it composes.
//
// RELOCATED 2026-10-07 (build-break fix): getPoolRemaining() moved from
// lib/checkout-reservation.ts to lib/data/pool-remaining.ts — that function's
// lib/data/tickets.ts imports pulled firebase-admin into the client bundle
// (lib/checkout-reservation.ts is reached by a client component via
// lib/vendor-stand-pricing.ts) and broke `pnpm build`. See the golden's build-break
// addendum. resolveDayQualifiedPoolKey() it composes with is unmoved, still pure.
import { loadRepoModule, finish } from './_lib.mjs';

let mod;
try {
  mod = await loadRepoModule('lib/data/pool-remaining.ts');
} catch (error) {
  finish('check-get-pool-remaining-early-bird-dual-ceiling.mjs', [`could not import lib/data/pool-remaining.ts: ${error.message}`]);
}

if (typeof mod.getPoolRemaining !== 'function') {
  finish('check-get-pool-remaining-early-bird-dual-ceiling.mjs', ['getPoolRemaining is not exported (see A18)']);
}

const { getPoolRemaining } = mod;
const failures = [];
const FRIDAY = '2027-09-24';
const SHOW_ID = 'fixture-show';

// Fixture: Friday's day-visitor cap is 1000, 940 already sold (early-bird's share of
// that day-qualified pool) -> 60 remaining. The shared 500-pool's unqualified share is
// stubbed keyed the way getSoldCountsByTicketType() REALLY keys it — one entry PER REAL
// SLUG, never pre-merged by pool (Codex found, 2026-10-07, verified by team-lead: the
// previous version of this fixture stubbed `{'admission-early-bird': 495}`, a key that
// never exists in the real sold-counts map, so it passed without ever exercising the
// membership-summing logic it claimed to prove). Since 19 Nov (commit 76c52d56, Brad: the
// Weekend Pass has no early-bird price, weekend-pass-early-bird retired) early-bird is the
// ONLY product whose capacityPool is 'admission-early-bird' (lib/provisional-figures.ts):
// 200/500 sold, 300 remaining. 60 vs 300 are deliberately DIFFERENT numbers so a bug that
// collapses the two calls into one would be caught — returning either 60 for both or 300
// for both would both be wrong. The multi-member summing this fixture used to carry through
// weekend-pass-early-bird is now proven on the real two-member 'sunset-cocktails' pool
// (single x1 + couple x2) further down.
const dayQualifiedRemaining = await getPoolRemaining(
  { poolKeyBase: 'day-visitor', chosenDay: FRIDAY, requiresDaySelection: true, capacity: 1000, showId: SHOW_ID },
  {
    getSoldCountsByTicketTypeAndDay: async () => ({ 'day-visitor::2027-09-24': 940 }),
    getSoldCountsByTicketType: async () => ({}),
  },
);
const unqualifiedRemaining = await getPoolRemaining(
  { poolKeyBase: 'admission-early-bird', chosenDay: FRIDAY, requiresDaySelection: false, capacity: 500, showId: SHOW_ID },
  {
    getSoldCountsByTicketTypeAndDay: async () => ({}),
    getSoldCountsByTicketType: async () => ({ 'early-bird': 200 }),
  },
);

if (dayQualifiedRemaining !== 60) {
  failures.push(`day-qualified call (Friday, 940/1000 sold) returned ${JSON.stringify(dayQualifiedRemaining)}, expected 60`);
}
if (unqualifiedRemaining !== 300) {
  failures.push(
    `unqualified call (early-bird 200/500 sold on the shared admission-early-bird pool, keyed by REAL slug as getSoldCountsByTicketType() actually returns) returned ${JSON.stringify(unqualifiedRemaining)}, expected 300 — getPoolRemaining's unqualified branch must sum every slug whose capacityPool resolves to poolKeyBase, not look up poolKeyBase itself as a sold-counts key`,
  );
}
if (dayQualifiedRemaining === unqualifiedRemaining) {
  failures.push(
    `both calls returned the SAME value (${JSON.stringify(dayQualifiedRemaining)}) — the two ceilings were deliberately set to different remaining counts (60 vs 300) to catch exactly this collapse`,
  );
}

// Cross-slug (regression for the real oversell bug QA found 2026-10-07): day-visitor
// and early-bird are SIBLING slugs sharing Friday's ONE physical day-qualified pool
// (DAY_VISITOR_SHAPED_SLUGS, lib/provisional-figures.ts) — day-visitor's own prior
// sales (500) AND early-bird's prior sales (440) must BOTH count against it: 940/1000
// sold, 60 remaining. A getPoolRemaining() that only reads its own poolKeyBase's key
// (the pre-fix shape) would see just day-visitor's 500 sold and wrongly report 500
// remaining instead of 60.
const dualSlugRemaining = await getPoolRemaining(
  { poolKeyBase: 'day-visitor', chosenDay: FRIDAY, requiresDaySelection: true, capacity: 1000, showId: SHOW_ID },
  {
    getSoldCountsByTicketTypeAndDay: async () => ({
      'day-visitor::2027-09-24': 500,
      'early-bird::2027-09-24': 440,
    }),
    getSoldCountsByTicketType: async () => ({}),
  },
);
if (dualSlugRemaining !== 60) {
  failures.push(
    `cross-slug call (day-visitor 500 + early-bird 440 = 940/1000 sold on Friday's shared pool) returned ${JSON.stringify(dualSlugRemaining)}, expected 60 — getPoolRemaining must sum every sibling slug's sold count for chosenDay, not just its own poolKeyBase`,
  );
}

// Multi-member, headcount-weighted unqualified pool on REAL catalogue slugs: both
// sunset-cocktails products declare capacityPool 'sunset-cocktails' (single x1, couple x2).
// 3 singles + 2 couples = 3 + 4 = 7 heads of 100 -> 93 remaining. Looking the pool key up
// directly, or ignoring headcountPerUnit, would not give 93.
const sunsetRemaining = await getPoolRemaining(
  { poolKeyBase: 'sunset-cocktails', chosenDay: FRIDAY, requiresDaySelection: false, capacity: 100, showId: SHOW_ID },
  {
    getSoldCountsByTicketTypeAndDay: async () => ({}),
    getSoldCountsByTicketType: async () => ({ 'sunset-cocktails-single': 3, 'sunset-cocktails-couple': 2 }),
  },
);
if (sunsetRemaining !== 93) {
  failures.push(
    `multi-member pool call (sunset-cocktails: 3 singles x1 + 2 couples x2 = 7 heads of 100) returned ${JSON.stringify(sunsetRemaining)}, expected 93 — the unqualified branch must sum every member slug weighted by headcountPerUnit`,
  );
}

finish(
  'check-get-pool-remaining-early-bird-dual-ceiling.mjs',
  failures,
  'day-qualified (60 left) and unqualified (300 left, realistically-keyed per-slug stub; multi-member weighted summing proven on sunset-cocktails) calls against early-bird resolve independently.',
);
