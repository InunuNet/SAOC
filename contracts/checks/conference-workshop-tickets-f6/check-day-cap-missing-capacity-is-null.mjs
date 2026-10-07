// F6 (conference-workshop-tickets, M4) — A26 (added 2026-10-07, QA FAIL fix list item 1,
// relayed by team-lead): "no `?? 1000` magic fallback and null scarcity when capacity is
// absent." Same day-cap live-fetch fix as A25 (check-day-cap-from-live-day-visitor-
// capacity.mjs), the other half of its discipline: when day-visitor's live Sanity
// capacity is itself missing/unusable, the day-qualified reading must come back null —
// never silently defaulting to 1000 (the dead static value QA's report flagged) or any
// other invented number. Mirrors A23's (check-weekend-pass-null-capacity-scarcity.mjs)
// existing null-capacity-is-null discipline, applied here to the day-cap mechanism
// instead of a product's own direct `capacity` field.
//
// `scarcity` in this script's name/description deliberately matches team-lead's own
// wording for this fix item; the concrete field a day-qualified product populates for its
// per-day reading is `days` (scarcity stays reserved for the unqualified-pool ceiling —
// A14's existing, separate invariant), so this asserts `days === null`. early-bird's OWN
// unqualified-pool `scarcity` (its 500-ticket shared pool, wholly independent of the day
// cap) is asserted to stay correctly non-null in the SAME run, proving the two ceilings
// stay independent even when one of them goes missing.
import { loadRepoModule, finish } from './_lib.mjs';

let loadTicketCardViewModel;
try {
  ({ loadTicketCardViewModel } = await loadRepoModule('lib/view-models/load-ticket-card.ts'));
} catch (error) {
  finish('check-day-cap-missing-capacity-is-null.mjs', [`could not import lib/view-models/load-ticket-card.ts: ${error.message}`]);
  process.exit(1);
}

const failures = [];
const SHARED_EB_POOL_TOTAL = 500;

function ticketTypeFor(slug, dayVisitorCapacity) {
  if (slug === 'day-visitor') {
    return {
      price: 150,
      capacity: dayVisitorCapacity,
      capacityPool: null,
      requiresDaySelection: true,
      earlyBirdCutoff: null,
    };
  }
  return {
    price: 120,
    capacity: SHARED_EB_POOL_TOTAL,
    capacityPool: 'admission-early-bird',
    requiresDaySelection: true,
    earlyBirdCutoff: null,
  };
}

function depsWithMissingDayVisitorCapacity(dayVisitorCapacity) {
  return {
    fetchTicketType: async (slug) => ticketTypeFor(slug, dayVisitorCapacity),
    getPoolRemaining: async (args) => {
      if (args?.requiresDaySelection) {
        throw new Error(`getPoolRemaining called for a day-qualified reading with capacity=${JSON.stringify(args.capacity)} — the loader must skip the day-cap call entirely (days: null) when day-visitor's own capacity is unusable, never invent a fallback`);
      }
      return Math.floor((args?.capacity ?? 0) / 2);
    },
    computeEarlyBirdRemaining: (remaining) => remaining,
  };
}

for (const dayVisitorCapacity of [null, undefined]) {
  const result = await loadTicketCardViewModel('early-bird', depsWithMissingDayVisitorCapacity(dayVisitorCapacity)).catch((error) => {
    failures.push(`loadTicketCardViewModel('early-bird', <day-visitor capacity: ${JSON.stringify(dayVisitorCapacity)}>) threw ${error.message} — expected a clean days: null, not a crash or a fabricated 1000-based reading`);
    return null;
  });

  if (result) {
    if (result.days !== null) {
      failures.push(`'early-bird' with day-visitor capacity ${JSON.stringify(dayVisitorCapacity)}: days resolved to ${JSON.stringify(result.days)}, expected null — a missing live day-visitor capacity must never fall back to a fabricated/static day cap`);
    }
    if (result.scarcity === null || result.scarcity === undefined) {
      failures.push(`'early-bird' with day-visitor capacity ${JSON.stringify(dayVisitorCapacity)}: scarcity is ${JSON.stringify(result.scarcity)}, expected a real ScarcityLine against early-bird's OWN shared pool — this ceiling is independent of the missing day cap and must still resolve`);
    }
  }
}

finish(
  'check-day-cap-missing-capacity-is-null.mjs',
  failures,
  "'early-bird' resolves days: null (never a fabricated/static fallback) when day-visitor's live capacity is missing/unusable, while its own independent shared-pool scarcity still resolves correctly.",
);
