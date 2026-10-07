// F6 (conference-workshop-tickets, M4) — A27 (added 2026-10-07, QA FAIL fix list item 2,
// relayed by team-lead): the card's displayed price must come from
// lib/checkout-reservation.ts's resolveEffectivePrice() — "the sole source of
// price-selection logic for a ticket type carrying an early-bird cutoff" (that file's own
// doc comment) — the SAME function app/api/tickets/checkout/route.ts calls before
// charging, never a raw, unconditional read of ticketType.price (QA's report finding 2).
//
// Deliberately tested against 'day-visitor', NOT 'early-bird'/'weekend-pass-early-bird':
// those two have a sibling relation (REGULAR_PRICE_SIBLING_SLUG) whose exact precedence
// against this ticketType's own schema `regularPrice` field was still being actively
// revised in load-ticket-card.ts while this check was written (observed three different
// wirings across three reads of the same file in one sitting) — pinning a number tied to
// that still-moving internal choice would make this assertion fragile to a legitimate
// future refactor. 'day-visitor' has NO sibling entry in REGULAR_PRICE_SIBLING_SLUG, so
// for it the formula unambiguously reduces to resolveEffectivePrice() reading ONLY this
// ticketType's own price/regularPrice/earlyBirdCutoff — the stable, non-ambiguous half of
// the wiring regardless of how the sibling-priority special case for the other two
// products is ultimately decided. If that stays true, this is the right slug to pin the
// general "resolveEffectivePrice, not raw price" requirement against.
//
// `regularPrice` here is given as an explicit value (never an omitted/`undefined` key) to
// match what Sanity's GROQ projection actually returns for a document that leaves the
// field unset (sanity/queries.ts always projects `regularPrice`) — an omitted key produces
// `undefined` at runtime, not `null`, which is not a shape this loader will ever actually
// see from a real fetch.
//
// Proven via a fixture where 'day-visitor' carries its own `regularPrice: 100` and an
// earlyBirdCutoff far enough in the past (2020-01-01) that isWithinEarlyBirdWindow() is
// false under any real wall-clock time this test could ever run at — resolveEffectivePrice
// must then return that regularPrice (100), never the raw price (150). A second,
// contrasting case (earlyBirdCutoff: null) proves the fix didn't regress the no-cutoff
// path, which must still show the raw price unconditionally.
import { loadRepoModule, finish } from './_lib.mjs';

let loadTicketCardViewModel;
try {
  ({ loadTicketCardViewModel } = await loadRepoModule('lib/view-models/load-ticket-card.ts'));
} catch (error) {
  finish('check-price-uses-resolve-effective-price.mjs', [`could not import lib/view-models/load-ticket-card.ts: ${error.message}`]);
  process.exit(1);
}

const failures = [];
const DAY_VISITOR_RAW_PRICE = 150;
const DAY_VISITOR_OWN_REGULAR_PRICE = 100; // day-visitor's OWN post-cutoff schema price

function depsWithCutoff(earlyBirdCutoff) {
  return {
    fetchTicketType: async () => ({
      price: DAY_VISITOR_RAW_PRICE,
      regularPrice: DAY_VISITOR_OWN_REGULAR_PRICE,
      capacity: 1000,
      releasedQuantity: null,
      capacityPool: null,
      requiresDaySelection: true,
      earlyBirdCutoff,
    }),
    getPoolRemaining: async (args) => Math.floor((args?.capacity ?? 0) / 2),
    computeEarlyBirdRemaining: (remaining) => remaining,
  };
}

// --- cutoff far in the past: price must equal resolveEffectivePrice's post-cutoff result
// (day-visitor's own regularPrice, 100), never the raw ticketType.price (150) ---
{
  const result = await loadTicketCardViewModel('day-visitor', depsWithCutoff('2020-01-01')).catch((error) => {
    failures.push(`loadTicketCardViewModel('day-visitor', <earlyBirdCutoff: past>) threw ${error.message}`);
    return null;
  });
  if (result) {
    if (result.price !== DAY_VISITOR_OWN_REGULAR_PRICE) {
      failures.push(`'day-visitor' with a past earlyBirdCutoff: price is ${JSON.stringify(result.price)}, expected resolveEffectivePrice's result (${DAY_VISITOR_OWN_REGULAR_PRICE}, this ticketType's own regularPrice) — got the raw ticketType.price instead, meaning the card bypasses resolveEffectivePrice exactly as QA flagged`);
    }
  }
}

// --- no cutoff at all: price must stay the raw price (regression guard, not a new requirement) ---
{
  const result = await loadTicketCardViewModel('day-visitor', depsWithCutoff(null)).catch((error) => {
    failures.push(`loadTicketCardViewModel('day-visitor', <earlyBirdCutoff: null>) threw ${error.message}`);
    return null;
  });
  if (result) {
    if (result.price !== DAY_VISITOR_RAW_PRICE) {
      failures.push(`'day-visitor' with no earlyBirdCutoff: price is ${JSON.stringify(result.price)}, expected the raw price ${DAY_VISITOR_RAW_PRICE} unconditionally (resolveEffectivePrice returns input.price when earlyBirdCutoff is null) — the fix must not regress the no-cutoff case`);
    }
  }
}

finish(
  'check-price-uses-resolve-effective-price.mjs',
  failures,
  "'day-visitor's price resolves through resolveEffectivePrice() — its own regularPrice schema field once a past cutoff closes pricing, the raw price when there is no cutoff.",
);
