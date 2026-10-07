// F6 (conference-workshop-tickets, M4) — A14: day-visitor's view-model carries a `days`
// array with exactly three independent entries (Friday/Saturday/Sunday, in that order),
// each out of the per-day 1000 cap with its own independently-resolved state, and
// `scarcity` stays null for day-visitor (it has no single pool); early-bird carries BOTH
// `days` (same per-day 1000 reading) AND a non-null `scarcity` (its own share of the
// shared 500-pool) simultaneously.
//
// Driven via loadTicketCardViewModel's DI seam (golden Addendum 2) with fixture ticketType
// docs. The day-visitor/early-bird distinction is carried on the SAME field
// `getPoolRemaining()`'s own pool-key resolution already uses (`resolveDayQualifiedPoolKey`/
// `planPooledCapacity`'s `poolConfigByType` — both still in lib/checkout-reservation.ts,
// unmoved; only getPoolRemaining() itself relocated to lib/data/pool-remaining.ts 2026-10-07,
// build-break fix, commit 08b7b8d9 — see the F4 golden's build-break addendum): a non-null
// `capacityPool` means this slug ALSO shares an unqualified pool with other slugs (early-
// bird's `admission-early-bird`, 500 total) on top of its own per-day cap; day-visitor's
// `capacityPool` is null/absent — no second ceiling exists for it to read, so `scarcity`
// has nothing to populate and must stay null rather than echoing the day-qualified number
// a second time under a different key.
import { loadRepoModule, finish } from './_lib.mjs';

let loadTicketCardViewModel;
try {
  ({ loadTicketCardViewModel } = await loadRepoModule('lib/view-models/load-ticket-card.ts'));
} catch (error) {
  finish('check-day-visitor-early-bird-dual-scarcity.mjs', [`could not import lib/view-models/load-ticket-card.ts: ${error.message}`]);
  process.exit(1);
}

const failures = [];
const DAY_CAP = 1000;
// Mirrors lib/provisional-figures.ts:134/:202 (ADMISSION_EARLY_BIRD_POOL_CAPACITY) — the
// real figure early-bird/weekend-pass-early-bird's own live ticketType.capacity carries.
// Fixed 2026-10-07 (team-lead): A19/A33's fix made the loader read THIS field (via
// effectiveCapacity(), see load-ticket-card.ts:306-318) for the pool total instead of the
// old static POOL_CAPACITY_SOURCE lookup — a stub that returns the SAME capacity (1000)
// for every slug regardless of which one is being fetched no longer distinguishes "pool
// total" from "day cap" the way it used to when the static table was the only source.
const SHARED_EB_POOL_TOTAL = 500;
const EXPECTED_DAYS = ['2027-09-24', '2027-09-25', '2027-09-26']; // Fri/Sat/Sun, 2027 show

// Slug-aware: day-visitor's own live capacity IS the per-day cap (1000); early-bird and
// weekend-pass-early-bird's own live capacity is the shared pool total (500) — two
// genuinely different numbers on two genuinely different products' own ticketType
// documents, exactly as lib/provisional-figures.ts:134/:202 vs. day-visitor's own 1000
// entry declare. A stub that collapsed these back to one number (the pre-fix bug this
// rewrite fixes) would silently make this assertion untestable against the real,
// slug-driven loader logic.
const CAPACITY_BY_SLUG = {
  'day-visitor': DAY_CAP,
  'early-bird': SHARED_EB_POOL_TOTAL,
  'weekend-pass-early-bird': SHARED_EB_POOL_TOTAL,
};

function dayQualifiedTicketType(slug, { capacityPool }) {
  return {
    price: 150,
    capacity: CAPACITY_BY_SLUG[slug] ?? DAY_CAP,
    releasedQuantity: null,
    capacityPool: capacityPool ?? null,
    requiresDaySelection: true,
    earlyBirdCutoff: null,
  };
}

// Real signature (F4 golden §7 + Addendum):
//   getPoolRemaining(args: { poolKeyBase, chosenDay?, requiresDaySelection, capacity, showId })
//     => Promise<number>  (the remaining count only — `total` is the caller's own `capacity`)
// The day-qualified call passes `requiresDaySelection: true` + `chosenDay`; the unqualified
// shared-pool call passes `requiresDaySelection: false` with no `chosenDay`.
//
// `fetchTicketType` is slug-aware (A19/A33 fix): early-bird's own call AND the loader's
// separate internal fetch of day-visitor's ticketType (for the day-cap block) both go
// through this same stub, each keyed by its own slug — mirroring how the real loader now
// reads each product's OWN live capacity rather than one shared static table entry.
function depsFor({ capacityPool, perDayRemaining }) {
  return {
    fetchTicketType: async (slug) => dayQualifiedTicketType(slug, { capacityPool }),
    getPoolRemaining: async (args) => {
      if (args && args.requiresDaySelection && args.chosenDay) {
        return perDayRemaining[args.chosenDay];
      }
      return Math.floor(SHARED_EB_POOL_TOTAL / 2);
    },
    computeEarlyBirdRemaining: (remaining) => remaining,
  };
}

// --- day-visitor: days only, scarcity stays null ---
{
  const result = await loadTicketCardViewModel('day-visitor', depsFor({
    capacityPool: null,
    perDayRemaining: { '2027-09-24': 500, '2027-09-25': 500, '2027-09-26': 500 },
  })).catch((error) => {
    failures.push(`loadTicketCardViewModel('day-visitor', ...) threw ${error.message}`);
    return null;
  });

  if (result) {
    if (result.scarcity !== null) {
      failures.push(`'day-visitor': scarcity is ${JSON.stringify(result.scarcity)}, expected null (no single pool)`);
    }
    if (!Array.isArray(result.days)) {
      failures.push(`'day-visitor': days is ${JSON.stringify(result.days)}, expected a 3-entry array`);
    } else {
      if (result.days.length !== 3) {
        failures.push(`'day-visitor': days has ${result.days.length} entries, expected exactly 3`);
      }
      const gotDays = result.days.map((d) => d.day);
      if (JSON.stringify(gotDays) !== JSON.stringify(EXPECTED_DAYS)) {
        failures.push(`'day-visitor': days order is ${JSON.stringify(gotDays)}, expected Fri/Sat/Sun as ${JSON.stringify(EXPECTED_DAYS)}`);
      }
      for (const entry of result.days) {
        if (entry.total !== DAY_CAP) {
          failures.push(`'day-visitor': day ${entry.day} total is ${entry.total}, expected the per-day cap ${DAY_CAP}`);
        }
      }
    }
  }
}

// --- early-bird: BOTH days AND a non-null scarcity against the shared pool ---
{
  const result = await loadTicketCardViewModel('early-bird', depsFor({
    capacityPool: 'admission-early-bird',
    perDayRemaining: { '2027-09-24': 500, '2027-09-25': 500, '2027-09-26': 500 },
  })).catch((error) => {
    failures.push(`loadTicketCardViewModel('early-bird', ...) threw ${error.message}`);
    return null;
  });

  if (result) {
    if (!Array.isArray(result.days) || result.days.length !== 3) {
      failures.push(`'early-bird': days is ${JSON.stringify(result.days)}, expected a 3-entry array (same per-day reading as day-visitor)`);
    }
    if (result.scarcity === null || result.scarcity === undefined) {
      failures.push("'early-bird': scarcity is null/undefined, expected a real ScarcityLine against the shared pool — early-bird has TWO independent ceilings and must report both");
    } else if (typeof result.scarcity.total !== 'number' || result.scarcity.total <= 0) {
      failures.push(`'early-bird': scarcity.total is ${JSON.stringify(result.scarcity.total)}, expected a real positive pool total`);
    } else if (result.scarcity.total === DAY_CAP) {
      // The two independent ceilings (day cap vs. shared pool) have been collapsed into
      // one — this is the specific regression this assertion exists to catch, kept as an
      // explicit, separately-worded failure even though the exact-value check below would
      // also catch it, so a future reader sees the mechanism of the bug, not just a number
      // mismatch.
      failures.push(`'early-bird': scarcity.total (${result.scarcity.total}) equals the day-qualified per-day cap — the two independent ceilings (day cap vs. shared pool) appear to have been collapsed into one`);
    } else if (result.scarcity.total !== SHARED_EB_POOL_TOTAL) {
      // Now pinned to the real figure (team-lead, 2026-10-07): A19/A33's fix makes this
      // number early-bird's OWN live ticketType.capacity via effectiveCapacity() — this
      // fixture's stub declares that capacity as SHARED_EB_POOL_TOTAL (mirroring
      // provisional-figures.ts:134/:202's real ADMISSION_EARLY_BIRD_POOL_CAPACITY), so the
      // loader has no other correct number it could produce.
      failures.push(`'early-bird': scarcity.total is ${result.scarcity.total}, expected the real shared-pool figure ${SHARED_EB_POOL_TOTAL} (this fixture's stubbed live capacity)`);
    }
  }
}

finish(
  'check-day-visitor-early-bird-dual-scarcity.mjs',
  failures,
  'day-visitor ships days-only (scarcity: null); early-bird ships BOTH days and a non-null scarcity against its own shared-pool ceiling.',
);
