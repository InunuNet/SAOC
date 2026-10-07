// F6 (conference-workshop-tickets, M4) — A34 (added 2026-10-07, Codex round-4 finding;
// team-lead ratified the CODE as correct and the GOLDEN as stale — see
// f3-ui-render-states.golden.md Addendum 7). Codex flagged that
// lib/view-models/load-ticket-card.ts resolves the sibling's `regularPrice` through
// `resolveEffectivePrice()` rather than passing the sibling's raw live `price` straight
// through, which is what golden §2 (pre-Addendum-7 text) literally said. The code is
// right: A27 already requires every DISPLAYED price to go through `resolveEffectivePrice()`
// so the card never shows a figure checkout wouldn't actually charge — the sibling's
// `regularPrice` IS "what the regular ticket costs at checkout" (that sibling's own
// `price`/`regularPrice`/`earlyBirdCutoff`, same as any other displayed price), so the
// same rule applies to it with no special case.
//
// Concrete scenario (team-lead's own numbers): the sibling (`weekend-pass`) has its own
// cutoff expired, price 380, regularPrice 450. Checkout would charge 450 for a
// `weekend-pass` purchase today (past its own cutoff, reverted to its schema regularPrice)
// — so 450, not the raw 380, is the only honest figure for `weekend-pass-early-bird`'s own
// `regularPrice` to display. The OLD golden text's "raw live price straight through" would
// have required 380 here — the wrong, stale expectation this assertion replaces.
//
// Driven via loadTicketCardViewModel's existing DI seam (golden Addendum 2), using
// 'weekend-pass-early-bird' (sibling: 'weekend-pass'). Two cases: sibling cutoff expired
// with price !== regularPrice (must resolve to the effective/regularPrice figure, not the
// raw price); regression guard with no sibling cutoff (must resolve to the sibling's raw
// price, unchanged behaviour).
import { loadRepoModule, finish } from './_lib.mjs';

let loadTicketCardViewModel;
let ADMISSION_EARLY_BIRD_POOL_KEY;
let resolveEffectivePrice;
try {
  ({ loadTicketCardViewModel } = await loadRepoModule('lib/view-models/load-ticket-card.ts'));
  ({ ADMISSION_EARLY_BIRD_POOL_KEY } = await loadRepoModule('lib/provisional-figures.ts'));
  ({ resolveEffectivePrice } = await loadRepoModule('lib/checkout-reservation.ts'));
} catch (error) {
  finish('check-sibling-regular-price-uses-resolve-effective-price.mjs', [`could not import a repo module: ${error.message}`]);
  process.exit(1);
}

const failures = [];

function fetchTicketTypeStub(bySlug) {
  return async (slug) => bySlug[slug] ?? null;
}

async function runCase(label, { siblingPrice, siblingRegularPrice, siblingEarlyBirdCutoff, expectedRegularPrice }) {
  const fetchTicketType = fetchTicketTypeStub({
    'weekend-pass-early-bird': {
      price: 360,
      regularPrice: null,
      capacity: 500,
      releasedQuantity: null,
      capacityPool: ADMISSION_EARLY_BIRD_POOL_KEY,
      requiresDaySelection: false,
      earlyBirdCutoff: null,
    },
    'weekend-pass': {
      price: siblingPrice,
      regularPrice: siblingRegularPrice,
      capacity: 300,
      releasedQuantity: null,
      capacityPool: null,
      requiresDaySelection: false,
      earlyBirdCutoff: siblingEarlyBirdCutoff,
    },
  });

  const result = await loadTicketCardViewModel('weekend-pass-early-bird', {
    fetchTicketType,
    getPoolRemaining: async () => 250, // mid-pool, irrelevant to price — isolates this assertion
  });

  if (result === null) {
    failures.push(`${label}: loadTicketCardViewModel('weekend-pass-early-bird') resolved to null — not the scenario under test (check this script's own stub first)`);
    return;
  }

  if (result.regularPrice !== expectedRegularPrice) {
    failures.push(`${label}: expected regularPrice === ${expectedRegularPrice}, got ${JSON.stringify(result.regularPrice)}`);
  }
}

// --- Case 1 (the Codex scenario, team-lead's own numbers): sibling cutoff expired,
// price 380 !== regularPrice 450 -> must resolve to 450 (what checkout would charge the
// sibling today), never the raw 380. ---
{
  const siblingPrice = 380;
  const siblingRegularPrice = 450;
  const siblingEarlyBirdCutoff = '2020-01-01'; // far in the past — expired
  const expected = resolveEffectivePrice({
    price: siblingPrice,
    regularPrice: siblingRegularPrice,
    earlyBirdCutoff: siblingEarlyBirdCutoff,
    now: new Date(),
  });
  if (expected === siblingPrice) {
    failures.push('test setup error: expected resolveEffectivePrice to diverge from the raw sibling price in this scenario — the case cannot distinguish the fix from the old behaviour');
  } else {
    await runCase('sibling cutoff expired, price !== regularPrice', {
      siblingPrice,
      siblingRegularPrice,
      siblingEarlyBirdCutoff,
      expectedRegularPrice: expected,
    });
  }
}

// --- Case 2 (regression guard): sibling has no cutoff -> resolveEffectivePrice returns
// the raw price unconditionally, so regularPrice must equal the sibling's raw price —
// unchanged, ordinary behaviour, not a case this fix touches. ---
await runCase('sibling has no cutoff (regression guard)', {
  siblingPrice: 380,
  siblingRegularPrice: 450,
  siblingEarlyBirdCutoff: null,
  expectedRegularPrice: 380,
});

finish(
  'check-sibling-regular-price-uses-resolve-effective-price.mjs',
  failures,
  "weekend-pass-early-bird's/early-bird's regularPrice resolves through the SAME resolveEffectivePrice() call used for price itself, reading the sibling's own price/regularPrice/earlyBirdCutoff — never the sibling's raw price passed straight through once that sibling's own cutoff has closed.",
);
