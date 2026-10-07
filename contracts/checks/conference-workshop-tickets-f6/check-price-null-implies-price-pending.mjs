// F6 (conference-workshop-tickets, M4) — A31 (added 2026-10-07, Codex round-2 finding,
// verified by team-lead against lib/view-models/load-ticket-card.ts): when
// resolveEffectivePrice() itself resolves to null (an earlyBirdCutoff that has passed,
// with no regularPrice fallback to revert to), loadTicketCardViewModel() must return
// `price: null` AND `state: 'pricePending'` — never `price: null` paired with any other
// state. This is ticket-card.ts's own documented invariant (TicketCardViewModel.price:
// "null only when state === 'pricePending'", line 38), not a new rule this assertion
// invents.
//
// The historical bug: `priceUsable` (whether the RAW ticketType.price field was a
// well-typed number) and "does this card actually have a resolved price" are two
// different questions — resolveEffectivePrice() can still return null off a perfectly
// usable raw price once past its cutoff with no fallback. Gating resolveTicketCardState's
// `priceUsable` input on the raw field instead of the resolved `price !== null` lets a
// card show `price: null` with a non-pricePending state (e.g. 'available'), breaking the
// golden's own invariant above.
//
// Driven via loadTicketCardViewModel's existing DI seam (golden Addendum 2), using the
// 'vip' slug — no sibling relation (REGULAR_PRICE_SIBLING_SLUG), no day-selection, no
// shared pool — so this test isolates the price/state interaction with no other
// precedence rule able to interfere.
import { loadRepoModule, finish } from './_lib.mjs';

let loadTicketCardViewModel;
try {
  ({ loadTicketCardViewModel } = await loadRepoModule('lib/view-models/load-ticket-card.ts'));
} catch (error) {
  finish('check-price-null-implies-price-pending.mjs', [`could not import lib/view-models/load-ticket-card.ts: ${error.message}`]);
  process.exit(1);
}

const failures = [];

function baseVipTicketType(overrides) {
  return {
    price: 300,
    regularPrice: null,
    capacity: 200,
    releasedQuantity: null,
    capacityPool: null,
    requiresDaySelection: false,
    earlyBirdCutoff: null,
    ...overrides,
  };
}

async function runCase(label, { ticketType, expectPriceNull, expectState }) {
  const result = await loadTicketCardViewModel('vip', {
    fetchTicketType: async () => ticketType,
    getPoolRemaining: async () => 200, // full stock — isolates the price/state interaction
    // computeEarlyBirdRemaining intentionally NOT overridden: 'vip' has no shared pool, so
    // it is never called in this scenario; leaving the real implementation wired is the
    // more faithful test.
  });

  if (result === null) {
    failures.push(`${label}: loadTicketCardViewModel('vip') resolved to null — not the scenario under test (check this script's own stub first)`);
    return;
  }

  const priceIsNull = result.price === null;
  if (priceIsNull !== expectPriceNull) {
    failures.push(`${label}: expected price ${expectPriceNull ? '=== null' : '!== null'}, got ${JSON.stringify(result.price)}`);
  }
  if (result.state !== expectState) {
    failures.push(`${label}: expected state '${expectState}', got '${result.state}'`);
  }
  // The golden's own invariant (ticket-card.ts:38), checked directly regardless of which
  // specific case this is: price === null must imply state === 'pricePending', and vice
  // versa for any state OTHER than 'pricePending' pairing with a non-null price so this
  // guard also catches a regression introduced from either direction.
  if (priceIsNull && result.state !== 'pricePending') {
    failures.push(`${label}: price resolved to null but state is '${result.state}', not 'pricePending' — violates ticket-card.ts's own documented invariant`);
  }
  if (!priceIsNull && result.state === 'pricePending') {
    failures.push(`${label}: state is 'pricePending' but price resolved to ${JSON.stringify(result.price)}, not null`);
  }
}

// --- Bug case: cutoff passed, no regularPrice fallback -> resolveEffectivePrice() is null ---
await runCase('cutoff passed, no regularPrice fallback', {
  ticketType: baseVipTicketType({ earlyBirdCutoff: '2020-01-01' }), // far in the past
  expectPriceNull: true,
  expectState: 'pricePending',
});

// --- Regression guard: no cutoff at all -> price resolves to the raw price, not pending ---
await runCase('no cutoff (regression guard)', {
  ticketType: baseVipTicketType({ earlyBirdCutoff: null }),
  expectPriceNull: false,
  expectState: 'available', // full stock (200/200), well above the low-stock threshold
});

finish(
  'check-price-null-implies-price-pending.mjs',
  failures,
  "loadTicketCardViewModel() resolves price: null if and only if state === 'pricePending' — resolveEffectivePrice()'s own null result (past cutoff, no regularPrice fallback) is gated on, not the raw ticketType.price field's mere type-validity.",
);
