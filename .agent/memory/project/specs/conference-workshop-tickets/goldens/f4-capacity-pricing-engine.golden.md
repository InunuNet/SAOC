# F4 Golden — Race-Safe Capacity + Pricing Engine Decision Record

Mission `conference-workshop-tickets`, feature F4 (milestone M2). This is the "payment and
ticket engineering" core per Brad's re-scope (2026-10-07, relayed by team-lead): the NOS
design peer (`saoc-nos-design-f1`) owns visuals; this feature owns correctness under
concurrency, for real money, for the new/changed products F1-F3 define.

## 1. Shared 500-ticket early-bird pool — reuse, not reinvention

`weekend-pass-early-bird` and `early-bird` (day-visitor's EB) both declare
`capacityPool: 'admission-early-bird'` (F2). `app/api/tickets/checkout/route.ts`'s
existing `poolConfigByType`/`capacityByType` construction (route.ts:505-639) already reads
`capacityPool`/`headcountPerUnit` generically from every distinct ticketType's own Sanity
document — confirmed by code reading, not hardcoded to Sunset Cocktails. `planPooledCapacity()`
(`lib/checkout-reservation.ts:440`) already enforces a combined ceiling race-safely, inside
the SAME Firestore transaction that commits the reservation, the same way it already
enforces the Sunset Cocktails pool in production today. **Zero code change needed here** —
this feature's job is to prove it with a concurrency test, not to build a new mechanism.

## 2. True per-day capacity for Day Visitor — the one genuinely new mechanism

Before this feature, `capacity: 1000` on `day-visitor`/`early-bird` was enforced as a
SINGLE AGGREGATE ceiling across all sellable days (a pre-existing, long-flagged gap). Brad's
re-scope requires TRUE per-day caps: 1000 for Friday, 1000 for Saturday, 1000 for Sunday,
independently.

**Design: day-qualified pool keys, `planPooledCapacity()` itself UNCHANGED.** At the
route.ts call site, for any ticketType with `requiresDaySelection: true`, the pool key fed
into `planPooledCapacity()`'s `poolConfigByType`/`capacityByType`/`requestedQtyByType`/
`soldCountsByType` becomes `` `${capacityPool ?? slug}::${chosenDay}` `` instead of
`capacityPool ?? slug` alone — computed by one new, small pure helper,
`resolveDayQualifiedPoolKey(poolKeyBase, chosenDay, requiresDaySelection)`, returning the
qualified key when `requiresDaySelection` is true and `poolKeyBase` unchanged otherwise.
This makes Friday/Saturday/Sunday independent counters with NO change to the pure capacity
engine itself — only to what keys route.ts shapes before calling it.

**Day-visitor needs TWO independent, simultaneous checks, not one:**

1. The day-qualified check above (1000 per chosen day) — applies to BOTH `day-visitor`
   and `early-bird` (its EB sibling), since both are day-visitor-shaped tickets.
2. The UNQUALIFIED shared-500-pool check from §1 above — applies ONLY to `early-bird`
   (never to `day-visitor`, which has no pool), and is NOT day-qualified (all three days
   draw from the SAME 500, matching Brad's "3 day booking and 1 day book[ing] all count to
   500").

Both checks run inside the SAME reservation transaction; the reservation is accepted only
if BOTH pass, rejected (over-capacity) if either fails. This is two sequential calls to
the same unmodified `planPooledCapacity()` with two different key-shapes — not a new
capacity engine, and not a merge of the two dimensions into one pool (that would let a
single day's sellout wrongly block the shared pool, or vice versa).

**The missing piece this design depends on: a day-qualified sold-count source.**
`planPooledCapacity()` is pure (`lib/checkout-reservation.ts:440`) — it takes
`soldCountsByType` as a plain, already-fetched `Record<string, number>`. Today's only
sold-count fetcher, `getSoldCountsByTicketType()` (`lib/data/tickets.ts:44`), aggregates
EVERY ticket document purely by its `ticketType` slug — it has no notion of `chosenDay` at
all, so it cannot by itself produce the `` `${poolKeyBase}::${chosenDay}` `` -keyed counts
the day-qualified check needs. This feature adds one new function, in the same file, next
to the existing one:

```typescript
export async function getSoldCountsByTicketTypeAndDay(
  showId: string,
  dayQualifiedTypes: Set<string>,
  transaction?: Transaction,
): Promise<Record<string, number>>
```

Reuses the EXACT SAME Firestore query shape (`tickets` collection,
`showId`/`status in [reserved, paid]`, same `stillHoldsSeat()` filter) as
`getSoldCountsByTicketType()` — not a second, differently-constructed query — and, for
each matching ticket document whose `ticketType` is in `dayQualifiedTypes`, keys its count
by `` `${ticketType}::${data.chosenDay}` `` (reading the `chosenDay` field F5
`day-selection-attendees` already writes onto every day-visitor-shaped position) instead
of by `ticketType` alone; every other ticket document is still keyed by plain `ticketType`,
so the two functions' outputs can be merged into one `soldCountsByType` map with
`Object.assign()` (or returned pre-merged by the route) with no key collision. The route's
day-qualified `planPooledCapacity()` call passes this merged map; the unqualified shared-
pool call (§1 above, and the unqualified half of early-bird's two-check requirement) keeps
using the EXISTING `getSoldCountsByTicketType()` output unmodified — the two sold-count
sources are not interchangeable, and a day-qualified count must never be substituted into
the unqualified check or vice versa.

**Unqualified-check product list, explicit (Codex found a live regression here,
2026-10-07, verified by team-lead against source):** route.ts's unqualified
`planPooledCapacity()` call's `requestedQtyByType`/`capacityByType`/`poolConfigByType`
must contain ONLY early-bird (pool `admission-early-bird`, §1) plus §3's existing
singleton/pooled products (VIP, the Cocktails pair, Symposium, WOSA, each workshop).
**`day-visitor`'s own slug must never appear in the unqualified call's
`requestedQtyByType` at all** — not with its `capacity: 1000` read as a whole-show cap,
not with any other ceiling. It has no unqualified pool, full stop; the per-day-qualified
check above is its ONLY ceiling. The live bug this closes: route.ts's per-slug
construction (route.ts:605-612) built `poolConfigByType`/`capacityByType` for EVERY
distinct cart ticketType unconditionally, including day-visitor (`pool: null`,
`capacityByType['day-visitor'] = 1000`), fed from `getSoldCountsByTicketType()` — an
AGGREGATE count across all days. After 1000 day-visitor sales spread across Friday,
Saturday and Sunday (e.g. 400+400+300, each day well under its own 1000 cap), every
further sale on any day was wrongly refused by this aggregate, on top of the per-day
check that already governs it correctly. Symmetrically, `getPoolRemaining()`'s
unqualified branch (§7) must never be invoked with `poolKeyBase: 'day-visitor'` and
`requiresDaySelection: false` — that combination names a pool that does not exist, and
must fail loud (throw), not silently compute a wrong aggregate-based remaining count for
display. See `check-day-visitor-excluded-from-unqualified-check.mjs` (A24) and
`check-get-pool-remaining-rejects-unqualified-day-visitor.mjs` (A25).

**Open question, NOT assumed:** does a Weekend Pass holder count against the Day Visitor
per-day 1000 cap on each of the three days they attend? Team-lead's new needs-Brad item.
**Default shipped by this feature: NO** — Weekend Pass does not draw against
`day-visitor`'s per-day pool (they are separate ticket types with their own, separately-
stated historical capacity: 300 for the weekend pass overall vs. 1000/day for day
visitors). The day-qualified-key design is additive: adding Weekend Pass into the day cap
later means giving it the same day-qualified pool key, not restructuring the mechanism.

## 3. Per-product caps — VIP 200, Cocktails 200 (shared pool, unchanged), Symposium 80,
WOSA 80, each workshop session 10

All five already work via the EXISTING single-dimension capacity/pool mechanism (`capacity`
field, `capacityPool: null` for singletons or `'sunset-cocktails'` for the Cocktails pair) —
zero new mechanism. This feature's job is an assertion proving each one still resolves
correctly post-F1/F2/F3's data changes, not new code.

## 4. Effective price resolved at reservation time, inside the transaction — simple reading,
no invented fallback

**What this feature does NOT invent:** an automatic fallback from `weekend-pass-early-bird`/
`early-bird` to their regular siblings when the pool is exhausted. No message from Brad or
the team-lead asks for that UX, and inventing it would be a real, consequential product
decision this feature has no authority to make silently. A buyer who requests a specific
sold-out SKU gets an ordinary over-capacity rejection, like any other sold-out product
today.

**What this feature DOES fix:** every one of the new/changed admission products (`vip`,
`weekend-pass`, `weekend-pass-early-bird`, `day-visitor`, `early-bird`) no longer has a
per-slug date-tier (no `regularPrice`/`earlyBirdCutoff` pair on any one slug post-F2) — so
`resolveEffectivePrice()`'s date-based branch is now a pass-through (`regularPrice`/
`earlyBirdCutoff` both null → `effectivePrice === price`, always) for all five. The
property this feature proves: the price CHARGED for a successful reservation is read from
the same Sanity-fetched `price` field that gated entry to the transaction, and is NEVER
computed from a time-sensitive condition evaluated outside the transaction's live reads —
so there is no window in which the capacity check and the charged price could observe
different realities. Proven by an assertion inspecting that `amountByType[slug]` assignment
happens from the already-validated, already-fetched `price` field only (no second,
independent price computation exists for these five slugs).

## 5. Concurrency assertion — mandatory, not advisory

N parallel reservation attempts against a pool with exactly K places remaining must yield
exactly K successes and N-K over-capacity rejections, with the pool's final sold+reserved
count landing at exactly its ceiling, never above it. Exercised against:

- The shared `admission-early-bird` 500-pool (mixing `weekend-pass-early-bird` and
  `early-bird` requests in the same concurrent burst — proving the SHARED, cross-product
  nature of the pool, not just a single slug's own capacity).
- A single day-qualified `day-visitor` pool (e.g. Friday's 1000), proving the per-day
  mechanism independently of the early-bird pool.

Implemented against the Firebase emulator (the project's existing test infrastructure for
`checkout-reservation.ts`/`planPooledCapacity()`) or an equivalent transaction-faithful
harness — never a plain in-memory mock of the transaction itself, since the property being
proven is specifically about Firestore's real transaction/contention behavior.

## 6. PayFast sandbox end-to-end + confirmation email

At least one full purchase of a NEW/changed product (`early-bird`, the day-visitor EB
slug) is exercised against the existing PayFast SANDBOX (`lib/payfast.ts`, unchanged) from
checkout request through the ITN webhook to a confirmed `tickets` Firestore document, and
the existing confirmation-email path (`lib/email.ts` via Resend) is proven to actually
send for this purchase — reusing both paths exactly as they exist today, no new payment or
email code.

## 7. Read-only remaining-count accessor for display — reused by F6, not duplicated

Team-lead's correction (2026-10-07, third pass): the live "N left" counters on the
scarcity displays are **this mission's engineering, not a "needs Brad" open question** —
Brad has confirmed he wants them, and the NOS design peer is designing the cards that
show them. This feature exports the one accessor F6's loaders call; F6 does not grow a
second, independent counting mechanism.

**Relocated 2026-10-07 (build-break fix — see the addendum after §7's Addendum below):
this function moved out of `lib/checkout-reservation.ts` into its own server-only
module** — `lib/checkout-reservation.ts` is client-reachable (via
`lib/vendor-stand-pricing.ts`) and this function's `lib/data/tickets.ts` imports pulled
`firebase-admin` into the client bundle. The description below of what it does and how
it's tested is otherwise unchanged; only its module location moved. One new exported
function, **read-only, no transaction**:

```typescript
export async function getPoolRemaining(args: {
  poolKeyBase: string;
  chosenDay?: string | null;
  requiresDaySelection: boolean;
  capacity: number;
}): Promise<number>
```

It composes `resolveDayQualifiedPoolKey()` (§2) with the SAME sold-count source the
checkout transaction itself reads: `getSoldCountsByTicketTypeAndDay()` (§2, above) when
`requiresDaySelection` is true, `getSoldCountsByTicketType()` (the existing,
`lib/data/tickets.ts:44` function) when it's false — never a third, separately-built
query. This is the property "race-consistent" means here: the number a visitor sees can
never diverge from the number the checkout transaction actually enforces, because both
read from the same two sold-count functions. Called outside any transaction (a plain
read, safe to call on every page render), it is the one and only counting path for:

**Unqualified-branch membership, explicit (Codex found a live regression here,
2026-10-07, A21, verified by team-lead against source):** `getSoldCountsByTicketType()`
keys its output by each document's REAL ticketType slug (`lib/data/tickets.ts`) — it
never returns an entry keyed by a pool name like `admission-early-bird` itself, because
no ticket document's `ticketType` is ever literally that string. The unqualified branch
must therefore NEVER read `soldCountsByType[poolKeyBase]` directly. Instead it must sum,
across every product whose `capacityPool ?? slug` resolves to `poolKeyBase`, that
product's own `soldCountsByType[slug]` weighted by its `headcountPerUnit ?? 1` — the
SAME resolution `planPooledCapacity()`'s own `resolvePoolKey`/`resolveWeight` already use
(`poolConfigByType[ticketType]?.pool ?? ticketType`, `?? 1`), just sourced from
`lib/provisional-figures.ts`'s product arrays (the same `[...ADMISSION_PRODUCTS,
...CONFERENCE_PRODUCTS, ...WORKSHOP_FIELD_TRIP_PRODUCTS]` spread `scripts/
seed-ticketing.ts` already uses as the single source of every product's
`capacityPool`/`headcountPerUnit`) rather than a runtime `poolConfigByType` map, since
this read-only accessor takes no Sanity client and must not grow a third,
independently-constructed query. This single membership-and-weight resolution serves
BOTH cases with no special-casing: a real shared pool (e.g. `admission-early-bird`, two
member slugs) sums every member; a singleton product with no pool (`capacityPool: null`,
so `capacityPool ?? slug` resolves to its own slug) trivially "sums" over itself alone,
same as before. See `check-get-pool-remaining-early-bird-dual-ceiling.mjs` (A19) for the
fixture proof — keyed by real per-slug stubs (`early-bird`/`weekend-pass-early-bird`),
never pre-merged by pool, or the fixture proves nothing about this defect class.

- The shared `admission-early-bird` 500-pool (unqualified — `requiresDaySelection: false`
  for this call, regardless of the slug's own day-selection requirement, matching §1/§2's
  "not day-qualified" pool semantics).
- Each of Friday/Saturday/Sunday's independent `day-visitor` 1000-caps
  (`requiresDaySelection: true`, one call per day).
- VIP (200), Sunset Cocktails (200, `sunset-cocktails` pool), SAOC Symposium (80), WOSA
  Conference (80), and each `workshopSession`'s own cap (10) — each a plain
  `requiresDaySelection: false` call against that product's own `capacityPool ?? slug`.
- Weekend Pass's own historical capacity-300 estimate (needs-Brad, carried over
  unchanged) — same plain call, so the displayed number is honest about the SAME
  uncertain ceiling the mission has flagged elsewhere, not a separately-invented number.

**`early-bird` (day-visitor's EB sibling) needs TWO calls, not one** — exactly mirroring
§2's two-independent-checks requirement: one day-qualified call (its share of that day's
1000) and one unqualified call (its share of the shared 500-pool). Both numbers are real
and both are exposed; F6's view-model carries them as two separate fields rather than
collapsing them into one (collapsing would misreport whichever ceiling binds first).


## Addendum (architect, 2026-10-07, check-authoring pass): getPoolRemaining()'s testability

`getPoolRemaining()` (§7 above) performs real Firestore reads internally (via
`resolveDayQualifiedPoolKey()` + `getSoldCountsByTicketTypeAndDay()`/
`getSoldCountsByTicketType()`), and no Firestore emulator is available on this machine
(the same precondition `check-single-use-claim-is-atomic.mjs`'s header documents for
`claimRegistrationToken()`). Rather than leave A19 ("proven by fixture, not just
type-checked") untestable, `getPoolRemaining()` takes an OPTIONAL fourth-argument `deps`
object — the same dependency-injection shape this codebase already uses for
`lib/confirmation-email.ts`'s `SendConfirmationEmailDeps`/`ConfirmationEmailMailer` — so
a fixture can inject stub sold-count functions without touching Firestore, while every
real call site (zero of which exist yet) omits it and gets the real functions:

```typescript
export async function getPoolRemaining(
  args: {
    poolKeyBase: string;
    chosenDay?: string | null;
    requiresDaySelection: boolean;
    capacity: number;
    showId: string;
  },
  deps: {
    getSoldCountsByTicketTypeAndDay?: typeof getSoldCountsByTicketTypeAndDay;
    getSoldCountsByTicketType?: typeof getSoldCountsByTicketType;
  } = {},
): Promise<number>
```

`deps` defaults to the real, imported `lib/data/tickets.ts` functions when omitted —
production callers (F6's loaders) never pass it. A18's check proves the DEFAULT path
composes `resolveDayQualifiedPoolKey()` with these same two real functions (never a
third, independently-constructed query); A19's check injects stub functions to prove
early-bird's two simultaneous ceilings (its day-qualified share of the 1000 cap and its
unqualified share of the shared 500-pool) resolve independently from one fixture, in
one call each, with no live Firestore read.

## Addendum (architect, 2026-10-07, build-break fix): `lib/checkout-reservation.ts` must stay client-safe

`lib/vendor-stand-pricing.ts` — a module reached from a **client component** (F5's own
lane, untouched by this feature) — imports `isWithinEarlyBirdWindow` from
`lib/checkout-reservation.ts`. That makes `lib/checkout-reservation.ts` itself
client-reachable: anything it imports at module scope ships in the client bundle, or the
build breaks.

§7's `getPoolRemaining()` was added to `lib/checkout-reservation.ts` importing
`getSoldCountsByTicketType`/`getSoldCountsByTicketTypeAndDay` from `lib/data/tickets.ts`
at module scope — which pulls in `firebase-admin`, a server-only dependency. That broke
the production build (commit `8f978bbb`, rollout failure, 2026-10-07) because the client
bundle now transitively required `firebase-admin` (components/vendors/
VendorStandPaymentForm.tsx -> lib/vendor-stand-pricing.ts -> lib/checkout-reservation.ts,
47 Turbopack errors).

**Fix landed (@dev, 2026-10-07): `getPoolRemaining()` and its sold-count imports moved
out of `lib/checkout-reservation.ts` into a new server-only sibling module,
`lib/data/pool-remaining.ts`** — confirmed, final path. It imports
`resolveDayQualifiedPoolKey` back from `lib/checkout-reservation.ts` (still pure,
unmoved) and the product arrays from `lib/provisional-figures.ts`. `planPooledCapacity()`,
`resolveEffectivePrice()`, `isWithinEarlyBirdWindow()`, `resolveDayQualifiedPoolKey()`,
and the other pure/client-safe exports §1-§6 describe stayed in
`lib/checkout-reservation.ts` exactly as before — only the two-`getSoldCounts*`-importing
accessor moved, zero behaviour change. A18/A19/A25's checks were repointed to import from
`lib/data/pool-remaining.ts`; A23/A24 read `app/api/tickets/checkout/route.ts` directly
and never imported `getPoolRemaining`, so neither needed any change.

**Standing invariant, enforced going forward:** `lib/checkout-reservation.ts` must never
import, at any depth from its own module-scope imports, anything that reaches
`firebase-admin` or `lib/data/*` (both server-only — Admin SDK). This is checked as a
cheap static grep over the file's own top-level `import` lines (not a full build), proven
to bite against an in-memory copy containing the current bad import before asserting the
real file passes. See the new `A26` assertion in `contract-f4.yaml`.

## What this feature does NOT do

- Does not change `planPooledCapacity()`'s own signature or internals — reused verbatim.
- Does not touch `app/(marketing)/national-show/**` UI — F6's lane.
- Does not touch `lib/vendor-stand-pricing.ts` — F5's own milestone.
- Does not invent an EB-to-regular fallback purchase flow (see §4).
- Does not resolve whether Weekend Pass draws against the Day Visitor day cap (see §2) —
  ships the stated default, flagged.
- Does not render any counter, card, or UI — `getPoolRemaining()` is a data accessor only;
  F6 calls it from a loader, and the NOS design peer renders it. No JSX, no styling, no
  component lives in this feature.
