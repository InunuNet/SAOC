# F9 (ticketing-foundation) — demo ticket type, marker-tagged: decision record

## Scope boundary — what F9 is, and what it deliberately is NOT

F9 adds exactly one new sellable `ticketType` document — "General Admission (Demo)" — scoped
to the real active show (spec §6, §11), plus the pure, offline modules and small edits needed
to make its **marker-tagging** genuinely load-bearing: `lib/demo-ticket-type.ts` (the marker
classifier and public-listing filter), `lib/demo-ticket-type-seed-plan.ts` (the idempotent,
offline seed decision), an additive `demo` boolean field on
`sanity/schemas/documents/ticketType.ts`, a `demo,` projection addition to
`activeTicketTypesQuery`, and a filter wired into `app/(marketing)/tickets/page.tsx`. It does
**not** touch `app/api/tickets/checkout/route.ts`'s core logic (only reuses its existing,
already-shipped `ticketTypeMatchesActiveShow()`), does not touch `app/api/tickets/itn/route.ts`
(sha256-pinned, F10's sole authorised reopening), does not touch `lib/checkin.ts`'s admission
logic, and does not run `scripts/seed-demo-ticket-type.ts` for real against the live dataset —
that is a human/deploy step, out of gate scope. The live, human purchase-and-scan proof is
F12's job; the door-connectivity observation is also F12's; Lee-Ann's real per-show grant is
F13's; the recovery-link human proof is F14's. F9 proves the foundation those milestones stand
on is real, not that the milestones themselves happened.

## Why this feature exists, and why marker-tagging is the load-bearing property

F12 and F14 will make **real purchases against a real PayFast SANDBOX gateway on a real
deployed host**, using this demo ticket type. That makes F9 the one feature in this mission
whose own artefacts are most likely to end up sitting in live data, indistinguishable from a
real sale, unless the marker genuinely does its job. This project has a standing P1 where
contract work orphaned roughly 17 documents into live data and nobody could cleanly identify
them afterwards — the marker is precisely the mechanism that makes that recoverable next time.
"Recoverable" here means two separate things, and this contract proves both:

1. **A human glancing at the data must see it's fake.** The name carries `(Demo)`; a future
   admin dashboard or CSV export can show it plainly.
2. **A machine must be able to find every artefact later without a human reading anything.**
   This is the part a name alone cannot do — see "The marker mechanism" below.

## The marker mechanism — two channels, because positions can only carry one of them

The catalogue document (the Sanity `ticketType`) gets a genuine structured marker: `demo:
true`. But **Firestore order and position documents never store that boolean at all** —
`app/api/tickets/checkout/route.ts` writes `ticketType: input.ticketType` onto the position,
which is (per `types/index.ts`) a bare `string`, the ticket type's *slug*, nothing else; the
`Order` type (F2) has no `ticketType` field whatsoever. So the only thing that ever survives
from "this catalogue document is marked demo" down into a real Firestore purchase record is the
**slug string itself**. That is why `DEMO_TICKET_TYPE_SLUG = 'demo-general-admission'` is a
reserved, fixed constant, not merely a naming convention left to whoever seeds the data — it is
the actual, sole recoverability channel for every position ever purchased against this ticket
type, and (by extension, via a `positions.orderId -> order.id` join, since orders carry no
ticket-type field of their own) for every order derived from it too. A future cleanup or audit
script finds every demo position with one query — `where('ticketType', '==',
DEMO_TICKET_TYPE_SLUG)` — collects the `orderId`s off those positions, and that is the complete
set of demo orders as well.

**Why the catalogue document gets a SECOND channel (`demo: true`) on top of the slug, given the
slug alone is what survives to Firestore:** defence in depth against the one failure mode a
slug-only marker can't defend against — a human or a future migration accidentally renaming the
Sanity document's slug (Sanity slugs are editable in Studio; nothing prevents it) without
realising it was load-bearing. With two independent, separately-stored fields, a single
accidental edit to either one still leaves the other intact. `isDemoTicketTypeDoc()`
(`lib/demo-ticket-type.ts`) checks both with OR logic specifically so that either survives the
other's loss — see "Why OR, not AND" below. `isDemoTicketTypeSlug()`, the function that actually
matters for Firestore positions/orders, has only ever had the one channel to work with, by
construction of the data model — this is stated plainly rather than glossed over, because it is
the real, narrower guarantee: **catalogue-level recoverability is defence-in-depth; Firestore-
purchase-level recoverability rests entirely on the slug never being reused for a real ticket
type.** `DEMO_TICKET_TYPE_SLUG` is reserved specifically so that never happens.

### Why OR, not AND

`isDemoTicketTypeDoc()` classifies a catalogue document as demo if `demo === true` **or** the
slug matches — not both required. Reasoning: the purpose of this classifier is *finding every
demo artefact for cleanup/audit*, where a false negative (missing a real demo document) is the
dangerous failure — a demo document that silently keeps looking "real" to an audit query is
exactly the scenario the standing P1 describes. AND logic would create that failure the moment
either channel drifts (a Studio edit clears the checkbox, or a future rename touches the slug).
OR logic means a demo document keeps being found as long as at least one channel still carries
its original value — proven directly by A3's mutations (2) and (3), each stripping one channel
while leaving the other intact.

## Price and capacity — the judgement call, made explicitly

**`DEMO_TICKET_TYPE_PLACEHOLDER_PRICE_ZAR = 10`. `DEMO_TICKET_TYPE_PLACEHOLDER_CAPACITY =
50`.** Neither is Council-approved — this is a real, filed open item
(`.agent/memory/project/needs-human.md`: "Real ticket prices and capacity from the council.
Every figure in the dataset is an invented placeholder"). This contract does **not** create a
second, conflicting placeholder for that item — the demo ticket type is explicitly not one of
the council's five real tiers (adult/pensioner/child/member/exhibitor); it is a sixth, marker-
tagged, never-publicly-listed entry that exists solely to make F12's purchase-and-scan proof
possible. Because the marker keeps it out of the public `/tickets` listing (see below) and out
of any real sales report a human would read, **this number does not need Council sign-off the
way the five real tiers' prices do** — nobody is quoted this price, nobody pays it expecting a
real seat.

**Why the price must be NONZERO, though — this is the one number in this contract that is not
arbitrary.** Spec §4.5, read directly for this contract: *"a R0 ticket (the Exhibitor category
today, and any future complimentary ticket) should not go through PayFast checkout and the ITN
webhook... PayFast's behaviour for a R0 transaction is unconfirmed."* If the demo ticket type's
price were R0, checkout's own comp/complimentary path — a real, already-designed branch in this
codebase — is the branch it would take, **never touching PayFast at all**. F12's entire stated
purpose is "a real human makes a sandbox ticket purchase... using demo ticket types from F9" and
proves the real gateway path (checkout → PayFast sandbox → ITN webhook → order/position
transition, wired by F10). A R0 demo ticket would make that proof exercise the wrong code path
entirely — hollow in exactly the way the architect brief warned against. **R10 is the concrete
number chosen: small (this is PayFast SANDBOX, not production — no real money moves regardless
of the figure, per `reference_saoc_credentials_inventory` / the PayFast sandbox signup notes in
`needs-human.md`), round, and nonzero.** `planDemoTicketTypeSeed()`'s A5 check asserts the
planned price is `> 0`, not merely `=== 10` — so a future edit changing the concrete figure
doesn't accidentally regress this property; the *nonzero-ness* is what's load-bearing for F12,
not the specific value.

Capacity (`50`) has no equivalent spec constraint forcing a specific number — it only needs to
be `> 0` (a `0`/missing capacity is rejected pre-write by checkout's own `isUsableAmount()`
gate, per `app/api/tickets/checkout/route.ts`'s existing behaviour). `50` is chosen as a round
number comfortably larger than any plausible number of test purchases across F12/F14's human
proofs, so capacity exhaustion never becomes an accidental blocker during testing.

**If Brad wants a different concrete number for either figure, both are single-constant edits**
(`DEMO_TICKET_TYPE_PLACEHOLDER_PRICE_ZAR` / `DEMO_TICKET_TYPE_PLACEHOLDER_CAPACITY` in
`lib/demo-ticket-type.ts`) — no contract or check needs to change, since A5 only pins the
*nonzero* property, not the literal value.

## Active-show scoping — proven against F1's already-shipped functions, not reinvented

The brief asks for real, injected-state, offline scoping proof. F9 does not add new scoping
logic: the demo ticket type is scoped by carrying an ordinary `show` reference field, exactly
like the five real ticket types F1 already backfilled. What F9's contract adds is the *proof*
that this mechanism genuinely does its job for THIS ticket type — `check-active-show-scoping.mjs`
imports the real `resolveActiveShow()` (`lib/show-resolution.ts`) and the real
`ticketTypeMatchesActiveShow()` (`app/api/tickets/checkout/route.ts`) and feeds them fixture
show-activation arrays: the demo type's own show active (purchasable), a different show active
instead (refused), and two shows simultaneously active — an ambiguous state `resolveActiveShow()`
already fails closed to `null` for (refused, not defaulted open). No live Sanity read, no
`Date.now()`, matching the injected-state pattern the brief names for F4's `ShowWindowLookup`
and F6's `verify`.

## A real, pre-existing gap this contract closes

Reading `app/(marketing)/tickets/page.tsx` and `sanity/queries.ts` directly (not assumed):
`activeTicketTypesQuery` is `*[_type == "ticketType" && active == true] | order(order asc){...}`
— **no `show` filter at all**, and (before this contract) no way to exclude anything. The page
fetches this list and renders every result as a real, purchasable "Buy Ticket" tile. This means
two things were true before F9: (a) a ticket type from a *past* show would still appear on the
public page today if left `active: true` (a pre-existing gap this contract does not attempt to
fix — out of scope, would touch checkout's own show-gate design, not F9's job), and (b) **had
F9 shipped only the `demo` boolean with no consumer reading it, the marker's stated purpose —
"prevent accidental presentation as real pricing to visitors" — would have been unmet.** A
schema field nobody reads doesn't protect a visitor from seeing a `(Demo)` tile with a `Buy
Ticket` button next to real ones. This contract closes that specific gap: `activeTicketTypesQuery`
gains `demo,` in its projection, and `page.tsx` filters the result through
`filterPubliclyListableTicketTypes()` before building `cardData`. `ticketTypeBySlugQuery` (used
by checkout itself) is deliberately **left unchanged** — F12's human tester still needs to
purchase the demo type by its known slug, directly; only the *public listing* is gated, not
purchasability.

## Door admission parity — what this contract does NOT prove

The brief asks: "a demo ticket must scan and admit at the door exactly like a real one... note
whether anything treats it differently, and if you cannot prove that offline, say so plainly."
Reading `lib/checkin.ts`'s `admit()` directly: its admission decision branches only on
`data['showId']` (wrong-show refusal) and `data['status']` (already-checked-in / unpaid
refusal) — it reads `data['ticketType']` exactly once, inside `toTicket()`, purely to populate
the returned display object, never as a branch condition. **As read today, nothing treats a
demo ticket differently at the door.** `check-door-admission-no-special-case.sh` (A8) encodes
this as a structural guard — greps `admit()`'s function body for any reference to `ticketType`
outside that one known display-only read — but this is explicitly labelled STRUCTURAL, not
BEHAVIOURAL, and here is why it cannot be more than that offline: `admit()` takes a live
Firestore `Transaction` (`db.collection('tickets').where('bookingRef','==',bookingRef).limit(1)`
chained on a real `getFirestore(initAdmin())` call). Faking that in-memory would mean
reimplementing a meaningful slice of the Firestore SDK's query-builder chain, and this repo
pins no local Firestore emulator (`firebase.json` has no `emulators` block; `firebase-tools` is
not a pinned dependency — verified before writing this contract, per the architect brief's own
instruction not to design a check needing one). **This gap is not silently accepted as
"probably fine" — F12 is exactly the milestone that proves it live**, against a real deployed
host and real Firestore: a demo ticket scans and admits, a second scan is refused
`already-checked-in`, both entries land in `checkinAttempts` with the correct outcome. If F12's
proof ever shows different behaviour for a demo ticket, that is real information this contract's
structural check cannot see.

## Zero authorization meaning — mirrors F6's A8 exactly

Holding a demo ticket must never grant a capability — the same property F6's A8 proves for a
recovery-link visitor, applied here to a buyer who purchased a demo ticket.
`check-zero-authorization-meaning.mjs` reuses the exact harness shape (a fabricated
`DecodedIdToken`-shaped object with no `admin` claim and no `roles` claim, checked against
every one of the seven live capabilities via the real `hasCapability()`/
`resolveRoleCapabilitiesForShow()`, against a deliberately generous show-window lookup so a
failure can only be explained by the identity itself carrying nothing grantable) plus one
defensive case F6's A8 didn't need: a token carrying **stray `demo`/`ticketType` fields**
directly (simulating a hypothetical future bug that tried to bridge "this person holds a demo
ticket" into the auth token, e.g. for a "grant door-staff to demo buyers for testing
convenience" shortcut) still resolves empty — proving `hasCapability()` never reads those
fields at all, because there is no code path in `lib/admin-auth.ts` that looks at anything but
`admin`/`email_verified`/`roles`.

## Every assertion and its defeating mutation

- **A1 (`pnpm type-check`).** Defeated by a type error anywhere in the new/changed files.
- **A2 (compiler fixture).** Defeated by: narrowing/widening `DemoTicketTypeSeedPlan` away from
  a real discriminated union; making `filterPubliclyListableTicketTypes()` non-generic (forcing
  callers to narrow their real Sanity response down to the marker fields alone first); any
  exported constant's literal type drifting.
- **A3 (marker recoverability).** Defeated by: `isDemoTicketTypeDoc()` requiring BOTH channels
  (AND instead of OR) — case (2) or (3) would then fail; `isDemoTicketTypeDoc()` being
  vacuously `true` for everything — case (4) would then fail; `isDemoTicketTypeSlug()` doing a
  loose/prefix match instead of an exact one — case (6) would then fail.
- **A4 (active-show scoping).** Defeated by any change to `ticketTypeMatchesActiveShow()` or
  `resolveActiveShow()` that lets a ticket type scoped to one show be purchasable while a
  different show is active, or that defaults an ambiguous activation state to "assume active".
- **A5 (seed-plan idempotency).** Defeated by: a seed plan that creates a duplicate demo
  document on a second run against the same show (case 2); a seed plan that lets an archived
  show's demo document block seeding the current show's own copy (case 3); a seed plan that
  ever plans a `price` or `capacity` of `0` (case 1d/1e).
- **A6 (public listing exclusion).** Defeated by: `activeTicketTypesQuery` never selecting
  `demo` (case a — the filter function would be correct in isolation but inert in production);
  `filterPubliclyListableTicketTypes()` ignoring the `demo` field (case b2); or filtering
  everything indiscriminately (case b3).
- **A7 (zero authorization meaning).** Defeated by any change that causes
  `resolveRoleCapabilitiesForShow()`/`hasCapability()` to grant a non-empty capability set to a
  demo-ticket-buyer-shaped identity, with or without stray `demo`/`ticketType` fields present.
- **A8 (door admission, structural).** Defeated by any future edit to `admit()` in
  `lib/checkin.ts` that adds a branch reading `data['ticketType']` as a decision condition.
  Explicitly NOT defeated by (and cannot detect) a behavioural difference that doesn't show up
  as a source-level branch — see "Door admission parity" above.
- **A9 (`pnpm lint`).** Defeated by any lint violation in the new/changed files.

## What this contract does NOT prove

- **Door-scan behavioural parity, live.** See "Door admission parity" above — A8 is structural
  only. F12 is where this becomes a real, live, human-verified claim.
- **The live end-to-end purchase itself** — a real human completing PayFast sandbox checkout,
  receiving a confirmation email, and having the position/order actually transition to `paid`.
  That requires F10 (the ITN re-pin, unbuilt as of this contract) and F11 (the confirmation
  email, unbuilt), and is F12's job to prove live.
- **Running `scripts/seed-demo-ticket-type.ts` for real.** This contract proves the *decision
  logic* (`planDemoTicketTypeSeed()`) the real script will call; actually invoking it against
  the live Sanity dataset is a human/deploy step, deliberately out of gate scope — see "Why the
  real seed script is unasserted" below.
- **That the public `/tickets` page correctly excludes ticket types from a genuinely different,
  past show** (as opposed to demo-marked ones) — that gap pre-dates F9, is a real and separate
  finding (see "A real, pre-existing gap this contract closes"), and is not this feature's job
  to fix; noted here so it isn't mistaken for something this contract already covers.
- **Firestore security rules** — no `firestore.rules` file exists in this repo as of this
  contract, matching every prior feature's README in this mission.
- **The final, Council-approved real ticket prices** for the five real tiers — unrelated to
  this contract's own price placeholder, already tracked in `needs-human.md`.

## Why the real seed script is unasserted

`scripts/seed-demo-ticket-type.ts` performs real Sanity writes (mirroring
`scripts/migrate-show-sales-fields.ts`'s shape: a real `@sanity/client`, `.env.local` read,
`--dry-run` support, `setIfMissing`/`createIfNotExists` semantics). The hard constraint for this
contract is absolute: **no check may create any document anywhere, in Firestore or Sanity** —
stated twice in the architect brief, and doubly important here because this feature is *about*
creating test artefacts; letting the contract that's supposed to guard test data become the
thing that leaks it would be a direct repeat of the standing P1. So the script's actual I/O is
never executed by any assertion — only its pure decision core (`planDemoTicketTypeSeed()`) is
gated, exactly the same split F1's `migrate-show-sales-fields.ts` and F4's
`admin-migrate-roles-plan.ts`/`parseMigrationArgs()` already established for this mission's
other write-performing scripts.

## Judgement calls made that the brief left open

1. **`DEMO_TICKET_TYPE_SLUG = 'demo-general-admission'`, `DEMO_TICKET_TYPE_NAME = 'General
   Admission (Demo)'`.** The brief left the exact name to "Brad's call" and only suggested a
   naming convention. A fixed, reserved, never-reused slug is what makes Firestore-level
   recoverability possible at all (see "The marker mechanism"), so the slug is treated as
   load-bearing and fixed by this contract; the display name is cosmetic and trivially
   renameable without touching any check (no check asserts on `DEMO_TICKET_TYPE_NAME`'s exact
   string).
2. **Price R10 / capacity 50.** See "Price and capacity" above — the nonzero-ness is the
   load-bearing property (proven by A5); the concrete figures are not Council-approved and are
   not intended to be, since the marker keeps this entry out of any real sales report or public
   listing a human would read.
3. **OR logic for `isDemoTicketTypeDoc()`, single-channel exact-match for
   `isDemoTicketTypeSlug()`.** See "Why OR, not AND" above — chosen to minimise false negatives
   (a demo artefact silently escaping future recovery), which is the failure mode the standing
   P1 actually describes.
4. **Closing the public-listing gap (`activeTicketTypesQuery` + `page.tsx` filter) was brought
   into F9's scope, not left as a separately-flagged gap.** Unlike F6's README (which flagged
   its own out-of-scope wiring gap and left it for a future feature to close), this one is
   closed directly here, because the architect brief's own design intent for F9 — "prevent
   accidental presentation as real pricing to visitors" — is not actually true without it; a
   marker nothing reads is not a mitigation, it is a false sense of one. `ticketTypeBySlugQuery`
   (checkout's own lookup) is left open on purpose so F12 can still purchase the type directly.
5. **`planDemoTicketTypeSeed()` dedups per-show (`slug` AND `show._ref` both matching), not
   globally by slug alone.** Chosen so a demo ticket type seeded for an old, archived show never
   silently blocks seeding a fresh one for the current show — proven by A5 case (3).
6. **Deterministic Sanity `_id` of `` `ticketType-demo-${activeShowId}` ``**, mirroring
   `scripts/migrate-show-sales-fields.ts`'s fixed-`_id` pattern (`ticketType-adult`, etc.) — lets
   `createIfNotExists`/idempotent-patch semantics work correctly across repeated real runs, and
   incidentally carries the word "demo" in the document ID too (a third, non-load-bearing,
   purely incidental legibility aid — no check relies on it).
7. **The manual/live gaps (door-scan parity, the real seed script's execution, the live
   purchase) are recorded here, in F9's own golden README, rather than proposing new mission
   F-items.** Architect scope is F9's contract; reassigning mission F-items is the
   orchestrator's/Brad's call, same precedent F5's and F6's READMEs set for their own
   manual-verification gaps.
