// F6 (conference-workshop-tickets, M4) — A33 (added 2026-10-07, Codex round-3 finding,
// verified by team-lead against lib/view-models/load-ticket-card.ts): the shared
// early-bird pool's TOTAL must come from the same live Sanity capacity/releasedQuantity
// checkout itself reads, never from the static lib/provisional-figures.ts arrays.
//
// The historical bug: `resolveSharedPoolCapacity(poolKey)` (this file, scanning
// ADMISSION_PRODUCTS/CONFERENCE_PRODUCTS/WORKSHOP_FIELD_TRIP_PRODUCTS for a static
// `capacity` field) is the ONLY source `scarcity.total`/the `capacity` argument passed to
// `getPoolRemaining()` ever reads for a shared-pool product — see the `poolTotal` line in
// buildTicketCardViewModel's scarcity block. Checkout's own pool-ceiling computation
// (app/api/tickets/checkout/route.ts:615-626) is entirely different: for each cart item it
// reads that item's LIVE ticketType document's own `capacity`/`releasedQuantity` fields
// and calls `effectiveCapacity(capacity, releasedQuantity)` — the shared pure function
// this loader already imports and already uses elsewhere (the day-cap block above). A
// live capacity/releasedQuantity edit in Sanity changes what checkout will actually sell
// and what the card displays in two different, divergent ways.
//
// Driven via loadTicketCardViewModel's existing DI seam (golden Addendum 2). Stubs the
// 'weekend-pass-early-bird' ticketType (shares the early-bird pool, has no requiresDaySelection
// complexity, so no day-cap fetch path interferes) with a live capacity/releasedQuantity
// that DELIBERATELY differs from provisional-figures.ts's static 500
// (ADMISSION_EARLY_BIRD_POOL_CAPACITY) — asserts BOTH `result.scarcity.total` and the
// `capacity` argument the loader actually passes to `getPoolRemaining()` equal the live
// `effectiveCapacity()` result, never the static 500.
import { loadRepoModule, finish } from './_lib.mjs';

let loadTicketCardViewModel;
let ADMISSION_EARLY_BIRD_POOL_KEY, ADMISSION_EARLY_BIRD_POOL_CAPACITY;
let effectiveCapacity;
try {
  ({ loadTicketCardViewModel } = await loadRepoModule('lib/view-models/load-ticket-card.ts'));
  ({ ADMISSION_EARLY_BIRD_POOL_KEY, ADMISSION_EARLY_BIRD_POOL_CAPACITY } = await loadRepoModule('lib/provisional-figures.ts'));
  ({ effectiveCapacity } = await loadRepoModule('lib/checkout-reservation.ts'));
} catch (error) {
  finish('check-pool-total-from-live-capacity.mjs', [`could not import a repo module: ${error.message}`]);
  process.exit(1);
}

const failures = [];

function fetchTicketTypeStub(bySlug) {
  return async (slug) => bySlug[slug] ?? null;
}

async function runCase(label, { liveCapacity, liveReleasedQuantity }) {
  const expectedPoolTotal = effectiveCapacity(liveCapacity, liveReleasedQuantity);
  if (expectedPoolTotal === ADMISSION_EARLY_BIRD_POOL_CAPACITY) {
    failures.push(`${label}: test setup error — chosen live capacity/releasedQuantity resolves to the SAME value as the static ${ADMISSION_EARLY_BIRD_POOL_CAPACITY}, so this case cannot distinguish live from static`);
    return;
  }

  const observedGetPoolRemainingCapacities = [];
  const fetchTicketType = fetchTicketTypeStub({
    'weekend-pass-early-bird': {
      price: 360,
      regularPrice: null,
      capacity: liveCapacity,
      releasedQuantity: liveReleasedQuantity,
      capacityPool: ADMISSION_EARLY_BIRD_POOL_KEY,
      requiresDaySelection: false,
      earlyBirdCutoff: null,
    },
    'weekend-pass': {
      price: 380,
      regularPrice: null,
      capacity: 300,
      releasedQuantity: null,
      capacityPool: null,
      requiresDaySelection: false,
      earlyBirdCutoff: null,
    },
  });

  const result = await loadTicketCardViewModel('weekend-pass-early-bird', {
    fetchTicketType,
    getPoolRemaining: async (args) => {
      if (args.poolKeyBase === ADMISSION_EARLY_BIRD_POOL_KEY) {
        observedGetPoolRemainingCapacities.push(args.capacity);
      }
      // Stock level is irrelevant to this assertion — fixed mid-pool value so no
      // precedence rule (soldOut/earlyBirdSoldOut/low) can interfere with what's under
      // test here (the TOTAL, not the state).
      return Math.floor((args.capacity ?? 0) / 2);
    },
  });

  if (result === null) {
    failures.push(`${label}: loadTicketCardViewModel('weekend-pass-early-bird') resolved to null — not the scenario under test (check this script's own stub first)`);
    return;
  }

  if (result.scarcity === null) {
    failures.push(`${label}: scarcity is null — expected a populated ScarcityLine`);
  } else if (result.scarcity.total !== expectedPoolTotal) {
    failures.push(`${label}: expected scarcity.total === ${expectedPoolTotal} (live effectiveCapacity(${liveCapacity}, ${liveReleasedQuantity})), got ${result.scarcity.total} — reads the static provisional-figures.ts pool capacity (${ADMISSION_EARLY_BIRD_POOL_CAPACITY}) instead of the live ticketType document`);
  }

  if (observedGetPoolRemainingCapacities.length === 0) {
    failures.push(`${label}: getPoolRemaining() was never called for the shared pool — cannot verify what capacity it was called with`);
  } else if (observedGetPoolRemainingCapacities.some((cap) => cap !== expectedPoolTotal)) {
    failures.push(`${label}: getPoolRemaining() was called with capacity ${JSON.stringify(observedGetPoolRemainingCapacities)}, expected every call to carry ${expectedPoolTotal} (live effectiveCapacity), not the static ${ADMISSION_EARLY_BIRD_POOL_CAPACITY}`);
  }
}

// --- Case 1: live capacity above the static 500, no releasedQuantity narrowing ---
await runCase('live capacity 600, releasedQuantity null', {
  liveCapacity: 600,
  liveReleasedQuantity: null,
});

// --- Case 2: live releasedQuantity narrows below the static 500 ---
await runCase('live capacity 600, releasedQuantity 450', {
  liveCapacity: 600,
  liveReleasedQuantity: 450,
});

finish(
  'check-pool-total-from-live-capacity.mjs',
  failures,
  "the shared early-bird pool's total (scarcity.total and the capacity passed to getPoolRemaining()) comes from the live ticketType document's own capacity/releasedQuantity via effectiveCapacity() — the same function and the same live source checkout itself reads — never the static provisional-figures.ts pool table.",
);
