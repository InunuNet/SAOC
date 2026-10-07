// F4 production-build fix (team-lead, 2026-10-07, commit 8f978bbb broke `pnpm build` /
// the beta rollout): `getPoolRemaining()` and its unqualified-pool helper used to live in
// lib/checkout-reservation.ts, which a CLIENT component reaches transitively —
// components/vendors/VendorStandPaymentForm.tsx -> lib/vendor-stand-pricing.ts ->
// lib/checkout-reservation.ts. Once checkout-reservation.ts started importing
// lib/data/tickets.ts (a real, non-type import of firebase-admin) for these two
// functions, that whole chain pulled firebase-admin into a client bundle — 47 Turbopack
// errors. SERVER-ONLY code that touches Firestore belongs in lib/data/ (see
// lib/data/tickets.ts's own header comment), never in lib/checkout-reservation.ts, which
// vendor-stand-pricing.ts (and therefore a client component) must stay able to import
// safely. This file is that server-only home for getPoolRemaining() alone — every OTHER
// export of checkout-reservation.ts (planPooledCapacity, resolveDayQualifiedPoolKey,
// etc.) is pure and stays exactly where it was; this move changes zero behaviour.
//
// No `server-only` package import: it is present only as a transitive dependency in this
// project's lockfile (not a direct dependency anything here already imports), and
// team-lead's brief is explicit — check first, don't add one. Living in lib/data/,
// alongside lib/data/tickets.ts, with a real firebase-admin import, is itself the thing
// that makes this module unreachable from a client bundle: Next.js's server/client
// boundary is enforced by what a module actually imports, not by this marker package.
//
// Relative imports with explicit `.ts` extensions, matching lib/checkout-reservation.ts's
// own documented convention: this project's contracts/checks/*.mjs scripts load files
// like this directly, some via a bare `tsx/esm/api` register() with no tsconfig option
// (no `@/` alias resolution) and some via Node's own native TypeScript support (which
// additionally needs the explicit extension on a relative specifier).
import {
  getSoldCountsByTicketType as getSoldCountsByTicketTypeReal,
  getSoldCountsByTicketTypeAndDay as getSoldCountsByTicketTypeAndDayReal,
} from './tickets.ts';
import { resolveDayQualifiedPoolKey } from '../checkout-reservation.ts';
import {
  ADMISSION_PRODUCTS,
  CONFERENCE_PRODUCTS,
  DAY_VISITOR_DAY_CAP_POOL_KEY,
  DAY_VISITOR_SHAPED_SLUGS,
  WORKSHOP_FIELD_TRIP_PRODUCTS,
} from '../provisional-figures.ts';

/**
 * Read-only, race-consistent remaining-count accessor for a scarcity display (golden §7).
 * Composes `resolveDayQualifiedPoolKey()` with the SAME two sold-count functions the
 * checkout transaction itself reads — never a third, independently-constructed query —
 * so the number a visitor sees can never diverge from the number the transaction
 * actually enforces. Called outside any transaction: a plain read, safe on every page
 * render.
 *
 * `deps` is an optional dependency-injection seam (same shape convention as
 * lib/confirmation-email.ts's SendConfirmationEmailDeps) so a fixture can inject stub
 * sold-count functions without a live Firestore read — no Firestore emulator exists on
 * this machine (see the golden's check-authoring addendum). Every real call site (F6's
 * loaders) omits `deps` entirely and gets the real, imported lib/data/tickets.ts
 * functions.
 */
export async function getPoolRemaining(
  args: {
    poolKeyBase: string;
    chosenDay?: string | null;
    requiresDaySelection: boolean;
    capacity: number;
    showId: string;
  },
  deps: {
    getSoldCountsByTicketTypeAndDay?: typeof getSoldCountsByTicketTypeAndDayReal;
    getSoldCountsByTicketType?: typeof getSoldCountsByTicketTypeReal;
  } = {}
): Promise<number> {
  // F4 round 3 (architect, 2026-10-07): day-visitor has NO unqualified pool at all
  // (golden §2) — its per-day cap is its ONLY ceiling. This combination names a pool
  // that does not exist, so it is a caller bug, not a zero-seats-left fact: fail loud
  // (coding.md "Fail fast") rather than silently surfacing a wrong aggregate-based
  // remaining count.
  if (args.poolKeyBase === DAY_VISITOR_DAY_CAP_POOL_KEY && args.requiresDaySelection === false) {
    throw new Error(
      "getPoolRemaining(): 'day-visitor' has no unqualified pool — call with requiresDaySelection: true and a chosenDay instead."
    );
  }

  // Fix (post-F4, Codex review): querying `new Set([args.poolKeyBase])` alone only
  // day-qualifies documents whose OWN ticketType is poolKeyBase (e.g. just
  // 'day-visitor') — an already-sold early-bird position for the same day would come
  // back under its own plain 'early-bird' key, never `day-visitor::<day>`, so it would
  // never be subtracted from this shared pool's remaining count. Every
  // DAY_VISITOR_SHAPED_SLUGS slug shares the one physical per-day pool (golden §2), so
  // every one of them must be day-qualified in the same query, matching the checkout
  // transaction's own dayCapPoolConfigByType construction in the route.
  const soldCountsByType = args.requiresDaySelection
    ? await (deps.getSoldCountsByTicketTypeAndDay ?? getSoldCountsByTicketTypeAndDayReal)(
        args.showId,
        new Set(DAY_VISITOR_SHAPED_SLUGS)
      )
    : await (deps.getSoldCountsByTicketType ?? getSoldCountsByTicketTypeReal)(args.showId);

  // Same reason as the query fix above: `getSoldCountsByTicketTypeAndDay()` returns one
  // key PER REAL TICKETTYPE SLUG (e.g. `day-visitor::2027-09-24` and
  // `early-bird::2027-09-24` as two separate entries), never pre-merged into a single
  // shared-pool key. `resolvedKey` alone would only ever read the slug matching
  // `args.poolKeyBase` — summing every DAY_VISITOR_SHAPED_SLUGS slug's day-qualified key
  // for this `chosenDay` is what actually reconstructs the shared pool's true sold
  // total. The unqualified branch needs no such sum: `getSoldCountsByTicketType()`
  // already returns one count per slug with no day-qualification to re-merge.
  //
  // Legacy carve-out (team-lead/QA, post-F4): `early-bird`'s `requiresDaySelection`
  // flipped false -> true in THIS mission's own M1 (commit cbac259c, 2026-10-07) — any
  // early-bird position reserved/paid before that deploy was written when the checkout
  // route never asked for a chosenDay at all, so it has no chosenDay field. Docs
  // §"Decision 2" (docs/f5-day-selection-attendees.md) already treats such a
  // pre-existing document as `chosenDay: null` for match purposes; the day cap must
  // treat it the same way rather than silently excluding it. `getSoldCountsByTicketTypeAndDay()`
  // keeps a day-qualified type's chosenDay-less document under its plain, unqualified
  // slug key (lib/data/tickets.ts's own doc comment) — since which day that seat was
  // actually for can never be recovered after the fact, it is counted conservatively
  // against EVERY day being checked, never dropped and never guessed onto just one day.
  const legacyNoChosenDayHeads = DAY_VISITOR_SHAPED_SLUGS.reduce(
    (total, slug) => total + (soldCountsByType[slug] ?? 0),
    0
  );
  const sold = args.requiresDaySelection
    ? DAY_VISITOR_SHAPED_SLUGS.reduce(
        (total, slug) =>
          total + (soldCountsByType[resolveDayQualifiedPoolKey(slug, args.chosenDay, true)] ?? 0),
        legacyNoChosenDayHeads
      )
    : sumUnqualifiedPoolSoldHeads(args.poolKeyBase, soldCountsByType);
  return Math.max(args.capacity - sold, 0);
}

/**
 * F4 round 4 (Codex, via gate A21; verified by team-lead, 2026-10-07): the UNQUALIFIED
 * branch above used to read `soldCountsByType[poolKeyBase]` directly — but
 * `getSoldCountsByTicketType()` keys its output by real ticketType SLUG
 * (lib/data/tickets.ts), never by pool key. For a shared pool like
 * `ADMISSION_EARLY_BIRD_POOL_KEY` ('admission-early-bird'), no document is EVER stored
 * with that literal as its `ticketType`, so the lookup was always 0 — the displayed "N
 * left" count never moved, and a pool sibling's sold units (e.g.
 * weekend-pass-early-bird's share of early-bird's pool) were never counted either way.
 *
 * Same membership/resolution semantics as `planPooledCapacity()`'s own
 * `resolvePoolKey`/`resolveWeight` (`poolConfigByType[ticketType]?.pool ?? ticketType`,
 * `?? 1`) and route.ts's live per-type construction — except sourced from
 * `lib/provisional-figures.ts`'s product arrays rather than a runtime `poolConfigByType`
 * map, since this read-only accessor takes no Sanity client and must not grow a third,
 * independently-constructed query. Reuses the SAME `[...ADMISSION_PRODUCTS,
 * ...CONFERENCE_PRODUCTS, ...WORKSHOP_FIELD_TRIP_PRODUCTS]` spread
 * scripts/seed-ticketing.ts and scripts/migrate-conference-workshop-tickets.ts already
 * use as the single source of every product's `capacityPool`/`headcountPerUnit` — no
 * second, hand-typed pool-membership list.
 */
function sumUnqualifiedPoolSoldHeads(
  poolKeyBase: string,
  soldCountsByType: Record<string, number>
): number {
  const allProducts = [...ADMISSION_PRODUCTS, ...CONFERENCE_PRODUCTS, ...WORKSHOP_FIELD_TRIP_PRODUCTS];
  let total = 0;
  for (const product of allProducts) {
    const resolvedPool = product.capacityPool ?? product.slug;
    if (resolvedPool !== poolKeyBase) continue;
    const weight = product.headcountPerUnit ?? 1;
    total += (soldCountsByType[product.slug] ?? 0) * weight;
  }
  return total;
}
