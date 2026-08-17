# Fictional Test Show — decision record

## Scope boundary — what this is, and what it deliberately is NOT

This is a contract requested directly by Brad, not a spec'd mission F-number. It adds exactly
one new Sanity `show` document — never active, never publicly listed, never sellable except
during a brief, human-supervised window — plus one `ticketType` scoped to it, and the pure
modules that make both genuinely find-and-removable later: `lib/fictional-test-show.ts`
(marker classifiers), `lib/fictional-test-show-seed-plan.ts` (idempotent seed decisions),
`lib/fictional-test-show-active-swap-plan.ts` (a generic, safety-proven active-show swap
planner), `lib/fictional-test-show-recoverability.ts` (the three-hop cleanup-report join
logic), an additive `fictionalTestData` boolean on `sanity/schemas/documents/show.ts`, and
three I/O-performing scripts (seed, swap, report) that are all real, credentialed, and
deliberately outside this contract's gate. It does not touch
`app/api/tickets/checkout/route.ts`'s, `app/api/tickets/itn/route.ts`'s, `lib/checkin.ts`'s,
or `lib/orders.ts`'s own logic — only reuses their already-shipped functions
(`resolveActiveShow()`, `ticketTypeMatchesActiveShow()`) — and does not run any of the three
new scripts for real. **This contract, like every contract on this mission, never creates,
writes, or deletes anything in Firestore or Sanity from a gate check.**

## Why this exists

F9's own dry-run resolved its demo ticket type against the REAL active show (`show-19-2027`).
That means every human end-to-end proof this mission still needs (F12's real PayFast sandbox
purchase, F14's recovery-link proof) would, if run today, create real orders, positions, and
check-in records hanging off the actual 2027 National Show — the live show Lee-Ann and the
Council will eventually sell real tickets against. Brad asked for a fictional show so every one
of those test artefacts lands somewhere isolated instead, and so the whole pipeline —
checkout, PayFast sandbox, ITN, confirmation, check-in — gets exercised end to end before it's
proven against the real thing.

## The central design problem, stated plainly

Two facts, read directly from the code (not assumed), make "just add a fictional show document"
dangerous if done carelessly:

1. **`activeTicketTypesQuery`** (`sanity/queries.ts`) — the query the public `/tickets` page
   renders from — is `*[_type == "ticketType" && active == true] | order(order asc){...}`.
   **No show-scoping whatsoever.** F9 closed the demo-exclusion half of this gap (a `demo`
   boolean, filtered client-side by `filterPubliclyListableTicketTypes()`); it did not, and was
   not asked to, add show-scoping. A ticket type document that is merely `active: true` (its
   own Sanity field, unrelated to the show's `active` field — see "Two `active` flags" below)
   renders on the real public site regardless of which show it belongs to, full stop.
2. **`resolveActiveShow()`** (`lib/show-resolution.ts`, F1) decides which ONE `show` document is
   sellable — the mechanism `ticketTypeMatchesActiveShow()` (checkout) uses to gate real
   purchases. It is binary: whichever show carries `active: true` (and fails closed to "none"
   if zero or more than one do). There is no notion of "sellable in a sandboxed way" — a show
   is either the one active show, or it isn't sellable at all.

**What this means, combined:** if a fictional show's ticket type is seeded with `active: true`
(Sanity ticketType-level) and no exclusion, it appears on the real public site next to real
ticket types tomorrow, with a "Buy Ticket" button, regardless of whether the fictional SHOW is
"active" in the F1 sense. And separately, actually *purchasing* against it for real requires the
fictional SHOW to be the one and only active show — which necessarily means the real 2027 show
stops being purchasable for that window. These are two independent risks, and this contract
closes the first permanently (by construction, no human step needed) and makes the second an
explicit, narrow, reversible, human-supervised action rather than a silent side effect.

## The decision — three mechanisms, not one

**Reuse F9's `demo` flag for the fictional show's ticket type too.** F9 already shipped, and
already proved (its own A6), a real code path that removes any `demo: true` ticket type from
the public listing: `activeTicketTypesQuery` selects `demo`, `page.tsx` filters through
`filterPubliclyListableTicketTypes()` before rendering. This contract's ticket type document
sets `demo: true` — no new filtering code, no new query, reusing a mechanism already proven
correct. A6 (this contract) proves the reuse is genuine, not coincidental, with a mixed fixture
containing BOTH F9's demo entry and this feature's fictional-show entry, confirming both are
removed and every real entry survives.

**The fictional show document itself defaults to permanently inert, by type, not by
convention.** `planFictionalTestShowDocument()`'s planned `active` field is the TypeScript
literal `false` — not a parameter, not a default that a caller could override, not a runtime
branch a future edit could accidentally flip. A4 proves no fixture input can talk the function
into planning anything else. This is the difference between "a policy this contract follows"
and "a property this contract's types make impossible to violate silently."

**Direct-slug purchase is deliberately still possible, exactly like F9's demo ticket type,
because that is the whole point** — `ticketTypeBySlugQuery` is left unscoped (matching F9's own
choice), so a human tester who already knows the fictional show's ticket type slug can still
attempt to buy it directly. What stops that purchase from actually completing, by default, is
`ticketTypeMatchesActiveShow()` — the real, already-shipped F1 gate — refusing because the
fictional show is not the active show. **A4's proof (3) is the answer to "what would appear on
saoc.co.za if someone seeded the fictional show tomorrow": nothing new on the public listing
(demo-excluded, permanently), and a direct-slug purchase attempt against it would be refused
with the same 500 `unusableTicketType(..., 'show')` response any stale/misconfigured ticket
type gets today.** Nothing is purchasable, nothing displaces the real show, until a human
takes the one deliberate step below.

## The one human step this design cannot avoid, and why

To actually run an F12/F14-style live purchase test against the fictional show, `resolveActiveShow()`'s
binary, fails-closed design means the fictional show must briefly become the SOLE active show —
there is no partial or sandboxed notion of "active" in the current architecture, and this
contract does not invent one, because doing so would mean editing
`ticketTypeMatchesActiveShow()` or `resolveActiveShow()` themselves (out of scope, and exactly
the kind of new special-case code path A10's grep is designed to catch if it crept in
elsewhere). The honest consequence: for that window, the real 2027 show becomes unpurchasable
too. This is real, not hidden, and is why `lib/fictional-test-show-active-swap-plan.ts` exists —
not to route around the constraint, but to make the swap auditable, reversible, and provably
safe (A9): it always computes a plan that leaves EXACTLY one show active, refuses a target it
can't find, and is proven against fixtures using arbitrary show ids (not just the fictional
one) to establish it is a generic swap utility, not fictional-show-specific logic smuggled into
production code under a generic name. `scripts/swap-active-show.ts` (unasserted, real Sanity
writes, `--apply`-gated) is the script a human runs once before the test window and once after,
by name, on purpose — never automatically.

## Why classification keys off `show._ref`, not the shared `demo` boolean

F9's real demo ticket type (scoped to whichever show is genuinely active) and this feature's
fictional-show ticket type BOTH carry `demo: true` — that field's job is public-listing
exclusion, and both need it for the same reason. If `isFictionalTestShowTicketTypeDoc()` used
`demo === true` as a classification signal, it would misclassify F9's own real-show demo
ticket type (and every position purchased against it by a real F12 tester) as fictional-show
data — sweeping a DIFFERENT feature's test artefacts into this feature's cleanup report. The
classifier instead keys off `show._ref === FICTIONAL_SHOW_ID` (the load-bearing channel) OR
`slug === FICTIONAL_SHOW_TICKET_TYPE_SLUG` (defence-in-depth against a slug or show-reference
edit alone). A3 proves this directly: a fixture shaped exactly like F9's real demo ticket type
is fed to `isFictionalTestShowTicketTypeDoc()` and must classify `false`.

## Why a different slug from F9's demo ticket type, not a reuse

`ticketTypeBySlugQuery` — `*[_type == "ticketType" && slug.current == $slug && active ==
true][0]` — takes the FIRST match, and Sanity's `slug` field has no uniqueness constraint (its
Studio-side validation is authoring-time only, exactly the same "not a read-time guarantee"
gap `app/api/tickets/checkout/route.ts`'s own comments already document for `price`/`capacity`
being untyped at read time). If this feature's ticket type reused `DEMO_TICKET_TYPE_SLUG`
verbatim, and F9's real demo ticket type existed in the same dataset at the same time (which it
will, per F9's own plan — F12 needs it), a checkout POST for that slug would resolve to
WHICHEVER of the two documents Sanity happens to return first — non-deterministic from the
caller's perspective, and a real risk of a human tester's "fictional show" purchase silently
landing against the real 2027 show's demo ticket type instead, or vice versa. A7 proves the two
reserved slugs are textually distinct constants and that a fixture modelling this exact
first-match query behaviour resolves each slug to its own correct document even with both
present simultaneously.

## Two `active` flags, two different meanings — not a contradiction

`sanity/schemas/documents/show.ts`'s `active` field ("exactly one show should be active at a
time," consumed by `resolveActiveShow()`) and `sanity/schemas/documents/ticketType.ts`'s
`active` field ("Active" — a simple sellable/unsellable toggle every one of the 5 real ticket
types and F9's demo ticket type already use) are unrelated booleans on unrelated document
types that happen to share a field name. The fictional show plans `show.active: false` (never
sellable-show) while its ticket type plans `ticketType.active: true` (in-principle sellable, IF
its show ever becomes active) — these are not in tension; `ticketTypeMatchesActiveShow()` reads
both independently and requires both to align before a purchase succeeds.

## The recoverability chain, three hops

Read directly from the code (not assumed), the same way F9's README established this for its
own demo ticket type:

- **Firestore `tickets` (positions)** never carry any marker boolean — `types/index.ts`'s
  `Ticket.ticketType: TicketType` is a bare string (the ticket type's slug), written verbatim
  by checkout (`ticketType: input.ticketType`, `app/api/tickets/checkout/route.ts`) and by
  `createOrderWithPosition()` (`lib/orders.ts`). The SOLE recoverability channel is
  `isFictionalTestShowTicketTypeSlug(position.ticketType)`.
- **Firestore `orders`** (`lib/orders.ts`, `ORDERS_COLLECTION = 'orders'`) — `types/index.ts`'s
  `Order` interface carries no `ticketType` field at all. The join channel is
  `position.orderId`: every matched position's non-null `orderId` is collected, and any order
  whose `id` appears in that set is a fictional-show order.
- **Firestore `checkinAttempts`** (`lib/checkin-audit.ts`, `CHECKIN_ATTEMPTS_COLLECTION =
  'checkinAttempts'`) — `CheckinAttemptRecord`'s full field set (per that file's own comment,
  "the ENTIRE field set... No attendeeName/attendeeEmail... exists here") carries `bookingRef`
  and `orderId` but no `ticketType` and no marker boolean. The join is dual: a record matches if
  its `bookingRef` equals a matched position's `bookingRef`, OR its `orderId` equals a matched
  order's `id` — dual because `buildCheckinAttemptRecord()`'s `bookingRef` input is nullable
  (a malformed/mis-scanned attempt can carry `bookingRef: null` while a resolved `orderId` still
  exists from an earlier lookup step in the route, or vice versa for a not-found scan).

**One important, honest correction to the naive assumption "Order has a `showId` field, use
that":** `Order.showId` and `Ticket.showId` are BOTH always the fixed constant
`NATIONAL_SHOW_ID` (`lib/tickets-constants.ts`, `'nationalShow'`) for every purchase, real or
fictional — `isValidCheckoutBody()` in the checkout route validates `body.showId ===
NATIONAL_SHOW_ID` literally, and `lib/checkin.ts`'s `admit()` refuses `wrong-show` against that
same constant. This `showId` is a Firestore-level, single-tenant concept entirely decoupled
from the Sanity `show` document identity that `resolveActiveShow()`/`ticketTypeMatchesActiveShow()`
operate on (a pre-existing, F1-era naming collision this contract did not create and is not in
scope to fix). **It gives zero discrimination signal between a fictional-show purchase and a
real one — it is identical for both, by construction of the existing code.** This is also the
direct, structural reason A10's "no code path branches on the fictional show's identity" claim
is true almost by default: the only `showId` value check-in or checkout ever see IS the shared
constant, so there is no existing branch point where fictional-show-specific logic could even be
inserted without deliberately adding one — which A10 confirms nobody has.

## Why separate modules, not an edit to F9's files

`lib/demo-ticket-type.ts` and `lib/demo-ticket-type-seed-plan.ts` are F9's shipped, already
gate-passing files. This contract adds sibling modules
(`lib/fictional-test-show.ts`/`lib/fictional-test-show-seed-plan.ts`) with their own constants
and their own local `ExistingShowDoc`/`ExistingTicketTypeDoc` types rather than widening or
importing F9's, for the same reason F10's README gives for not widening F8's `OrdersFirestoreLike`
family in place: this feature's constants (a distinct reserved slug, a `false`-literal `active`
plan) are semantically different from F9's, and importing F9's `DEMO_TICKET_TYPE_SLUG` etc.
directly into this feature's own classifiers would blur exactly the distinction "Why
classification keys off `show._ref`" above depends on being clear. The ONE place this contract
does import from F9 is the A7 collision check, which imports `DEMO_TICKET_TYPE_SLUG` for the
single purpose of proving the two constants differ — never re-exported, never used in any
classification decision.

## Judgement calls made that were left open

1. **`FICTIONAL_SHOW_ID = 'show-fictional-test'`, no year/edition suffix.** Unlike
   `show-19-2027`, this is a singleton — there is only ever meant to be one fictional test
   show, reseeded/reused across every future F12/F14-style dry run, not one per year. If a
   future need arises for more than one simultaneously, that is a real, separate design
   question this contract does not anticipate.
2. **`status: 'cancelled'`, not `'upcoming'`.** Grepped directly: the only query anywhere that
   selects on a `show` document's `status` field is `pastShowsQuery`
   (`status == "past"`), used only by the show archive pages. Neither `'cancelled'` nor
   `'upcoming'` is selected or excluded by anything today — this is NOT a load-bearing safety
   property (A4 does not assert on it), unlike `active: false`, which is. `'cancelled'` is
   chosen purely as an honest, human-legible signal for anyone reading the raw Sanity document
   later, on top of `fictionalTestData: true` and the reserved slug/id/title.
3. **Price R10 / capacity 50 — identical figures to F9's demo ticket type, not a new
   placeholder.** Same nonzero-PayFast-comp-bypass reasoning F9's README already establishes;
   this contract reuses the number rather than inventing a second one, since neither figure is
   Council-approved pricing and both exist for the identical purpose (exercising the real
   gateway path, never displayed to a real buyer).
4. **`order: 999`.** The fictional ticket type's Sanity `order` field, used only by
   `activeTicketTypesQuery`'s `order(order asc)` sort — irrelevant once `demo: true` removes it
   from that listing entirely, but set to a high, clearly-sentinel value rather than left at the
   schema's implicit default so it is never mistaken for a real, curated position if the demo
   filter is ever bypassed by a future bug (defence in depth, not asserted).
5. **`planActiveShowSwap()`'s output includes a `deactivate: string[]`, not a single
   `string | null`.** Chosen specifically so the two-simultaneously-active pre-existing-ambiguity
   case (A9's fourth case) can be represented and swapped out of correctly in one call, rather
   than requiring the caller to already know there's only one show to deactivate — which is
   exactly the assumption `resolveActiveShow()` itself refuses to make.

## Sequencing with F12/F13/F14, and the two known blockers this contract does NOT fix

This contract's fictional show is what lets F12's and F14's human proofs create their orders,
positions, and check-in records somewhere other than the real 2027 show — that is its whole
purpose, and once `scripts/seed-fictional-test-show.ts` and `scripts/swap-active-show.ts` are
run for real (both human/deploy steps, out of this gate's scope), F12/F14 can proceed against it
using the same real checkout → PayFast sandbox → ITN → check-in path they would use against the
real show.

**It does not unblock F13.** F13 (Lee-Ann's real per-show grant) is blocked by two separate,
pre-existing facts this contract's brief names and this contract does not touch: (1) the roles
migration (`scripts/admin-migrate-roles.ts` / `lib/admin-migrate-roles-plan.ts`, F4) has never
actually been run against live Firebase Auth — zero accounts hold a `roles` custom claim today,
so every `roles`-gated capability check fails closed for everyone, fictional show or real; (2)
no production `ShowWindowLookup` implementation exists (the F4 architecture's own injected-
dependency seam, proven only against fixtures in F4's and F6's contracts) — without one, any
per-show grant resolves against nothing and is refused. Both are standing backlog P1 items,
unrelated to which show is being tested against, and neither is this contract's job to resolve.

## Every assertion and its defeating mutation

- **A1 (`pnpm type-check`).** Defeated by a type error anywhere in the new/changed files.
- **A2 (compiler fixture).** Defeated by: either seed-plan discriminated union losing its
  `action`-narrowing; the seed documents' literal fields (`active`, `demo`, `status`) widening
  to `boolean`/`string`; `ActiveShowSwapPlan` losing its `safe`-narrowing; the two reserved slug
  constants collapsing to the same literal type.
- **A3 (marker recoverability).** Defeated by: either classifier requiring both channels (AND
  instead of OR); either classifier being vacuously `true` for everything;
  `isFictionalTestShowTicketTypeDoc()` keying off `demo` and misclassifying F9's real demo
  ticket type as fictional-show data; `isFictionalTestShowTicketTypeSlug()` doing a loose match.
- **A4 (active-show safety).** Defeated by: `planFictionalTestShowDocument()` ever planning
  `active: true` for any input; `resolveActiveShow()` or `ticketTypeMatchesActiveShow()`
  changing to let an inactive show's ticket type be purchasable, or to default an ambiguous
  two-active state to "assume fine" instead of failing closed.
- **A5 (seed-plan idempotency).** Defeated by: a non-idempotent second run creating a duplicate;
  a different show's same-slug ticket type blocking the fictional show's own seed.
- **A6 (public listing exclusion, reused).** Defeated by: `filterPubliclyListableTicketTypes()`
  no longer removing a `demo:true` entry, or removing real entries too.
- **A7 (slug collision safety).** Defeated by: the two slug constants becoming textually equal,
  or the simulated first-match query resolving either slug to the wrong document once both
  demo-flagged ticket types coexist.
- **A8 (recoverability join).** Defeated by: the classifier including a real-show or F9-demo
  artefact in its fictional-show result set (over-match); excluding a genuine fictional-show
  artefact (under-match); or the orderId-only / bookingRef-only join paths not being
  independently exercised.
- **A9 (swap-plan safety).** Defeated by: any fixture producing a plan that leaves zero or two
  shows active; a target-not-found case producing `safe: true`; the function behaving
  differently for `FICTIONAL_SHOW_ID` than for an arbitrary other id (proving it isn't actually
  generic).
- **A10 (no special case, structural).** Defeated by any future edit to the four named files
  that references a fictional-show constant by name.
- **A11 (`pnpm lint`).** Defeated by any lint violation in the new/changed files.

## What this contract does NOT prove

- **The live end-to-end purchase itself**, or the live active-show swap. Both are real,
  credentialed, human/deploy steps (`scripts/seed-fictional-test-show.ts`,
  `scripts/swap-active-show.ts`) deliberately outside this gate — exactly F9's own "Why the
  real seed script is unasserted" reasoning, applied to two additional scripts plus a
  read-only reporting one.
- **That `scripts/report-fictional-test-show-artifacts.ts`'s real Sanity/Firestore reads return
  the classification its pure core computes.** Only the pure `classifyFictionalTestShowArtifacts()`
  is gated (A8); wiring it to real reads is unasserted, matching the hard constraint that no
  check may touch live data, credentialed or not.
- **Door-scan behavioural parity for a fictional-show ticket**, for the identical reason F9's
  README already gives (`lib/checkin.ts`'s `admit()` takes a live Firestore `Transaction`; no
  emulator is pinned in this repo). A10's grep is structural only.
- **That F13's blockers are resolved.** Named above, explicitly not this contract's job.
- **Firestore security rules** — no `firestore.rules` file exists in this repo, matching every
  prior feature's README in this mission.
- **Deleting anything.** Forbidden to every agent on this project. The report script enumerates;
  it never deletes; no future edit to it may add that capability.
