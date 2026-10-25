# ticket-onsale-predicate: design (the implementation spec for @dev)

## Defects
1. Demo / QA-fixture ticket types are hidden from listings only. `/tickets/<slug>` renders them and
   `POST /api/tickets/checkout` never checks `demo`. The checkout `ticketTypeBySlugQuery` does not
   even SELECT `demo` or `active`, so the route cannot see either today.
2. The Event JSON-LD on `/national-show` iterates every active `admission` SKU: it lists early-bird
   and regular siblings together while the hub shows one, omits Sunset Cocktails (category
   `workshop-field-trip`) and the conference products, and ignores sold-out state.

Out of scope, recorded as an open business question only: whether regular SKUs (`day-visitor`,
`weekend-pass`) should be gated until the early-bird pool sells out. Do not change that behaviour.

## QA-flag decision (E2E must keep working)
No existing non-production QA flag exists in the code (grep of lib/, app/, e2e/, contracts/checks:
only `isTicketingTestMode()`, a constant, and the `demo` marker). Chosen rule, no new env var:

    qaFixturesAllowed(env, paymentsLive) = paymentsLive === false && env.NODE_ENV !== 'production'

* Production builds (`next start`, App Hosting beta and prod) always refuse demo products.
* Payments live (`TICKETING_PAYMENTS_LIVE` flipped) refuses them everywhere.
* `next dev` / `playwright` (`webServer` runs `next dev`) / `contracts/checks/ticketing-hardening/*`
  against localhost keep the fixture. Those checks that are pointed at a DEPLOYED host with
  `CHECK_BASE_URL` can no longer buy `qa-fixture-ticket` there; that is the point of the fix.
* Why not an env opt-in: a variable can be set by mistake in `apphosting.yaml`; NODE_ENV on a
  production build cannot be unset by a config typo, and the fallback the brief named was exactly
  this. `isTicketingTestMode()` is NOT consulted at call sites: pass `!isTicketingTestMode()` as
  `paymentsLive`, so the single off switch stays in lib/ticketing-test-mode.ts, unchanged.

## New module `lib/ticket-on-sale.ts` (pure, no I/O, no firebase-admin, no Date.now)
```
type NotOnSaleReason = 'demo'|'inactive'|'sales-closed'|'wrong-show'|'no-price'|'no-capacity'|'sold-out'
interface OnSaleDoc { slug?; demo?; active?; price: unknown; regularPrice?: unknown; earlyBirdCutoff?: unknown;
                      capacity: unknown; releasedQuantity?: unknown; show?: {_ref:string}|null }
interface OnSaleInput { doc: OnSaleDoc; activeShowId: string|null; salesOpen: boolean; soldOut: boolean;
                        now: Date; qaFixturesAllowed: boolean }
isTicketOnSale(input): { onSale: true; reason: null } | { onSale: false; reason: NotOnSaleReason }
qaFixturesAllowed(env: { NODE_ENV?: string }, paymentsLive: boolean): boolean
```
* Reason precedence (first failure wins): demo, inactive, sales-closed, wrong-show, no-price,
  no-capacity, sold-out. `qaFixturesAllowed` waives ONLY the demo reason.
* demo = `isDemoTicketTypeDoc(doc)` from lib/demo-ticket-type.ts (flag OR reserved slug).
* inactive = `doc.active !== true` (fail closed: absent or null is inactive).
* wrong-show = `!ticketTypeMatchesActiveShow` semantics (activeShowId null, or doc.show?._ref differs).
  Reuse the existing function by moving it into lib/ticket-on-sale.ts and re-exporting from route.ts if
  other importers need it (grep first); never duplicate the rule.
* no-price = price not a finite number >= 0, or `resolveEffectivePrice` is null.
* no-capacity = capacity not a non-negative integer, or `effectiveCapacity` <= 0.
* sold-out = the caller-supplied `soldOut` verdict (pooled, from `planPooledCapacity`; the predicate
  stays pure and never reads Firestore).
* R0 non-demo products keep today's behaviour (sellable).

## Call sites
1. `sanity/queries.ts`: add `demo,` and `active,` to `ticketTypeBySlugQuery` (additive). The offline
   harness projects fields exactly like GROQ, so a forgotten field fails A3/A4.
2. Checkout route: right after the per-slug fetch and the `!ticketTypeDoc` guard, before any other
   field validation, if the predicate reason is `demo` return the SAME response a nonexistent slug
   gets: `NextResponse.json({ error: 'Unknown ticketType: <slug>' }, { status: 400 })`. Same shape,
   so a refusal does not confirm a fixture exists. All other reasons keep their existing responses
   (500 unusable show/price, 403 sales closed, 409 early-bird closed, 409 sold-out in the
   transaction): do not renumber them. Call the predicate with `soldOut: false` for the static
   reasons only; the transactional sold-out path is unchanged.
3. `/tickets/[slug]/page.tsx`: after the `!ticketType` notFound, `notFound()` when the doc is demo and
   `!qaFixturesAllowed(process.env, !isTicketingTestMode())`. Public context == a production build,
   which includes the beta wall: the fixture is not for visitors or reviewers on any deployed host.
   Compute `purchasable` through the predicate (`salesOpen && !soldOut` becomes `onSale`).
4. Hub + JSON-LD share ONE pure pipeline:
   * `lib/data/ticket-hub-source.ts` (firebase-free): move `toTypeInput`, `TICKET_CATEGORIES`, the
     demo filter and the `buildTicketCardViewModels` call out of `loadTicketCardViewModels` into
     `buildHubCards({ cmsTypes, activeShowId, salesOpen, soldByType, soldByDay, stockKnown, now, showDays })`
     returning `TicketCardsOutput`. Demo types are dropped always (the hub never lists a fixture,
     even in dev). `loadTicketCardViewModels` keeps its I/O and calls `buildHubCards`.
   * `lib/ticket-offers.ts`: `buildTicketOffers(cards): { slug, name, price, availability: 'InStock'|'SoldOut' }[]`,
     one per card backed by a real ticket type (skip the synthetic `workshops` card), none for cards in
     state `salesClosed` or `pricePending`; `SoldOut` iff card.state === 'soldOut'.
   * `/national-show/page.tsx`: fetch the three hub categories (admission, conference,
     workshop-field-trip) with the existing query, call `buildHubCards({ stockKnown: true, soldByType: {} , salesOpen, ... })`,
     map `buildTicketOffers` into `NationalShowOffer`, delete `buildAdmissionOffers`.

## Known limit, decided here (flag to the lead)
`/national-show` is ISR (`revalidate = 60`) and `contracts/contract-build-without-secrets.yaml`
A3/A7 forbid a prerendered page reaching firebase-admin. So the page cannot read the live Firestore
sold ledger. Its offers therefore reflect Sanity-only stock (a released quantity of 0 reads SoldOut)
and a pool sold out in Firestore only reads SoldOut once the hub does, on `/national-show/tickets`
(force-dynamic). The LOGIC supports pooled sold-out (A5 proves it with a supplied ledger); the page
just has no ledger to supply. Closing that gap needs either a request-time page (breaks the
build-without-secrets contract) or a periodically written availability snapshot (new infrastructure).
Neither is done here. A7 pins that the page stays firebase-free.

## Not changed
`TICKETING_PAYMENTS_LIVE`, any env, `SITE_PUBLIC_LAUNCH`, Ozow/PayFast code, pricing, capacity maths,
the early-bird sibling behaviour, Firestore document builders (no new writes, so the
undefined-write rule is untouched).
