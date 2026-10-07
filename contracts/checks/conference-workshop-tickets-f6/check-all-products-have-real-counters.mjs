// F6 (conference-workshop-tickets, M4) — A13: every in-scope product's view-model
// carries a real, non-null scarcity (or days) reading per the §1a table — VIP (200),
// Cocktails (200), Symposium (80), WOSA (80), each workshop session (10), Weekend Pass
// (300 estimate), and the shared EB pool (500) all resolve a real ScarcityLine, none ship
// a null placeholder. This is the regression the golden names explicitly: "the prior
// revision's VIP exception is withdrawn" — a slug-keyed exclusion branch (e.g.
// `if (slug === 'vip') return null`) sitting in loadTicketCardViewModel is exactly the
// defect class this check exists to catch.
//
// Proven via loadTicketCardViewModel's own DI seam (golden Addendum 2) — a fixture
// ticketType doc + a stub getPoolRemaining(), never a live Firestore/Sanity read, so this
// is deterministic and fast. For each non-day-qualified slug the fixture's capacity is set
// to its §1a ceiling; the loader must come back with `scarcity.total` equal to that
// ceiling and `scarcity !== null` — a hardcoded null-return branch for any one of these
// slugs would fail this test for exactly that slug, not generically.
import { loadRepoModule, finish } from './_lib.mjs';

let loadTicketCardViewModel;
try {
  ({ loadTicketCardViewModel } = await loadRepoModule('lib/view-models/load-ticket-card.ts'));
} catch (error) {
  finish('check-all-products-have-real-counters.mjs', [`could not import lib/view-models/load-ticket-card.ts: ${error.message}`]);
  process.exit(1);
}

const failures = [];

if (typeof loadTicketCardViewModel !== 'function') {
  finish('check-all-products-have-real-counters.mjs', [
    'lib/view-models/load-ticket-card.ts does not export loadTicketCardViewModel',
  ]);
  process.exit(1);
}

// §1a ceilings for every product that must carry a non-null `scarcity` (day-qualified
// products are covered separately by A14).
const SCARCITY_CASES = [
  { slug: 'vip', capacity: 200 },
  { slug: 'sunset-cocktails-single', capacity: 200 },
  { slug: 'sunset-cocktails-couple', capacity: 200 },
  { slug: 'saoc-symposium', capacity: 80 },
  { slug: 'wosa-conference', capacity: 80 },
  { slug: 'workshop-session-fixture', capacity: 10 },
  { slug: 'weekend-pass', capacity: 300 },
  { slug: 'weekend-pass-early-bird', capacity: 500 },
];

function fixtureTicketType({ capacity, requiresDaySelection = false }) {
  return {
    price: 100,
    capacity,
    capacityPool: null,
    requiresDaySelection,
    earlyBirdCutoff: null,
  };
}

for (const { slug, capacity } of SCARCITY_CASES) {
  const deps = {
    fetchTicketType: async () => fixtureTicketType({ capacity, requiresDaySelection: false }),
    // Real signature (F4 golden §7 + Addendum): getPoolRemaining(args) resolves to a plain
    // `number` (the remaining count) — `total` is the caller's own `capacity`, never part
    // of this return value.
    getPoolRemaining: async () => Math.floor(capacity / 2),
    computeEarlyBirdRemaining: (remaining) => remaining,
  };

  let result;
  try {
    result = await loadTicketCardViewModel(slug, deps);
  } catch (error) {
    failures.push(`loadTicketCardViewModel('${slug}', <fixture deps>) threw ${error.message}`);
    continue;
  }

  if (!result || result.scarcity === null || result.scarcity === undefined) {
    failures.push(`'${slug}': scarcity is ${JSON.stringify(result?.scarcity)}, expected a real ScarcityLine (ceiling ${capacity}) — not a null placeholder`);
    continue;
  }
  if (result.scarcity.total !== capacity) {
    failures.push(`'${slug}': scarcity.total is ${result.scarcity.total}, expected the fixture's ceiling ${capacity}`);
  }
  if (typeof result.scarcity.remaining !== 'number') {
    failures.push(`'${slug}': scarcity.remaining is ${JSON.stringify(result.scarcity.remaining)}, expected a number`);
  }
  if (typeof result.scarcity.label !== 'string' || result.scarcity.label.length === 0) {
    failures.push(`'${slug}': scarcity.label is ${JSON.stringify(result.scarcity.label)}, expected a non-empty plain-text label`);
  }
}

finish(
  'check-all-products-have-real-counters.mjs',
  failures,
  'Every §1a non-day-qualified product resolves a real, non-null ScarcityLine via the fixture-driven loader — no slug-keyed null-return exception exists.',
);
