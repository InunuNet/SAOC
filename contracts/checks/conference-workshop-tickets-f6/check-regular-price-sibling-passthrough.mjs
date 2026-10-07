// F6 (conference-workshop-tickets, M4) — A22 (added 2026-10-07, design peer request,
// relayed by team-lead): `regularPrice` is non-null ONLY for weekend-pass-early-bird
// (sourced from weekend-pass's own resolved price) and early-bird (sourced from
// day-visitor's own resolved price), null for every other in-scope product, and in both
// non-null cases is sourced from the sibling ticketType — never a second,
// independently-typed literal that could silently drift from it.
//
// NARROWED 2026-10-07 (Codex round-4 finding; see A34 and golden Addendum 7): none of
// this script's fixtures give the sibling an earlyBirdCutoff, so resolveEffectivePrice()
// resolves to the sibling's raw price in every case driven here — this proves the figure
// comes FROM the sibling (not a second, hand-typed literal) but does not by itself
// distinguish resolveEffectivePrice()-resolution from a raw passthrough, since the two
// coincide whenever there's no cutoff. A34 is the complementary assertion that pins the
// resolution path itself, using a sibling with an EXPIRED cutoff where raw price and
// resolveEffectivePrice()'s result diverge.
//
// Driven via loadTicketCardViewModel's DI seam (golden Addendum 2): `deps.fetchTicketType`
// is stubbed to return a DIFFERENT price depending on WHICH slug it's called with — the
// product's own slug vs. its sibling's slug. If the loader re-typed a hardcoded number
// instead of reading the sibling's live price through the same injected function, this
// fixture's deliberately distinctive sibling price would never show up in `regularPrice`,
// and this check would catch that.
import { loadRepoModule, finish } from './_lib.mjs';

let loadTicketCardViewModel;
try {
  ({ loadTicketCardViewModel } = await loadRepoModule('lib/view-models/load-ticket-card.ts'));
} catch (error) {
  finish('check-regular-price-sibling-passthrough.mjs', [`could not import lib/view-models/load-ticket-card.ts: ${error.message}`]);
  process.exit(1);
}

const failures = [];

// A distinctive, easy-to-spot-if-missing live price per slug — never matching the
// requesting product's own price, so a passthrough bug can't accidentally coincide.
const LIVE_PRICE_BY_SLUG = {
  'weekend-pass-early-bird': 350,
  'weekend-pass': 380, // weekend-pass-early-bird's sibling's LIVE price
  'early-bird': 130,
  'day-visitor': 150, // early-bird's sibling's LIVE price
  vip: 500,
  'saoc-symposium': 2000,
  'wosa-conference': 2000,
};

function fixtureTicketTypeFor(slug) {
  const requiresDaySelection = slug === 'day-visitor' || slug === 'early-bird';
  const capacityPool = slug === 'early-bird' ? 'admission-early-bird' : null;
  return {
    price: LIVE_PRICE_BY_SLUG[slug],
    capacity: requiresDaySelection ? 1000 : 200,
    capacityPool,
    requiresDaySelection,
    earlyBirdCutoff: null,
  };
}

function depsFor() {
  return {
    fetchTicketType: async (slug) => {
      if (!(slug in LIVE_PRICE_BY_SLUG)) {
        throw new Error(`stub fetchTicketType called with an unrecognised slug: ${JSON.stringify(slug)}`);
      }
      return fixtureTicketTypeFor(slug);
    },
    getPoolRemaining: async () => 100,
    computeEarlyBirdRemaining: (remaining) => remaining,
  };
}

const CASES = [
  { slug: 'weekend-pass-early-bird', expectedRegularPrice: LIVE_PRICE_BY_SLUG['weekend-pass'] },
  { slug: 'early-bird', expectedRegularPrice: LIVE_PRICE_BY_SLUG['day-visitor'] },
  { slug: 'weekend-pass', expectedRegularPrice: null },
  { slug: 'day-visitor', expectedRegularPrice: null },
  { slug: 'vip', expectedRegularPrice: null },
  { slug: 'saoc-symposium', expectedRegularPrice: null },
];

for (const { slug, expectedRegularPrice } of CASES) {
  let result;
  try {
    result = await loadTicketCardViewModel(slug, depsFor());
  } catch (error) {
    failures.push(`loadTicketCardViewModel('${slug}', <fixture deps>) threw ${error.message}`);
    continue;
  }

  if (expectedRegularPrice === null) {
    if (result.regularPrice !== null && result.regularPrice !== undefined) {
      failures.push(`'${slug}': regularPrice is ${JSON.stringify(result.regularPrice)}, expected null (no sibling relation)`);
    }
  } else if (result.regularPrice !== expectedRegularPrice) {
    failures.push(
      `'${slug}': regularPrice is ${JSON.stringify(result.regularPrice)}, expected ${expectedRegularPrice} ` +
        '(sourced from the sibling ticketType — not a second, independently-typed literal; ' +
        'see A34 for the cutoff-expired resolveEffectivePrice() divergence case)',
    );
  }
}

finish(
  'check-regular-price-sibling-passthrough.mjs',
  failures,
  'regularPrice is non-null only for the two early-bird SKUs, sourced live from the sibling ticketType, and null for every other in-scope product.',
);
