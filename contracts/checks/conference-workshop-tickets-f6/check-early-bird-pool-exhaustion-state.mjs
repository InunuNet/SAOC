// F6 (conference-workshop-tickets, M4) — A32 (added 2026-10-07, Codex round-2 finding,
// verified by team-lead against lib/view-models/load-ticket-card.ts): when the SHARED
// early-bird pool (ADMISSION_EARLY_BIRD_POOL_KEY) is exhausted, the two products that share
// it — 'early-bird' and 'weekend-pass-early-bird' — must resolve to state
// 'earlyBirdSoldOut', never plain 'soldOut'. Per ticket-card.ts's own documented
// TicketCardState precedence (lines 18-23): 'soldOut' is for "a non-early-bird product, or
// an early-bird-ineligible product's own ceiling"; 'earlyBirdSoldOut' exists specifically so
// the design peer can render pool-exhaustion language different from a flat sellout.
//
// The historical bug: for these two pool siblings, `scarcity.remaining` and
// `earlyBirdRemaining` were the SAME pool count, both fed into resolveTicketCardState().
// Its generic `remaining <= 0 -> 'soldOut'` rule (#2) is checked before its
// `earlyBirdRemaining <= 0 -> 'earlyBirdSoldOut'` rule (#3) — see
// lib/view-models/ticket-card.ts's resolveTicketCardState — so passing the same exhausted
// count through as the generic `remaining` always won the precedence race and these two
// cards could never actually resolve 'earlyBirdSoldOut'.
//
// Also asserts, per team-lead's explicit instruction: `scarcity.remaining` must still
// report 0 (and `scarcity.total` the real pool total) even when the card-level STATE
// resolution takes the early-bird branch — the displayed count is never hidden/zeroed out
// just because the state resolver internally nulls its own `remaining` input at the exact
// exhaustion boundary (see that function's own Codex-finding comment on why it nulls only
// at <= 0, never above it).
//
// Third case (added per team-lead's "if near-exhaustion should read 'low', pin that too"):
// per ticket-card.ts's own resolveTicketCardState doc comment (rule #4), a pool product
// with stock remaining above zero but at/below LOW_STOCK_THRESHOLD_PERCENT (10%) of its
// total must resolve 'low' — the golden does NOT say otherwise; nulling only fires at the
// exact <= 0 exhaustion boundary (see the comment quoted above), so this is the expected,
// not an exceptional, behaviour and is pinned here as a regression guard.
//
// Driven via loadTicketCardViewModel's existing DI seam (golden Addendum 2). The real
// (non-DI) `computeEarlyBirdRemaining` pure function is left wired for fidelity — only
// `fetchTicketType`/`getPoolRemaining` are stubbed, matching A29/A31's convention.
import { loadRepoModule, finish } from './_lib.mjs';

let loadTicketCardViewModel;
let ADMISSION_EARLY_BIRD_POOL_KEY;
let ADMISSION_EARLY_BIRD_POOL_CAPACITY;
let effectiveCapacity;
try {
  ({ loadTicketCardViewModel } = await loadRepoModule('lib/view-models/load-ticket-card.ts'));
  ({ ADMISSION_EARLY_BIRD_POOL_KEY, ADMISSION_EARLY_BIRD_POOL_CAPACITY } = await loadRepoModule('lib/provisional-figures.ts'));
  ({ effectiveCapacity } = await loadRepoModule('lib/checkout-reservation.ts'));
} catch (error) {
  finish('check-early-bird-pool-exhaustion-state.mjs', [`could not import a repo module: ${error.message}`]);
  process.exit(1);
}

// This fixture's early-bird/weekend-pass-early-bird stubs both declare a live capacity of
// ADMISSION_EARLY_BIRD_POOL_CAPACITY with no releasedQuantity narrowing — consistent with
// A33, the expected pool total is computed through the SAME effectiveCapacity() call the
// real loader (and checkout) uses, never a bare constant comparison that could pass by
// coincidence if the loader's own computation ever drifted.
const EXPECTED_POOL_TOTAL = effectiveCapacity(ADMISSION_EARLY_BIRD_POOL_CAPACITY, null);

const failures = [];

// Shared stub for day-cap-related getPoolRemaining calls (early-bird's own days[] block) —
// not under test here, so always returns a healthy, uncontroversial figure.
function dayCapFallbackRemaining(args) {
  return Math.floor((args?.capacity ?? 0) / 2);
}

function fetchTicketTypeStub(bySlug) {
  return async (slug) => bySlug[slug] ?? null;
}

async function runCase(label, { slug, fetchTicketType, poolRemaining, expectState, expectScarcityRemaining }) {
  const result = await loadTicketCardViewModel(slug, {
    fetchTicketType,
    getPoolRemaining: async (args) => {
      if (args.poolKeyBase === ADMISSION_EARLY_BIRD_POOL_KEY && args.requiresDaySelection === false) {
        return poolRemaining;
      }
      return dayCapFallbackRemaining(args);
    },
  });

  if (result === null) {
    failures.push(`${label}: loadTicketCardViewModel('${slug}') resolved to null — not the scenario under test (check this script's own stub first)`);
    return;
  }

  if (result.state !== expectState) {
    failures.push(`${label}: expected state '${expectState}', got '${result.state}'`);
  }
  if (result.state === 'soldOut') {
    failures.push(`${label}: state resolved to plain 'soldOut' — a shared early-bird-pool product must resolve 'earlyBirdSoldOut' on exhaustion, never 'soldOut'`);
  }
  if (result.scarcity === null) {
    failures.push(`${label}: scarcity is null — expected a populated ScarcityLine reporting the pool's own remaining/total even when state takes the early-bird branch`);
  } else {
    if (result.scarcity.remaining !== expectScarcityRemaining) {
      failures.push(`${label}: expected scarcity.remaining === ${expectScarcityRemaining}, got ${result.scarcity.remaining} — the displayed count must never be hidden/zeroed just because state resolution nulls its own internal input`);
    }
    if (result.scarcity.total !== EXPECTED_POOL_TOTAL) {
      failures.push(`${label}: expected scarcity.total === ${EXPECTED_POOL_TOTAL} (effectiveCapacity(${ADMISSION_EARLY_BIRD_POOL_CAPACITY}, null) — the same live-capacity computation A33 pins), got ${result.scarcity.total}`);
    }
  }
}

// STALE NOTE, corrected 2026-10-07 (team-lead, after A19/A33's fix landed): these stub
// capacities used to say "irrelevant" because the loader read the pool total from the
// static lib/provisional-figures.ts table (resolveSharedPoolCapacity), ignoring this
// field entirely. That static lookup is now REMOVED — the loader reads this live
// `capacity`/`releasedQuantity` via `effectiveCapacity()` (load-ticket-card.ts:306-318,
// the same function and the same live source checkout itself uses), so this field is now
// the actual, load-bearing source of the pool total. Set to
// ADMISSION_EARLY_BIRD_POOL_CAPACITY (the real figure, imported above) rather than an
// arbitrary distinct number, so this fixture stays consistent with A14's and A33's own
// fixtures instead of each check inventing its own stand-in value.
const fetchForEarlyBird = fetchTicketTypeStub({
  'early-bird': {
    price: 120,
    regularPrice: null,
    capacity: ADMISSION_EARLY_BIRD_POOL_CAPACITY,
    releasedQuantity: null,
    capacityPool: ADMISSION_EARLY_BIRD_POOL_KEY,
    requiresDaySelection: true,
    earlyBirdCutoff: null,
  },
  'day-visitor': {
    price: 150,
    regularPrice: null,
    capacity: 1000,
    releasedQuantity: null,
    capacityPool: null,
    requiresDaySelection: true,
    earlyBirdCutoff: null,
  },
});

const fetchForWeekendPassEarlyBird = fetchTicketTypeStub({
  'weekend-pass-early-bird': {
    price: 360,
    regularPrice: null,
    capacity: ADMISSION_EARLY_BIRD_POOL_CAPACITY, // see note above — no longer a stand-in, this IS the live source now
    releasedQuantity: null,
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

// --- Case 1: 'early-bird', shared pool exhausted (remaining 0) ---
await runCase("'early-bird', shared pool exhausted", {
  slug: 'early-bird',
  fetchTicketType: fetchForEarlyBird,
  poolRemaining: 0,
  expectState: 'earlyBirdSoldOut',
  expectScarcityRemaining: 0,
});

// --- Case 2: 'weekend-pass-early-bird', shared pool exhausted (remaining 0) ---
await runCase("'weekend-pass-early-bird', shared pool exhausted", {
  slug: 'weekend-pass-early-bird',
  fetchTicketType: fetchForWeekendPassEarlyBird,
  poolRemaining: 0,
  expectState: 'earlyBirdSoldOut',
  expectScarcityRemaining: 0,
});

// --- Case 3 (regression guard, per team-lead's extra ask): near-exhaustion (5% of pool,
// i.e. 25 of 500 — above zero, at/below the 10% low-stock threshold) must read 'low', not
// 'earlyBirdSoldOut' and not 'soldOut'. ---
await runCase("'weekend-pass-early-bird', near-exhaustion (25 of 500)", {
  slug: 'weekend-pass-early-bird',
  fetchTicketType: fetchForWeekendPassEarlyBird,
  poolRemaining: 25,
  expectState: 'low',
  expectScarcityRemaining: 25,
});

finish(
  'check-early-bird-pool-exhaustion-state.mjs',
  failures,
  "'early-bird'/'weekend-pass-early-bird' resolve 'earlyBirdSoldOut' (never plain 'soldOut') when the shared early-bird pool is exhausted, with scarcity still reporting the real remaining/total; near-exhaustion (above zero, at/below the low-stock threshold) resolves 'low' as the golden's own precedence rules require.",
);
