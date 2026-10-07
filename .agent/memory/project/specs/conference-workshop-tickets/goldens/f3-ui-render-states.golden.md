# F6 Golden — Ticket/Presenter/Workshop View-Model Layer + Server-Side Loaders

Mission `conference-workshop-tickets`, feature F6 (milestone M4; renumbered from the
original F3/M2, then from F5/M4, then revised again for Brad's re-scope relayed by
team-lead on 2026-10-07: payment/ticket engineering is this mission's job; **all
visual/UI design belongs to the separate NOS design peer session
(`saoc-nos-design-f1`)**). This feature builds the data layer that peer's design will
render against — pure TypeScript interfaces and server-side loader functions. **It
contains zero JSX, zero CSS/Tailwind classes, zero styled component.** Any existing page
this feature wires a loader into keeps its current render output unchanged; the loader's
result is computed and threaded through as a prop/data value, not yet displayed
differently. Visual rendering of these view-models is F7, blocked on the NOS design
handoff.

**SUPERSEDES this golden's own prior three revisions.** Revision 2 dropped page-level JSX
entirely (presenter card grids, `StatusMarker` placeholder tiles, copy edits) as not this
mission's job post-re-scope. **Revision 3 (team-lead's third-pass correction, 2026-10-07)
reverses one piece of revision 2's caution: the live "N left" counters are NOT a
flagged/optional idea awaiting Brad's go-ahead — Brad has confirmed he wants them, and the
NOS design peer is actively designing cards with a scarcity line.** The engineering behind
every counter (a race-consistent remaining-count read per product/pool, via F4's new
`getPoolRemaining()`) is in scope and mandatory for this feature. What stays out of scope
is only the rendering: the styled card, the badge, the live-updating widget — that is F7,
blocked on the NOS design handoff, same as before.

## 1. View-model interfaces (pure data shapes, no rendering)

```typescript
// lib/view-models/ticket-card.ts

/**
 * Precedence order is significant and MUST be applied in this exact sequence —
 * each state masks every state below it. A sold-out EB product with a pending price
 * read is 'pricePending', never 'earlyBirdSoldOut'; a sold-out product that still has
 * a resolvable price is 'soldOut', never 'low'.
 */
export type TicketCardState =
  | 'pricePending'      // 1 (highest) — price/capacity data failed to resolve or is mid-fetch
  | 'soldOut'            // 2 — remaining <= 0 for a non-early-bird product, or for an
                         //     early-bird-ineligible product's own ceiling
  | 'earlyBirdSoldOut'   // 3 — remaining <= 0 specifically on an early-bird pool/slug,
                         //     distinguished from plain soldOut so the design peer can
                         //     render pool-exhaustion language different from a flat sellout
  | 'low'                // 4 — remaining > 0 and remaining <= LOW_STOCK_THRESHOLD_PERCENT
                         //     of total capacity
  | 'available';         // 5 (lowest/default) — remaining > low-stock threshold

export const LOW_STOCK_THRESHOLD_PERCENT = 10;

export interface ScarcityLine {
  remaining: number;          // real, race-consistent count — see §2; never null for any
                               // product this feature covers (every product in scope now
                               // gets a real counter, see §1a)
  total: number;
  label: string;               // e.g. "12 of 80 places left" — plain text, no markup
}

export interface TicketCardViewModel {
  slug: string;
  state: TicketCardState;
  price: number | null;          // null only when state === 'pricePending'
  regularPrice: number | null;   // non-null ONLY for the two early-bird SKUs —
                                  // weekend-pass-early-bird's sibling is weekend-pass
                                  // (R380 live), early-bird's sibling is day-visitor (its
                                  // live price). The loader READS the sibling ticketType's
                                  // own live `price`, never a second, independently-typed
                                  // number — see §2's "sourced, not re-typed" rule. null
                                  // for every other in-scope product (no sibling relation).
  scarcity: ScarcityLine | null; // the product's own single-pool/direct-capacity reading.
                                  // null for day-visitor (no single pool — see `days`
                                  // below) and, per the design peer's 2026-10-07 request,
                                  // ALSO null for weekend-pass specifically when its own
                                  // ticketType.capacity is unset/null (Brad has not yet
                                  // ruled a cap exists) — see §1a's updated weekend-pass
                                  // row. null for any other in-scope product's `scarcity`
                                  // is a defect, not a valid state.
  days: Array<{
    day: string;                 // ISO date, e.g. '2027-09-24'
    state: TicketCardState;      // this day's OWN state — one day can be soldOut while
                                  // a sibling day is still available; a single card-level
                                  // state cannot express that, so each day carries its own
    remaining: number;
    total: number;
  }> | null;                     // PRESENT (non-null) ONLY for day-qualified products
                                  // (day-visitor, early-bird) — one entry per sellable ISO
                                  // date (Friday/Saturday/Sunday), in Fri/Sat/Sun order
                                  // (an ordered array, not an object, precisely so order
                                  // doesn't depend on key-insertion order), each out of Day
                                  // Visitor's per-day 1000 cap (F4 §2's day-qualified pool
                                  // key). early-bird populates BOTH `days` AND `scarcity`
                                  // (its unqualified share of the shared 500-pool)
                                  // simultaneously — it has two independent ceilings, so it
                                  // needs two independent readings; collapsing them into
                                  // one would misreport whichever binds first. day-visitor
                                  // itself ships `scarcity: null` (no single pool) and a
                                  // real `days` array.
}

export interface PresenterCardViewModel {
  id: string;                   // conferencePresenter document _id
  name: string;
  role: string | null;
  bioExcerpt: string | null;    // raw text, no truncation/formatting applied here — that's
                                 // a rendering concern for F7
  photoUrl: string | null;      // null when no photo asset exists yet (real state today)
  event: 'saoc-symposium' | 'wosa-conference';
  order: number;
}

export interface WorkshopSessionViewModel {
  id: string;
  title: string;
  description: string | null;
  presenterId: string | null;   // reference to a PresenterCardViewModel.id, or null
  timeSlot: string | null;      // free text as entered in Sanity, never a fabricated time
  ticketCard: TicketCardViewModel | null; // null until a real ticketType is linked
}
```

### 1a. Every in-scope product gets a real counter — none are flagged/skipped

Per team-lead's correction, this is a confirmed, not optional, deliverable for every
product this mission touches:

| Product | Counter shape | Ceiling |
|---|---|---|
| `vip` | `scarcity` | 200 |
| `sunset-cocktails-single` / `-couple` | `scarcity` | 200 (shared `sunset-cocktails` pool) |
| `saoc-symposium` | `scarcity` | 80 |
| `wosa-conference` | `scarcity` | 80 |
| each `workshopSession` | `scarcity` (via its linked `ticketCard`) | 10 |
| `weekend-pass` | `scarcity`, **OR `null` specifically when `ticketType.capacity` is itself unset/null** | 300 (needs-Brad carried-over estimate — while a capacity is set, the counter is real and mandatory, same as every other row; `scarcity: null` is permitted ONLY as the direct, honest consequence of Brad not yet ruling the cap exists — see the note below the table) |
| `weekend-pass-early-bird` | `scarcity` + `regularPrice` (weekend-pass's live price) | 500 (shared `admission-early-bird` pool, unqualified) |
| `day-visitor` | `days` only (`scarcity: null`) | 1000 per day, Friday/Saturday/Sunday independently |
| `early-bird` (day-visitor's EB sibling) | **both** `days` (1000/day) **and** `scarcity` (shared 500-pool) **and** `regularPrice` (day-visitor's live price) | two independent ceilings |

No product in this mission's scope ships `scarcity: null` by default any more — the prior
revision's VIP exception is withdrawn. **One narrow, explicit exception reopened
2026-10-07 (design peer, relayed by team-lead):** `weekend-pass` alone may ship
`scarcity: null`, and only as the direct consequence of its own `ticketType.capacity`
being unset/null — i.e. Brad has not yet ruled that a cap exists at all. This is never a
slug-keyed "skip this one" branch (the VIP-exception defect class this note already
warns against) — it is a single shared rule ("no capacity number means no counter") that
happens to only ever fire for weekend-pass today, because every other in-scope product's
`ticketType.capacity` is always set. **`scarcity: null` here means "no counter is shown,"
never "unlimited supply"** — the design peer must not render this as an unlimited-stock
claim; it is an honest gap, matching the open capacity-estimate question already flagged
needs-Brad elsewhere in this golden and in docs/national-show-conference-workshop-tickets.md.

## 2. Server-side loader functions (pure data fetch + shape, no network-dependent UI)

`lib/view-models/load-ticket-card.ts`:

```typescript
export async function loadTicketCardViewModel(slug: string): Promise<TicketCardViewModel>
```

Fetches the validated Sanity `ticketType` document, then calls F4's new
`getPoolRemaining()` (`lib/checkout-reservation.ts`) — **the single, shared,
race-consistent counting path** — never a second independently-built Firestore query.
"Race-consistent" means exactly this: the number this loader returns is read via the same
sold+reserved-count query the checkout transaction itself uses to admit/reject, so the
displayed count can never drift out of sync with what's actually enforced at purchase
time. For `day-visitor` and `early-bird`, the loader calls `getPoolRemaining()` once per
sellable day (`requiresDaySelection: true`) to build the `days` array — one entry per
Friday/Saturday/Sunday, in that order, each with its own independently-resolved
`TicketCardState` (the same precedence order applied per-day, so Saturday can read
`soldOut` while Friday reads `available`); `early-bird` additionally calls it once more
unqualified (`requiresDaySelection: false`) against the shared pool to populate `scarcity`.
Every other product makes exactly one unqualified call and populates `scarcity` with
`days: null`. Applies `LOW_STOCK_THRESHOLD_PERCENT` and the `TicketCardState` precedence
order above per count (card-level `state` AND each day's own `state` for day-qualified
products). This loader is also the one caller of F1's `computeEarlyBirdRemaining` for the
pure never-negative/null-passthrough arithmetic once `getPoolRemaining()` has supplied the
real sold/capacity numbers — F1 ships the arithmetic, F4 ships the counting query, this
loader is where they meet.

**`regularPrice` (added 2026-10-07, design peer request, relayed by team-lead):** for
`weekend-pass-early-bird` and `early-bird` only, the loader additionally fetches its
sibling ticketType document (`weekend-pass` / `day-visitor` respectively) and reads that
sibling's own live `price` field straight through as `regularPrice` — it is SOURCED, never
re-typed as a second literal number that could silently drift from the sibling's real,
editable price. Every other slug's `regularPrice` is `null`.

**`scarcity: null` for weekend-pass when uncapped (added 2026-10-07):** before calling
`getPoolRemaining()` for an unqualified (non-day-qualified) product, the loader checks
whether `ticketType.capacity` is itself unset/null. If so, it skips the
`getPoolRemaining()` call entirely for that product and sets `scarcity: null` directly —
it does not call `getPoolRemaining()` with a fabricated capacity, and it does not invent
a "last known" or default number. Today this branch only ever fires for `weekend-pass`
(every other in-scope product's `ticketType.capacity` is set), but the check itself is
slug-agnostic — a capacity-based rule, not a `slug === 'weekend-pass'` special case.

`lib/view-models/load-presenters.ts`:

```typescript
export async function loadPresenterViewModels(event: 'saoc-symposium' | 'wosa-conference'): Promise<PresenterCardViewModel[]>
```

GROQ query against `conferencePresenter`, filtered by `event`, ordered by `order`. Returns
an empty array when none are seeded (the real, current state) — callers decide how to
render that, not this loader.

`lib/view-models/load-workshop-sessions.ts`:

```typescript
export async function loadWorkshopSessionViewModels(): Promise<WorkshopSessionViewModel[]>
```

GROQ query against `workshopSession`, resolving each session's linked `ticketType` (if any)
through `loadTicketCardViewModel`. Returns an empty array when none are seeded (the real,
current state, since none are council-confirmed yet).

## 3. Placeholder wiring into existing pages — data only, no render change

`app/(marketing)/national-show/symposium/page.tsx`,
`.../wosa-conference/page.tsx`, and `.../workshops/page.tsx` each gain exactly one
additive server-side call to the relevant loader(s) above, with the result passed as a
prop to the existing render tree — **the existing JSX output is byte-for-byte unchanged**.
This proves the loaders (counters included) are wired and callable from the real page
module (not dead code sitting unused in `lib/`), without pre-empting the design peer's
actual layout, copy, or component structure. The design peer's handoff (F7) replaces this
placeholder prop-pass with real rendering of the real counters; this feature does not
guess at what that rendering looks like.


## Addendum (architect, 2026-10-07, check-authoring pass): one pure precedence resolver

## Addendum 2 (architect, 2026-10-07, check-authoring pass): loadTicketCardViewModel's own DI seam

Same reasoning as Addendum 1 and F4's `getPoolRemaining()` DI seam: A14/A15 need to
prove the ASSEMBLED view-model shape (the `days`/`scarcity` nullability rules, each
day's independently-resolved state) from a fixture, with no live Sanity/Firestore call.
`loadTicketCardViewModel()` therefore takes an optional second `deps` argument:

```typescript
export async function loadTicketCardViewModel(
  slug: string,
  deps: {
    fetchTicketType?: (slug: string) => Promise<SanityTicketTypeLike>;
    getPoolRemaining?: typeof getPoolRemaining;
    computeEarlyBirdRemaining?: typeof computeEarlyBirdRemaining;
  } = {},
): Promise<TicketCardViewModel>
```

All three default to the real implementations when omitted — every real call site (F6's
own page wiring, §3) omits `deps` entirely. `SanityTicketTypeLike` carries at minimum
`price`, `capacity`, `capacityPool`, `requiresDaySelection`, `earlyBirdCutoff` — the same
fields route.ts's own `SanityTicketType` already validates, so a fixture's shape matches
production data exactly, not an invented shorthand.

For `regularPrice` (see §2), the loader calls the SAME `deps.fetchTicketType` a second
time with the sibling's slug (`weekend-pass` / `day-visitor`) rather than gaining a
second injectable function — one seam, reused for whichever slug is being fetched, same
as production's own single real `fetchTicketType` would be called twice in that case.

A3 ("TicketCardState precedence order... verified against fixture cases covering every
pairwise precedence collision") needs a function that is directly fixture-testable with
no Firestore/Sanity I/O — same decision/wiring split this codebase already uses
(`resolveEffectivePrice()`, `planPooledCapacity()`, `resolveDayQualifiedPoolKey()` are
all pure; a loader or route wires the I/O around them). `lib/view-models/ticket-card.ts`
gains one new pure export, called by `loadTicketCardViewModel()` (the "sibling wiring"
half, provable the same textual way `check-chosen-day-persistence-wiring.sh` proves its
own strip function is actually called, not just defined):

```typescript
export function resolveTicketCardState(input: {
  priceUsable: boolean;
  remaining: number | null;
  total: number;
  earlyBirdRemaining: number | null;
}): TicketCardState
```

Precedence, each one strictly higher than the next (first match wins):

1. `!priceUsable` -> `'pricePending'`
2. `remaining !== null && remaining <= 0` -> `'soldOut'`
3. `earlyBirdRemaining !== null && earlyBirdRemaining <= 0` -> `'earlyBirdSoldOut'`
4. `remaining !== null && total > 0 && (remaining / total) * 100 <= LOW_STOCK_THRESHOLD_PERCENT`
   -> `'low'`
5. otherwise -> `'available'`

`remaining: null` means "no pool tracked for this product" (day-visitor's own bare
`scarcity`, which stays null per A14) — such a card can still resolve `'pricePending'`
but never `'soldOut'`/`'low'` from a null remaining. A card with BOTH a day-qualified
`days[]` reading and its own unqualified `scarcity` (early-bird) calls this resolver
TWICE, once per ceiling, exactly like `getPoolRemaining()`'s own two-calls-not-one
requirement (F4 golden §7) — never a single collapsed call mixing the two ceilings'
numbers together.

## 4. What this feature does NOT do

- Does not write or modify any JSX, Tailwind class, inline style, or visual component.
- Does not change what any page currently renders to a visitor — the wiring is additive
  and inert (computed, passed down, not yet displayed differently).
- Does not build a live-updating counter WIDGET, badge, or any styled scarcity display —
  the counter DATA (`ScarcityLine`/`days`/`TicketCardState`) is real and mandatory per
  §1a; only its presentation is F7's job. A single rendered card with a Fri/Sat/Sun
  selector (per the design peer's intent for Day Pass) is F7's layout decision — this
  feature only guarantees the `days` array it needs to build that selector against.
- Does not touch the ticket-router/buy tree (`app/(marketing)/national-show/tickets/buy/**`)
  — that mission's lane owns WHERE the cards render; this feature owns the counts behind
  them (team-lead's third-pass correction).
- Does not touch `components/show/CategoryTicketsPage.tsx` — owned by the sibling SAOC
  session.
- Does not add a second counting mechanism anywhere — every count traces to F4's
  `getPoolRemaining()`, which itself traces to `planPooledCapacity()`'s own query.

## 5. Open question carried forward, not resolved here

Only ONE open question remains for this feature (the VIP-counter question from the prior
revision is withdrawn — resolved per §1a): does a Weekend Pass holder's counter draw
against Day Visitor's per-day cap? This is F4's open question (§2), not re-litigated
here — this feature's `days` array for `day-visitor`/`early-bird` reads
`getPoolRemaining()` with the shipped default (Weekend Pass excluded), so the displayed
counters automatically follow whichever answer F4 ships, with no separate logic in this
feature to keep in sync.

## 6. Required per the mission brief: NOS design-peer handoff + docs

This is the feature whose output (the view-model interfaces + loaders above) the NOS
design peer session (`saoc-nos-design-f1`) renders against, so it carries the mission's
comms/docs obligations rather than a separate feature:

- `comms.md` gets an appended `## [conference-workshop-tickets -> saoc-nos-design-f1]
  <date> — View-model interfaces for ticket/presenter/workshop rendering` block (never
  rewriting prior blocks) — the exact `TicketCardState`/`ScarcityLine`/
  `TicketCardViewModel`/`PresenterCardViewModel`/`WorkshopSessionViewModel` interface text
  from §1 above, verbatim, plus the loader function signatures from §2, the §1a counter
  table, and the three pages' prop names from §3, so the design peer can render against
  real shapes and real counts rather than guessing. Dev transcribes the architect's exact
  text at commit time, does not restate it from memory.
- `docs/national-show-conference-workshop-tickets.md` records: the full merged needs-Brad
  list (vendor/exhibitor R3500 — F5, open; Weekend-Pass-vs-day-cap counting — F4 §2, open;
  weekend-pass's own 300-capacity carried-over estimate — open; workshop presenter scope;
  VIP price/cap override; sunset-cocktails-couple retirement; VIP/cocktails overlap —
  **with the counter-build questions explicitly removed, since Brad has confirmed them,
  not left as an open item**), the view-model precedence order and why it's pinned, the
  §1a counter-ceiling table, and a pointer to F7 as the blocked next step (NOS design
  handoff, not yet contracted).

## 7. Mandatory verification triad (per `.claude/rules/workflow.md` and
`docs/verification-triad-gate.md`)

This feature touches `app/` page files (the additive loader-call wiring in §3). Per
`docs/verification-triad-gate.md`, the triad is `codex_qa` + `browser_deployed_check` +
`gws_inbox_check`, declared on a UI/workflow contract. This feature declares the two that
are real for what it ships: `codex_qa` (adversarial review of the loader-wiring and
counter diff) and `browser_deployed_check` against the real deployed `beta.saoc.co.za`
origin (never a `*.hosted.app`/`*.run.app` URL), confirming the three wired pages still
render identically to before this feature per §3's unchanged-render guarantee. **
`gws_inbox_check` is explicitly NOT declared** — this feature touches zero
purchase/payment/email path (that's F4's PayFast-sandbox-E2E assertion, already covering
the one real email send this mission produces), and inventing an email check with nothing
to verify would be exactly the "assertion satisfiable by something that isn't the real
property" pattern this project's own contract-scoring principles warn against. The gap is
named here rather than papered over with a fabricated check.
