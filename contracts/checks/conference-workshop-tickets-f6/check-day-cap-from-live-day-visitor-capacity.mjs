// F6 (conference-workshop-tickets, M4) — A25 (added 2026-10-07, QA FAIL fix list item 1,
// relayed by team-lead): the card's day cap must come from the SAME Sanity day-visitor
// capacity checkout enforces — not a second, independently-constructed path. QA's own
// finding (qa-report-conference-workshop-tickets-f6.md, "Dead code") caught the prior
// implementation reading `resolveSharedPoolCapacity(DAY_VISITOR_DAY_CAP_POOL_KEY) ?? 1000`
// against the STATIC lib/provisional-figures.ts array rather than the live Sanity
// day-visitor ticketType document checkout's own route.ts actually reads at request time
// (app/api/tickets/checkout/route.ts's `dayVisitorOwnCapacity` capture, slug ===
// DAY_VISITOR_DAY_CAP_POOL_KEY === 'day-visitor'). The two happened to agree today only
// because nobody had edited day-visitor's Sanity capacity away from the static seed value.
//
// Proven here via a DI fixture that makes the two sources DISAGREE on purpose: the
// under-test product ('early-bird', which shares the day-qualified cap with 'day-visitor'
// but is a DIFFERENT Sanity document) gets a day cap from a stubbed `fetchTicketType`
// that returns capacity: 750 for the slug 'day-visitor' specifically — a number that
// exists nowhere in lib/provisional-figures.ts's static data, so the loader can only
// produce 750 by actually fetching day-visitor's own live ticketType, not by falling back
// to any hardcoded or pre-merged number.
import { loadRepoModule, finish } from './_lib.mjs';

let loadTicketCardViewModel;
try {
  ({ loadTicketCardViewModel } = await loadRepoModule('lib/view-models/load-ticket-card.ts'));
} catch (error) {
  finish('check-day-cap-from-live-day-visitor-capacity.mjs', [`could not import lib/view-models/load-ticket-card.ts: ${error.message}`]);
  process.exit(1);
}

const failures = [];
const LIVE_DAY_VISITOR_CAPACITY = 750; // deliberately NOT 1000 — proves the live fetch, not the static fallback
const SHARED_EB_POOL_TOTAL = 500;

function ticketTypeFor(slug) {
  if (slug === 'day-visitor') {
    return {
      price: 150,
      capacity: LIVE_DAY_VISITOR_CAPACITY,
      capacityPool: null,
      requiresDaySelection: true,
      earlyBirdCutoff: null,
    };
  }
  // 'early-bird' — shares the day-qualified cap with day-visitor but is its own document
  // with its OWN (unrelated) capacity field: the shared early-bird pool total, not a day cap.
  return {
    price: 120,
    capacity: SHARED_EB_POOL_TOTAL,
    capacityPool: 'admission-early-bird',
    requiresDaySelection: true,
    earlyBirdCutoff: null,
  };
}

const deps = {
  fetchTicketType: async (slug) => ticketTypeFor(slug),
  getPoolRemaining: async (args) => {
    if (args?.requiresDaySelection && args.capacity === 1000) {
      throw new Error('getPoolRemaining called with the dead static day cap (1000) — the loader must read day-visitor\'s LIVE capacity, never a hardcoded/pre-merged fallback');
    }
    return Math.floor((args?.capacity ?? 0) / 2);
  },
  computeEarlyBirdRemaining: (remaining) => remaining,
};

const result = await loadTicketCardViewModel('early-bird', deps).catch((error) => {
  failures.push(`loadTicketCardViewModel('early-bird', ...) threw ${error.message}`);
  return null;
});

if (result) {
  if (!Array.isArray(result.days) || result.days.length === 0) {
    failures.push(`'early-bird': days is ${JSON.stringify(result.days)}, expected a non-empty days array`);
  } else {
    for (const entry of result.days) {
      if (entry.total !== LIVE_DAY_VISITOR_CAPACITY) {
        failures.push(`'early-bird': day ${entry.day} total is ${entry.total}, expected day-visitor's LIVE capacity ${LIVE_DAY_VISITOR_CAPACITY} — got the static/fallback number instead of the live-fetched one`);
      }
    }
  }
}

finish(
  'check-day-cap-from-live-day-visitor-capacity.mjs',
  failures,
  `'early-bird's days[] total reflects day-visitor's live-fetched capacity (${LIVE_DAY_VISITOR_CAPACITY}), not a static/hardcoded day cap.`,
);
