// F6 (conference-workshop-tickets, M4) — A14: day-visitor's view-model carries a `days`
// array with exactly three independent entries (Friday/Saturday/Sunday, in that order),
// each out of the per-day 1000 cap with its own independently-resolved state, and
// `scarcity` stays null for day-visitor (it has no single pool); early-bird carries BOTH
// `days` (same per-day 1000 reading) AND a non-null `scarcity` (its own share of the
// shared 500-pool) simultaneously.
//
// Driven via loadTicketCardViewModel's DI seam (golden Addendum 2) with fixture ticketType
// docs. The day-visitor/early-bird distinction is carried on the SAME field
// `getPoolRemaining()`'s own pool-key resolution already uses (lib/checkout-reservation.ts
// `resolveDayQualifiedPoolKey`/`planPooledCapacity`'s `poolConfigByType`): a non-null
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
const SHARED_EB_POOL_TOTAL = 500;
const EXPECTED_DAYS = ['2027-09-24', '2027-09-25', '2027-09-26']; // Fri/Sat/Sun, 2027 show

function dayQualifiedTicketType({ capacityPool }) {
  return {
    price: 150,
    capacity: DAY_CAP,
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
function depsFor({ capacityPool, perDayRemaining }) {
  return {
    fetchTicketType: async () => dayQualifiedTicketType({ capacityPool }),
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
      // Not pinning the exact shared-pool number (its sourcing mechanism isn't specified by
      // any golden yet) — but it must not be the day-qualified cap echoed under a different
      // key, which would collapse the two independent ceilings this assertion exists to keep
      // apart.
      failures.push(`'early-bird': scarcity.total (${result.scarcity.total}) equals the day-qualified per-day cap — the two independent ceilings (day cap vs. shared pool) appear to have been collapsed into one`);
    }
  }
}

finish(
  'check-day-visitor-early-bird-dual-scarcity.mjs',
  failures,
  'day-visitor ships days-only (scarcity: null); early-bird ships BOTH days and a non-null scarcity against its own shared-pool ceiling.',
);
