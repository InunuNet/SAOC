// F4 (conference-workshop-tickets, M2) — A19: a day-qualified call
// (requiresDaySelection: true) and an unqualified call (false) against the SAME
// poolKeyBase return INDEPENDENTLY correct remaining counts for early-bird's two
// simultaneous ceilings (its day cap share + its shared-pool share) — proven by
// fixture, not just type-checked. Uses the optional `deps` DI parameter the golden's
// check-authoring addendum specifies, injecting stub sold-count functions so this runs
// with no live Firestore read, while still exercising the REAL getPoolRemaining() and
// the REAL resolveDayQualifiedPoolKey() it composes.
import { loadRepoModule, finish } from './_lib.mjs';

let mod;
try {
  mod = await loadRepoModule('lib/checkout-reservation.ts');
} catch (error) {
  finish('check-get-pool-remaining-early-bird-dual-ceiling.mjs', [`could not import lib/checkout-reservation.ts: ${error.message}`]);
}

if (typeof mod.getPoolRemaining !== 'function') {
  finish('check-get-pool-remaining-early-bird-dual-ceiling.mjs', ['getPoolRemaining is not exported (see A18)']);
}

const { getPoolRemaining } = mod;
const failures = [];
const FRIDAY = '2027-09-24';
const SHOW_ID = 'fixture-show';

// Fixture: Friday's day-visitor cap is 1000, 940 already sold (early-bird's share of
// that day-qualified pool) -> 60 remaining. The SAME early-bird slug's unqualified
// share of the shared 500-pool has 495 sold -> 5 remaining. These are deliberately
// DIFFERENT numbers so a bug that collapses the two calls into one would be caught —
// returning either 60 for both or 5 for both would both be wrong.
const dayQualifiedStub = async () => ({ early_bird_day_key_sentinel: 940 });
const unqualifiedStub = async () => ({ early_bird_unqualified_key_sentinel: 495 });

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
    getSoldCountsByTicketType: async () => ({ 'admission-early-bird': 495 }),
  },
);

if (dayQualifiedRemaining !== 60) {
  failures.push(`day-qualified call (Friday, 940/1000 sold) returned ${JSON.stringify(dayQualifiedRemaining)}, expected 60`);
}
if (unqualifiedRemaining !== 5) {
  failures.push(`unqualified call (shared pool, 495/500 sold) returned ${JSON.stringify(unqualifiedRemaining)}, expected 5`);
}
if (dayQualifiedRemaining === unqualifiedRemaining) {
  failures.push(
    `both calls returned the SAME value (${JSON.stringify(dayQualifiedRemaining)}) — the two ceilings were deliberately set to different remaining counts (60 vs 5) to catch exactly this collapse`,
  );
}

finish(
  'check-get-pool-remaining-early-bird-dual-ceiling.mjs',
  failures,
  'day-qualified (60 left) and unqualified (5 left) calls against early-bird resolve independently from fixture stubs.',
);
