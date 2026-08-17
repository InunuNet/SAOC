# Ticketing System — Foundation Spec

**Status:** Proposed. Not yet implemented. Autonomy is off on this work until Brad approves
this document — per this project's workflow rules, nothing here should be built without a
signed-off spec first.

**Revision note (2026-08-17, same day):** this revision folds in findings from a parallel
open-source ticketing survey (pretix, alf.io, Hi.Events — see §3). Two places explicitly
**reverse** a position taken in the first draft rather than quietly changing it: the
Order/Position data-model addition (§4.2) and per-show role scoping (§5.7), which supersedes the
first draft's "global roles, rely on `wrong-show` to narrow the risk" recommendation. Both
reversals are called out at the point they occur, with reasoning.

**Why this document exists.** Brad's words, 2026-08-17: *"I feel like we're patching this
ticketing system in bits and pieces. We need a proper full plan and we build a fully working
ticketing system that is scalable that we can then add additional features to. But we need the
base ticketing workflow to be dialed in before we try expand it."* Plus a second, related
requirement: SAOC staff (Lee-Ann, and others after her) need to be onboarded with access scoped
to what they actually do — not full admin by default.

This spec sets out the target architecture, the parts that must be right now because changing
them later is expensive, and what can safely be added incrementally on top. A single end-to-end
demo-show proof (checkout → PayFast → email+QR → door scan) remains the first thing built — but
as **Milestone 2 of this plan**, built on the corrected foundation, not as the whole deliverable.
Missions get derived from this document afterwards; this document is the plan they derive from.

---

## 1. Current state, with evidence

The system works today for exactly one show, one flat set of ticket categories, and one binary
admin/not-admin identity. Concretely:

| Claim | Evidence |
|---|---|
| Exactly one show exists in the data model | `lib/tickets-constants.ts:5` — `NATIONAL_SHOW_ID = 'nationalShow'`, a single hardcoded string constant, not a lookup |
| The checkout route accepts no other show | `app/api/tickets/checkout/route.ts:122` — `body.showId === NATIONAL_SHOW_ID` is a literal equality check, not membership in a set of known shows |
| Ticket types are not scoped to a show at all | `sanity/schemas/documents/ticketType.ts` — seven fields (name, slug, price, description, capacity, active, order), **no reference to a show document**. Every `ticketType` ever created is global, forever, across every year |
| One ticket = one admission, no group bookings | `app/api/tickets/checkout/route.ts:159` — `const REQUESTED_QUANTITY = 1;`, hardcoded, with a comment noting the comparison is "written in terms of the requested quantity" for a future that doesn't exist yet |
| Admin access is binary, not role-based | `lib/admin-auth.ts:55-61` — `isAdminToken()` is `admin === true && email_verified === true && isEmailAllowlisted(email)`. No `roles`, no scoping. Every one of the 6 gated surfaces (`/admin`, `/admin/door`, session mint, tickets list, checkin, CSV export) receives identical binary authorization |
| Refunds cannot be represented | `types/index.ts:128` — `TicketStatus = 'reserved' \| 'paid' \| 'cancelled' \| 'checked-in'`. No `refunded`. Already flagged as backlog P1, 2026-08-14 |
| No confirmation email or QR exists | `emails/TicketConfirmation.tsx` is written but imported nowhere; its own copy says "A PDF ticket with QR code will be available in a future update" |
| The payment security boundary is correctly isolated but not gateway-abstracted | `lib/payfast.ts` and `app/api/tickets/itn/route.ts` are PayFast-specific by name and by field shape throughout |
| The gateway decision is still open | `.agent/memory/project/backlog.md:157` — Peach leads, PayFast stays incumbent for 2027, Ozow as secondary under evaluation; decision is Brad's, deadline end of August 2026 |
| No Resend account is configured anywhere | `RESEND_API_KEY` absent from both `.env.local` and `apphosting.yaml` |
| No door-scan audit trail exists | Backlog P1 — refusals at the door are never logged server-side; there is no record of what was scanned, by whom, or when, beyond the single ticket document's own `checkedInAt` on a successful admit |

**What already works and should not be rebuilt:** transactional capacity checking with no oversell
(20-way concurrency tested), buyer-and-payload-bound idempotency, 60-bit booking references, lazy
30-minute reservation expiry, a door-admission decision table (`lib/checkin.ts`) that fails closed
on every unenumerated state, and a documented re-pin ceremony for the one payment security file
that must stay hash-pinned. See `docs/ticketing-hardening.md` for the full account. None of that
is touched by this spec except where explicitly noted.

---

## 2. Design principles

These are the rules the rest of this document is built to satisfy. State them once here so every
decision below can be checked against them instead of re-argued.

1. **The money boundary stays server-only, minimal, and pinned.** `app/api/tickets/itn/route.ts`
   remains the single place a ticket is marked paid. New capability (comps, a second gateway)
   gets its own route rather than growing this one's surface.
2. **Content and configuration live in Sanity; security decisions never do.** Show dates, ticket
   tier names and prices are editor-controlled. Who may check someone in at the door is not — that
   stays in Firebase custom claims, the same trust boundary `lib/admin-auth.ts` already uses.
3. **One `lib/admin-auth.ts`, extended, not duplicated.** Its docstring already states the
   principle this spec must preserve: *"Single home for the admin authorisation decision."* Adding
   roles must extend that one file, not create a second authorization surface that can drift from
   it.
4. **A ticket (position) document represents exactly one admission.** No quantity field on a
   ticket document, ever — this keeps `lib/checkin.ts`'s one-scan-one-admission model correct
   without any change to it. A purchase covering several attendees is represented by several
   ticket documents linked to one parent `order` (§4.2, adopted from prior-art research below) —
   the invariant is about the ticket document, not about how many a single purchase produces.
5. **Multi-show and multi-tier is a data-model problem, solved once.** The current single hardcoded
   `NATIONAL_SHOW_ID` is the one thing in this system that is expensive to retrofit under load
   (live tickets, a real event) rather than now (empty collections). Fix the shape before the 2027
   show generates the first real row that depends on the old shape.
6. **Don't hard-couple to PayFast in the schema.** The gateway decision is still open. Route logic
   can stay PayFast-specific for now — cheap to change later, it's five files. The *stored data*
   (Firestore documents that will exist forever, referenced by booking ref) is expensive to migrate
   later, so it gets gateway-neutral field names now even while only one gateway is wired.

---

## 3. Prior art considered: build-and-mine, not adopt

A parallel survey (via Alembic) evaluated pretix, alf.io and Hi.Events as candidates to adopt
outright instead of continuing to build in-house. **Verdict: build-and-mine, do not adopt.**

- No JS/TS-native event-ticketing project exists — every JavaScript-ecosystem hit surveyed turned
  out to be help-desk software, not event ticketing. Adopting any of the three real candidates
  means running a second runtime and a second database (pretix and Hi.Events are Python/PHP with
  their own SQL databases; alf.io is Java) alongside this project's Next.js/Firebase stack, for one
  show a year.
- **No South African payment gateway plugin exists for any of them.** pretix alone has 10+ payment
  plugins and zero cover Africa. Adopting saves nothing on the one piece of integration work that
  actually matters here (PayFast, or whichever gateway Brad picks), while costing a second stack.

This section is not a detour — the same survey's technical documentation is the direct source for
three real design changes adopted below (§4.2, §5.7, §7) and one correction to an assumption this
project had been carrying (§7's offline strategy). The recommendation is to keep building on this
project's own stack, informed by how a mature, purpose-built ticketing system (pretix in
particular — its documentation is the most complete of the three) actually shapes its data model,
its roles, and its offline behaviour, rather than reinventing those shapes from first principles.

Two claims surfaced by the same survey are explicitly **not** relied on anywhere in this spec,
because the survey could not verify them: Hi.Events' offline-mode claim (a marketing page only —
no technical documentation was reachable), and alf.io's or Hi.Events' role-permission granularity
(out of time for the analyst to assess). Treat both as open questions if they come up later, not
as settled facts.

---

## 4. Target data model

### 4.1 A real `show` document type, ticket types scoped to it

**The problem.** `ticketType` has no relationship to any show. Every category ever created (Adult,
Pensioner, Exhibitor, and whatever gets added for 2029) lives in one flat, unscoped list forever.
Capacity counts are already scoped by `showId` in Firestore, but the *catalogue* of what's sellable
is not — nothing stops a 2029 buyer from purchasing a ticket type that was only ever meant for
2027, because the concept "which show is this ticket type for" doesn't exist yet.

**The fix.** Introduce a `show` Sanity document type: `year`, `edition`, `startDate`, `endDate`,
`venue`, `salesOpen` (moved off the current `nationalShow` singleton onto this per-year document),
and an `active` boolean marking which single show is the one `/tickets` currently sells for. Add a
required `show` reference field to `ticketType`. Each ticket type belongs to exactly one show.

**Migration path, not a rewrite.** The existing `nationalShow` singleton becomes the **first**
`show` document — its `_id` can stay `nationalShow` for backward compatibility (booking refs and
Firestore `showId` values already in use, plus `NATIONAL_SHOW_ID` in `lib/tickets-constants.ts`,
keep working unchanged). `NATIONAL_SHOW_ID` becomes "the id of the currently active show,"
resolved by querying `show` documents where `active === true`, with `nationalShow` as the seeded
default. This is additive: nothing that works today breaks, and nothing about `lib/checkin.ts`'s
`showId === NATIONAL_SHOW_ID` check needs to change in shape — only in how that constant's value
gets resolved.

**Why this can't be deferred:** the moment a second show document exists with real ticket types
sold against it, retrofitting a `show` reference onto every historical `ticketType` and `tickets`
document is a real data migration against live purchase records — the exact kind of change this
project's own incident history (`docs/secret-corruption-incidents.md`) shows goes wrong under
pressure. Doing it now, against zero real transactions, costs a schema field and a query change.

### 4.2 Order / Position — a third level between show and ticket (adopted from pretix, 2026-08-17)

**This reverses part of the first draft.** The first draft of this spec treated "one ticket
document per admission, group bookings are just several ticket documents from one form submission"
as sufficient, with no linking entity between them. Reviewing pretix's actual data model
(docs.pretix.eu/dev/api/resources/orders.html) shows that's incomplete: pretix separates
**Product** (a sellable tier — our `ticketType`) → **Order** (one purchase transaction, one
payment) → **OrderPosition** (one individual issued ticket within that order, its own attendee
name, its own cancellation flag, its own secret). The missing piece in the first draft was the
middle layer — nothing anchored a single PayFast payment covering several attendees, and nothing
gave a refund a natural target narrower than "the whole purchase."

**The fix.** Add an `orders` Firestore collection, sitting between a `show` and its `tickets`:

- **`orders/{orderId}`** — `showId`, `buyerName`, `buyerEmail`, `amount` (total ZAR across every
  position in the order), `status: 'reserved' | 'paid' | 'cancelled'`, `expiresAt`,
  `idempotencyKey`, `purchasedAt`, `m_payment_id`, `gateway`, `gatewayPaymentId`, `pf_payment_id`.
  This is where every payment-facing field currently on the `tickets` document moves to — the
  order is what PayFast's ITN is actually about.
- **`tickets/{ticketId}`** (the position) — gains one new field, `orderId` (a reference to its
  parent order), and **keeps its own `bookingRef`**, `showId` (denormalized — see below),
  `attendeeName`, `attendeeEmail`, `ticketType`, `status`, `checkedInAt`. Cancelling or refunding
  one attendee in a group order changes only their position's `status`, never the sibling
  positions or the parent order.

**Why `showId` and `status` are deliberately denormalized onto the position, not only on the
order:** `lib/checkin.ts` reads one `tickets` document by `bookingRef` today, with no joins, and
that is exactly what makes it fast and simple enough to be provably fail-closed. Keeping the
door-facing fields directly on the position means **the door scanner's read shape needs zero
changes** — it still does `db.collection('tickets').where('bookingRef', '==', ...)` and gets back
everything it needs. Only checkout and the ITN route become order-aware; `lib/checkin.ts`,
`lib/booking-ref.ts`, and the door scanner UI are untouched by this change.

**What the order level anchors, concretely** — the three gaps the first draft's flat model left
unaddressed: **one confirmation email per order** (§6), listing every position's attendee name and
QR rather than sending one email per attendee for a single purchase; **a natural refund/cancellation
target at the position level** while still letting `manager`-tier staff answer "what did this buyer
actually buy" by looking up the order and seeing every sibling position (a real need called out for
the `manager` role in §5); and **the existing `idempotencyKey`**, which is already purchase-scoped
today, not ticket-scoped — it now lives correctly on the order it always conceptually belonged to,
instead of being duplicated onto every position.

**What this costs for Milestone 2.** Today's `REQUESTED_QUANTITY = 1` means every purchase is
already exactly one order with exactly one position. The ITN write path's mechanical change for M2
is small and well-understood: instead of flipping one document, it reads the order, and if
`reserved`, transactionally flips the order to `paid` **and** flips its one child position to
`paid` — two writes in one transaction instead of one, not a redesign. This is folded into the same
ITN re-pin ceremony already planned (§6) — it does not add a second reopening of the pinned file.
Full multi-position fan-out (flipping every position in a group order) is only exercised once group
booking actually ships (§9, deferred), but the schema is ready for it without a second migration.

**Why this belongs in Milestone 1, not deferred with group-booking UX itself:** retrofitting an
`orders` collection and an `orderId` foreign key onto tickets that already exist — with real
payment references pointing at the old flat shape — is the same class of expensive-later migration
as §4.1's `show` reference. The UI for buying more than one ticket at a time can wait; the shape
that UI will write into cannot.

### 4.3 `TicketStatus` gains `'refunded'` now

Add `'refunded'` to the `TicketStatus` union in `types/index.ts` in this milestone, even though the
refund *workflow* (calling a gateway's refund API, an admin UI to trigger it) is explicitly
deferred (see §9). With §4.2 adopted, a refund's natural target is now a single **position**, not
an order or a whole purchase — pretix's design point exactly: "you cancel one position, not a whole
order." The enum is baked into every stored ticket document forever; adding a value later is free,
but every ticket sold between now and "later" would need a status migration to represent a refund
correctly. This is the cheapest foundational change in this entire spec.

### 4.4 Gateway-neutral payment fields, alongside the existing PayFast ones

Add two new fields, now to the **`orders`** schema (moved there by §4.2 — payment happens once per
order, not once per position): `gateway: string` (e.g. `'payfast'`) and
`gatewayPaymentId: string | null`, populated identically to `pf_payment_id` for now. Keep
`pf_payment_id` exactly as it is on the order — this is additive, not a rename, so nothing that
reads `pf_payment_id` today needs to change beyond the order/position split itself. If Peach or
Ozow is chosen instead of or alongside PayFast, new orders carry `gateway: 'peach'` and the generic
field, without a second migration. The route-level logic (signature verification, field names)
stays PayFast-specific for however long PayFast remains the only integrated gateway — that part is
genuinely cheap to redo later, per design principle 6.

### 4.5 Comp / complimentary tickets bypass the payment gateway entirely

**The decision this spec makes now:** a R0 ticket (the Exhibitor category today, and any future
complimentary ticket) should **not** go through PayFast checkout and the ITN webhook. PayFast's
behaviour for a R0 transaction is unconfirmed, and forcing it through the payment security
boundary means that boundary now has to special-case `amount === 0` — scope creep on the one file
in this system that is deliberately kept as small and as rarely touched as possible.

Instead: a new authenticated route, `POST /api/admin/tickets/comp` (`manager` or `owner` role, see
§5), writes one order (`status: 'paid'`, `amount: 0`, `gateway: 'comp'`, `gatewayPaymentId: null`)
and one position (`status: 'paid'`) directly, plus a new `compedBy: string` field on the position
recording the admin's email for audit. Comps going through the same Order/Position shape as a paid
purchase — rather than a separate, differently-shaped document — is a direct benefit of adopting
§4.2: there is exactly one shape a ticket document ever has, regardless of how it was obtained.
This keeps the ITN route's scope exactly as it is today and gives comps their own, independently
auditable trail instead of laundering them through a payment webhook that was never designed to
receive R0.

### 4.6 What stays, and what the first draft got wrong

- Position-level fields (`bookingRef`, `attendeeName`, `attendeeEmail`, `ticketType`,
  `checkedInAt`) are unchanged in shape.
- Capacity, idempotency, reservation-expiry and booking-reference logic in
  `lib/data/tickets.ts` / `lib/booking-ref.ts` are conceptually unchanged — they already scope
  correctly by `showId`; once `ticketType.show` exists, the catalogue itself is also correctly
  scoped, closing the gap noted in §4.1. The checkout route becomes order-aware (§4.2) but the
  counting logic underneath it does not change.
- **Correction to the first draft:** it claimed group booking "needs no schema change" because
  multiple ticket documents could simply be created from one form submission with no linking
  entity. That was wrong — without an `orderId`, a group purchase has no natural anchor for a
  single PayFast payment covering several attendees, and no natural target for a partial refund.
  §4.2 is the correction; group-booking *UX* is still deferred (§9), but the schema it will write
  into is decided here, not later.

---

## 5. Role and permissions model

### 5.1 The gap, stated plainly

Today, granting Lee-Ann *any* admin access means granting her `admin: true` — the same boolean
claim that unlocks `/api/admin/export-csv`, which exports every buyer's name and email. There is no
way to give her a narrower ticketing-only capability set without also handing her every other
admin surface this system has, whether she needs it or not. That is a POPIA-relevant over-grant by
*default*, not merely untidy design — the fix below is choosing what she gets deliberately (§5.3
ends up including buyer-data export in her `manager` bundle anyway, per Brad's own "everything to
do with tickets" criterion, but as a scoped, named decision, not as an unavoidable side effect of
there being no other option).

### 5.2 Capabilities — the fixed, code-level permission set, decided now

**Revision note (2026-08-17, later same day):** Brad's direct question — *"what are the role names
and why are you waiting for me on this? Can we not just make them dynamic and set them on what the
council wants use later?"* — is right, and the earlier revisions of this section over-asked. This
revision separates two things the earlier drafts conflated: **capabilities** (this subsection),
which are fixed and genuinely foundational, and **roles** (§5.3), which are configurable and were
never something Brad needed to approve up front.

A **capability** is the atomic, fixed question a protected surface actually asks: "may this caller
do this specific thing." Capabilities are code, not data — a route must check a concrete, auditable
condition, and the fail-closed guarantee this project already relies on (`lib/admin-auth.ts`'s
docstring: *"fails closed on every unenumerated state"*) depends on that set being fixed, not
editable by anyone without a code change and review. Enumerated by walking every gated surface
(the six existing ones, plus the routes planned earlier in this spec):

| Surface | Capability required |
|---|---|
| `app/admin/page.tsx` | `view-admin-dashboard` |
| `app/admin/door/layout.tsx`, `POST /api/admin/checkin` | `scan-checkin` |
| `POST /api/admin/session` (session mint) | *none* — this is the authentication step itself (base `admin:true` + verified + allowlisted), not a capability check. Capabilities are checked per-action, after a session already exists. |
| `GET /api/admin/tickets`, exact-`bookingRef` lookup mode | `lookup-booking-ref` |
| `GET /api/admin/tickets`, name/email search mode | `search-buyers` |
| `GET /api/admin/export-csv` | `export-buyer-data` |
| `POST /api/admin/tickets/comp` (§4.5) | `issue-comp` |
| A future refund route (§9, deferred) | `issue-refund` |
| `POST /api/admin/tickets/sync` (§7.2's offline pre-sync, if built) | `scan-checkin` — reuses the door capability rather than inventing a new one, since only door staff need to prepare a device for offline scanning |

**The lookup capability is split in two, not one — this is a direct answer to an open capability
question, not a hypothetical.** Team lead put a real question to Brad: when a visitor arrives
without their QR, can a door volunteer look them up by name? Answered yes, every volunteer can
browse every buyer's name and email — exactly the POPIA exposure §5.1 exists to prevent. Answered
no, every lost-ticket case escalates to whoever is on site with broader access. Splitting the
single "lookup" surface into two capabilities means either answer is a **role-bundle change, not a
code change**: `lookup-booking-ref` is an exact-match lookup (safe — no browsing, cannot enumerate
buyers), `search-buyers` is a name/email search over the whole list (the actual POPIA-sensitive
operation). **This split has to be enforced inside the route itself, not only at the outer gate** —
`GET /api/admin/tickets` takes both an exact-ref query mode and a search-by-name/email mode, so the
route must check the capability matching whichever mode the request actually uses, not one
capability for the endpoint as a whole. A route that only gated the endpoint, not the query mode,
would let `lookup-booking-ref` silently unlock searching too.

Seven capabilities in total: `view-admin-dashboard`, `scan-checkin`, `lookup-booking-ref`,
`search-buyers`, `issue-comp`, `issue-refund`, `export-buyer-data`. This list is what's foundational
(§9) — it is the thing genuinely expensive to get wrong, because every route's fail-closed check is
written against it directly. Adding a wholly new capability later (as opposed to re-bundling
existing ones into different roles) is still a code change in two places: the fixed set itself, and
whichever role bundles in §5.3 should include it — re-bundling *existing* capabilities among roles
is the part that's pure config.

### 5.3 Roles — named, configurable bundles of capabilities

**Revision note (2026-08-17, later still):** Brad has since defined the actual role model, in his
own words: *"You will have like an admin role, somebody like me... Then you're gonna have a
management role, somebody like Lee-Ann, who can do everything to do with tickets and stuff, but not
necessarily everything to do with the actual website... And then we have like the assistants role,
which is the people that volunteer or get paid to assist on the day, operating the door check
in."* This supersedes the `door`/`box-office`/`full` placeholder names used in the previous
revision of this section — the capabilities-vs-roles split above is unchanged and is exactly what
makes swapping these names in trivial: it's the config-only change the split was built for.

A **role** is just a name for a set of capabilities, e.g. `manager = {view-admin-dashboard,
lookup-booking-ref, search-buyers, issue-comp, issue-refund, export-buyer-data}`. Roles are **not** baked
into route code anywhere — a route only ever asks "does this caller hold capability X," never "does
this caller hold role Y." This is what makes Brad's ask true: renaming a role, splitting one role
into two, or adding an entirely new one later (e.g. a narrower `door-supervisor` if the Council
wants one) is a **config change**, with no schema migration and no re-grant of any *other* role's
existing claims — as long as the fixed capability set in §5.2 already covers what the new role
needs. Only accounts holding the specific role being renamed or redefined need attention (see
§5.6).

**Final naming (2026-08-17, later still).** Brad delegated the naming call explicitly: *"Please
name things that would make sense for future developers and future AI sessions."* Final names:
`door-staff` (not `assistant` — see below), `manager` (unchanged), `owner` (not `admin` — see
below). One capability also renamed for consistency: `refund` → `issue-refund`, matching the
verb-object shape of every other capability (`issue-comp`, `export-buyer-data`, `scan-checkin`,
`lookup-booking-ref`, `search-buyers`, `view-admin-dashboard`) — a bare noun was the odd one out. No
other capability changed.

**Defaults, Brad's three tiers:**

```
door-staff = { scan-checkin, lookup-booking-ref }
manager    = { view-admin-dashboard, scan-checkin, lookup-booking-ref, search-buyers,
               issue-comp, issue-refund, export-buyer-data }
owner      = { view-admin-dashboard, scan-checkin, lookup-booking-ref, search-buyers,
               issue-comp, issue-refund, export-buyer-data }   // every defined capability
```

Mapped directly from his description:

- **`door-staff`** (was `assistant`) — "operating the door check-in," so `scan-checkin` is the core
  grant. "Assistant" didn't say what the person does, and reads oddly in a codebase AI sessions
  parse constantly; `door-staff` names the function and matches how Brad describes them aloud
  ("door operators"), and stays accurate if they also do a manual booking-reference lookup at the
  gate. Also given `lookup-booking-ref` by default (the *safe*, exact-match half of the lookup split
  above) so a volunteer can resolve the common "I don't have my QR" case without escalating every
  single one to a manager — **recommended, not yet confirmed with Brad**, and dropping it is a
  one-line change to this bundle if he'd rather every lost-ticket case escalate. `search-buyers` is
  deliberately withheld — that's the actual POPIA-sensitive browsing capability the split exists to
  gate.
- **`manager`** — unchanged; it's what Lee-Ann is, in the client's own words, and needs no
  translation. "Everything to do with tickets and stuff, but not necessarily everything to do with
  the actual website." Every ticketing-side capability, including `export-buyer-data` — Brad's own
  criterion is "tickets," and a buyer-data export is a ticketing operation, not a website one.
  Flagged for his explicit confirmation given it's the single most POPIA-sensitive capability, but
  the literal reading of his own description includes it. Also includes `scan-checkin`: "a few
  [managers] at the venue" means managers need door capability too, not just back-office access —
  the three tiers are not a strict subset ladder where each tier only adds capabilities the one
  below lacks.
- **`owner`** (was `admin`) — "the admin of the whole site can get to and do everything and
  anything." Every currently-defined capability, full stop. Renamed specifically to resolve a
  collision, in the cheaper of two possible directions (below) — not a stylistic preference.

**The collision this resolves, and why the fix is the role name, not the claim.**
`lib/admin-auth.ts` already has a base custom claim called `admin` (boolean — "is this token an
authenticated admin-panel user at all"), required by every one of the three tiers identically, and
load-bearing across everything `admin-auth-hardening` F1–F5 shipped, `admin-grant.ts` /
`admin-revoke.ts` / `admin-list.ts`, `docs/admin-access.md`, and the existing contracts. The
previous revision of this section had Brad's top tier also named `admin` as a **role** — same word,
two different claims, one boolean and one a string inside `roles[S]`'s array — and flagged it as a
point of confusion without resolving it, specifically to avoid silently renaming Brad's chosen word.
Renaming the *claim* to remove the collision would touch security-critical, already-shipped code for
purely cosmetic benefit — a bad trade. Renaming the *role* costs one word and was Brad's call to
make, which he has now made. **Net effect: `admin: true` now means exactly one thing — this account
passed the authentication gate — and no role name shadows it.** Stated explicitly so a future editor
does not "tidy up" by renaming the role back to `admin`.

**Naming conventions — write to this, don't invent a parallel style.**

- Roles are lowercase, hyphenated, and name the *person* or their function: `owner`, `manager`,
  `door-staff`.
- Capabilities are lowercase, hyphenated, verb-object, and name the *action* on the object:
  `issue-comp`, `export-buyer-data`, `issue-refund`.
- Role names never appear in route code — routes check capabilities only (§5.4 below states the
  mechanism; this is the naming consequence of it).
- No role may be named `admin`, to keep that word meaning the authentication claim and nothing
  else.

**Where the role→capability mapping lives — held firm, not left open.** A server-side TypeScript
constant module (e.g. `lib/admin-roles.ts`), not a Firestore document, and specifically **not**
Sanity content, even though Sanity already holds other configuration in this system. Design
principle 2 already draws this line — *"content lives in Sanity; security decisions never do"* —
and "who may export every buyer's name and email" is squarely a security decision: anyone with CMS
access must never be able to grant themselves `export-buyer-data` by editing a document. Against
the Firestore-document alternative specifically:

- **Cost, reviewed:** a version-controlled constant is visible in a diff and goes through the same
  code review as everything else touching `lib/admin-auth.ts`. A Firestore document's edit history
  is a Firestore audit log at best, not a reviewed change.
- **The hot-path argument from §5.4 applies here too, not only to where the claim itself lives.** A
  Firestore read per check-in scan, at an aerodrome with unconfirmed connectivity, to resolve what
  a role name means, is the same wrong trade §5.4 already rejects for the claim itself — there is no
  reason to reject it for the claim and accept it for the mapping resolving that claim.
- **Configurability doesn't require a database.** The property Brad actually asked for — change a
  role's name or contents without a schema migration or a mass re-grant — is fully satisfied by
  editing one file and deploying, which this project already does constantly for far more
  consequential surfaces (e.g. the entire pinned ITN route, under ceremony). A Firestore document
  buys live edit-without-deploy, which is not a property this decision needs and is a property that
  makes "who can export buyer data" editable by whoever can reach that document — a materially
  larger attack surface for a materially small convenience gain.

`door-staff`, `manager`, and `owner` (above) can still be renamed later by the Council (e.g. if
Lee-Ann's actual title is "Ticketing Secretary" and that reads better on an onboarding doc than
`manager`) — but honestly, not for free: the custom claim stores the role **name**, so a rename
requires (a) updating the constant module and deploying, and (b) re-granting the new name to every
account currently holding the old one (§5.6). Presented here as a small, quantified, deferred
config cost — not as a decision blocking Brad now, since the three tiers themselves are his own
words, not a placeholder waiting on him.

### 5.4 The `roles` claim — stores role names, custom-claims-based and per-show

Add a second custom claim, `roles`, granted alongside — never instead of — the existing `admin:
true` claim. `admin: true` keeps its current meaning unchanged: the base authentication gate,
required by every surface, exactly as `lib/admin-auth.ts` enforces today. `roles` becomes a
second, additive `AND` condition checked **per surface, against a capability** (§5.2), by first
resolving the claim's role names to capabilities via §5.3's mapping — never a fallback or an `OR`
against the existing checks.

**Shape** (unchanged from the previous revision): `roles` is a compact map keyed by show id, not a
flat array: `{ "nationalShow": ["door-staff"] }`, or, for org-wide access not tied to any one show,
the special key `"*"`: `{ "*": ["owner"] }`. This directly mirrors pretix's Teams model
(`all_events` vs. `limit_events: [ids]`, docs.pretix.eu/dev/api/resources/teams.html), and is the
mechanism §5.7 uses to solve per-event access properly rather than approximately.

```
admin:true AND capability(resolve(roles, S)) ⊇ { capability required by this surface }
```

where `resolve(roles, S)` unions the capabilities of every role name held under `roles[S]` and
`roles['*']` for the show being acted on, looking each name up in §5.3's mapping. **A role name not
present in the mapping resolves to the empty capability set — not an error, not a special case, just
what falls out of the lookup.** This is the answer to what happens after a rename: an account still
holding the old name `manager` after the mapping is renamed to `ticketing-secretary` loses every
capability that name used to grant, automatically, because the old name no longer resolves to
anything. **This fails closed by construction**, not by a special-cased check for "unknown role" —
the same fail-closed shape `lib/admin-auth.ts` already uses everywhere else.

Any surface with no explicit capability requirement defaults to requiring `export-buyer-data` (a
capability today only the `owner` and `manager` tiers hold) — the strictest option — never to
defaulting open. A missing or empty `roles` claim grants nothing beyond authentication; it is not
treated as "legacy, assume full."

**Why custom claims over a Firestore `adminRoles/{uid}` document** for the claim itself (distinct
from §5.3's question of where the *mapping* lives) — unchanged from the previous revision:

- It keeps the entire authorization decision inside the signed token, preserving the "single home
  for the decision" property `lib/admin-auth.ts` already documents as load-bearing. A
  Firestore-doc model creates a second authorization surface that could disagree with the token —
  exactly the kind of drift this project's existing design deliberately avoids.
- It costs zero extra reads on the hot path. `POST /api/admin/checkin` runs at the door, at a venue
  that is an aerodrome with unconfirmed connectivity (see §7) — adding a Firestore read to every
  scan for a role lookup is the wrong trade at exactly the place reliability matters most.
- The one real advantage of a Firestore-doc model — live, no-token-refresh-needed revocation — is
  already solved for the existing `admin` claim by `admin-revoke.ts` calling
  `revokeRefreshTokens()`, which invalidates the 5-day session cookie immediately rather than
  waiting for natural expiry. The same tool extends to `roles` at no new cost (§5.5).

**A real constraint the per-show shape must respect: Firebase custom claims are capped at ~1000
bytes total, across every claim on the token.** A per-show map costs roughly 20-30 bytes per entry
— trivial for one active show, but not something to let grow unpruned across a decade of shows. The
mitigation is operational, not automatic: §5.7's "revoke event-specific roles after each show"
practice keeps the map from accumulating stale entries, using the same extended `admin-revoke.ts`
tooling described in §5.6. This is stated explicitly here so it isn't discovered as a production
surprise in year four.

### 5.5 Preserving the fail-closed guarantee, and the 5-day staleness problem

`docs/admin-access.md` already documents that session cookies last 5 days
(`SESSION_DURATION_MS`) and that **revocation must explicitly revoke existing sessions, not
merely remove the allowlist entry.** This applies identically to a role downgrade: shrinking
someone from `{"*": ["owner"]}` to `{"nationalShow": ["door-staff"]}` must call
`revokeRefreshTokens()` at the moment of the change, exactly like a full revoke does today —
otherwise the old, broader role claim remains valid inside an already-issued session cookie for up
to 5 days. This is a hard
requirement on the tooling in §5.6, not an edge case to accept. **The same requirement applies to a
role rename** (§5.3, §5.6): the mapping change itself fails closed instantly for every affected
account (§5.4), but restoring their intended access requires the same re-grant-and-revoke tooling,
not a wait for natural session expiry.

### 5.6 Tooling changes

- `scripts/admin-grant.ts` gains a required `--role <name>` argument (repeatable — any name present
  in `lib/admin-roles.ts`'s mapping at grant time) and a required `--show <showId|*>` argument. No
  defaults for either — an operator must state both explicitly, so nobody is under- or
  over-provisioned by omission. `door-staff` and `manager` may only be granted scoped to a specific
  show, never `*` — see §5.7 for why that restriction is the point. `admin` may be granted either
  scoped or as `*`. The script validates the role name against the live mapping and refuses to grant
  an unrecognised name outright (fails closed at grant time too, not only at check time). Existing
  behaviour (claim-before-allowlist ordering, squatter-shape warning on `--existing`) is unchanged.
- `scripts/admin-revoke.ts` gains an optional `--role <name> --show <showId|*>` to remove a single
  role at a single scope (calling `revokeRefreshTokens()` regardless, per §5.5) rather than only
  supporting full revocation.
- `scripts/admin-list.ts` prints each account's full `roles` map alongside its existing fields, and
  **flags any role name held by a live account that no longer exists in `lib/admin-roles.ts`'s
  mapping** — the direct operational answer to "how does an operator find every account affected by
  a rename" without manually cross-referencing every account against the constant module by hand.
- **Role-rename procedure**, using the tooling above: (1) update `lib/admin-roles.ts` and deploy —
  every account holding the old name loses its capabilities immediately, fail-closed, per §5.4; (2)
  run `admin-list.ts` to find every account the flag above surfaces; (3) for each, grant the new
  name at the same show scope and revoke the old one, per §5.5's requirement. This is a deliberate,
  bounded operator task, not an automatic migration — a rename is rare enough (a Council naming
  preference, not a routine event) that automating step 2–3 isn't worth the added tooling surface
  yet; revisit if renames turn out to happen often in practice.
- **One-time migration:** every account that holds `admin: true` today (in practice, just Brad's)
  is explicitly re-granted `roles: {"*": ["owner"]}` as part of shipping this — not silently treated
  as full by a missing-claim default. This keeps the "no default beyond nothing" rule in §5.4 true
  from day one.

**Provisioning at volunteer scale — "tons of door operators" breaks the model above, and this is
the biggest new constraint from Brad's tiers.** Every account today needs three manual steps: a
Firebase Auth account, an entry in the deployed `ADMIN_EMAIL_ALLOWLIST` secret, and a claim grant.
That's fine for three staff and unworkable for thirty volunteers turning over every show. Four
things were weighed:

1. **Dropping the allowlist requirement for `door-staff` specifically, so the `roles` claim alone
   authorises door-only surfaces.** Rejected. The allowlist is a load-bearing, independent layer of
   the fail-closed guarantee, and `door-staff` is exactly the population where it matters *most*, not
   least — the highest headcount, the fastest turnover, and (being volunteers assembled on short
   notice) the least individually vetted. Removing a security layer specifically where volume and
   low vetting are both highest is backwards. Keep it for every tier, `door-staff` included.
2. **A self-service, per-show invite/join link that auto-grants the claim on redemption**, closer
   to how many SaaS products onboard bulk staff. Genuinely the most scalable option for "tons," but
   it's real new engineering (a token-issuance system, a redemption endpoint, and a new question of
   who may mint a token and how it expires) and a new trust boundary (a leaked invite link becomes a
   door credential). Worth naming as the option to build if bulk-grant tooling below still proves too
   slow in practice — not recommended to build now, ahead of any evidence it's needed.
3. **Batch/bulk grant tooling — recommended.** Extend `scripts/admin-grant.ts` to accept
   `--emails-file <path> --role door-staff --show <showId>` and grant all of them in one run,
   printing (not emailing — see the existing one-time-reset-link handling caveat) the batch of
   fresh-account reset links and a single, ready-to-paste addition to `ADMIN_EMAIL_ALLOWLIST`
   covering the whole batch. This reduces thirty manual runs and thirty separate secret edits to
   one of each, without touching the allowlist's role as a real, independently-checked gate — it's a
   batching of existing manual work, not a new mechanism.
4. **Reconsidering automatic per-show expiry — the deferral in §9 needs revisiting for `door-staff`
   specifically, and this changes the call.** With three staff, "an operator forgets to revoke" was
   a small, occasional risk. With thirty volunteers turning over every show, forgetting to revoke
   thirty accounts individually after every event is closer to a certainty than an edge case — this
   is Brad's own operating model validating exactly the risk §5.7 already reasons about, at a scale
   the earlier draft didn't anticipate. **Recommended addition to §5.4's `resolve()` function:** a
   per-show role grant (any tier, but `door-staff` is where this matters in practice) is only honoured
   while `now` falls within that show's own `startDate`/`endDate` window (§4.1), plus a small
   fixed buffer for setup/teardown days. This needs no new claim shape and no new tooling — it reads
   dates the `show` document already carries, and (since a show's dates change rarely) can be
   evaluated against a short-TTL cached value rather than a live read on every scan, preserving the
   hot-path/offline property §5.4 already argues for. Explicit early revocation (a volunteer removed
   mid-show for cause) still goes through `admin-revoke.ts` as normal — the date window is the safety
   net for the ordinary "just let it lapse" case, not a replacement for deliberate revocation. With
   Brad's "tons of door operators" operating model confirmed, this recommended default is now
   foundational (§9), not deferred.

**The `manager` tier spans two separate identity systems — document both halves as one onboarding
and offboarding procedure, don't try to unify them.** Ticketing access is this project's Firebase
custom claims, covered above. Sanity content access ("she does content") is Sanity's own project
members/roles system — a different admin surface entirely, with no connection to `lib/admin-auth.ts`
or the `roles` claim. **The `roles` claim does not, and cannot, govern Sanity access.** Granting or
revoking a `manager` therefore means two separate actions in two separate systems, and the risk this
spec calls out explicitly is offboarding: someone remembering to revoke the Firebase claim without
remembering the Sanity project-member removal (or vice versa) when a committee member leaves. See
§5.8 for the concrete two-system procedure — the fix here isn't a technical unification, it's making
sure both steps are written down as one checklist rather than living in two people's heads.

### 5.7 Per-show scoping — adopted from pretix Teams, reversing the first draft's position

**This reverses the first draft.** It originally argued per-show role scoping wasn't needed as a
first-class field: a `door-staff` role in 2029 left over from 2027 would have "nothing valid to
admit against" once the active show rotated, because `lib/checkin.ts`'s existing `wrong-show` check
already narrows what a stale role can do. That argument is still *true*, but it settles for a
narrower risk instead of removing it, and the reviewed prior art shows removing it costs almost
nothing extra: pretix's Teams model scopes access to specific events by design
(`all_events` / `limit_events: [ids]`, docs.pretix.eu/guides/teams/), precisely because "a
volunteer at the 2027 show should probably not retain door access in 2029" is exactly the scenario
that model exists to solve, not merely tolerate.

**Confirmed independently by Brad's own operating model, not just by prior art.** His description
of the `door-staff` tier — "the people that volunteer or get paid to assist on the day... tons of
door operators" — is, unprompted, exactly the churn scenario per-show scoping exists for. This
isn't a hypothetical edge case being designed around; it's how SAOC actually staffs a show, which is
a stronger justification for adopting the scoping than the prior-art citation alone.

**Adopted design:** §5.4's `roles` claim shape (a map keyed by show id, plus the `"*"` global key)
*is* the per-show scoping — there is no separate mechanism to add. Granting Lee-Ann `{"nationalShow":
["manager"]}` gives her manager capabilities (§5.3) for the 2027 show and nothing else; a 2029 show
under a different `showId` requires a fresh, deliberate grant. `door-staff` and `manager` roles are
restricted to show-scoped grants only (§5.6) specifically so a volunteer's — or even a manager's —
access cannot silently become permanent by being issued as `*` out of convenience.

**Recommended operational practice, not new code beyond §5.6's tooling:** revoke event-specific
roles after each show using the extended `admin-revoke.ts --role door-staff --show nationalShow`, the
same way committee membership already rotates — for `manager`, where headcount is small (§5.6).
**For `door-staff`, manual revocation alone is no longer recommended as sufficient** now that Brad's
own description confirms "tons of door operators" turning over every show: §5.6's lightweight
date-window lapse (checked against the `show` document's own dates, no new claim shape) is the
recommended default safety net for that tier specifically, with manual revocation staying available
for early/for-cause removal. Full automatic time-boxed claim expiry as a general-purpose mechanism
(independent of a show's own dates) remains deferred (§9) as unnecessary added complexity once the
date-window approach covers the actual scale problem.

### 5.8 Concrete onboarding and offboarding: Lee-Ann (`manager`)

**A limitation worth stating plainly before the walkthrough:** within today's fixed capability set
(§5.2), `manager` and `owner` are capability-identical — every ticketing capability `owner` holds,
`manager` holds too (§5.3). Brad's own distinction ("not necessarily everything to do with the
actual website") is real, but it lives almost entirely **outside this claim system's boundary**:
Sanity content access and infrastructure/console access, neither of which this `roles` claim governs
at all. So the negative control below tests **scope** (per-show vs. global), not a capability
Lee-Ann categorically lacks, because within this system there isn't one yet.

**Ticketing access (Firebase custom claims):**

1. Operator runs
   `pnpm exec tsx scripts/admin-grant.ts leeann@example.com --role manager --show nationalShow`
   (scoped to the 2027 show specifically, not `*` — see §5.7 for why). This creates the Firebase
   Auth account if none exists, applies `admin: true` plus
   `roles: {"nationalShow": ["manager"]}`, and (for a fresh account) marks the email verified and
   prints a one-time reset link — unchanged from today's `admin-grant.ts` behaviour otherwise.
2. Operator adds her email to `ADMIN_EMAIL_ALLOWLIST` in Secret Manager (deployed) — manual,
   unchanged, same trap noted in `docs/admin-access.md` about verifying the value actually parsed
   non-empty.
3. Lee-Ann signs in with **Google** at `/admin/login` — already code-complete and enabled per
   `docs/admin-access.md`'s "Google sign-in" section; no further console work needed for her
   specifically. (Microsoft and Apple are code-complete but not yet enabled in the Firebase
   console — irrelevant to onboarding Lee-Ann unless she specifically needs one of those
   providers.)
4. Verification is a real HTTP round trip, not a claim readback: confirm she reaches
   `/admin/door` and can check a ticket in for the 2027 show, and confirm `/api/admin/export-csv`
   succeeds for the 2027 show specifically. **The negative control is scope, not capability:**
   confirm a request for a *different* show id (a fixture, since no second show exists yet) is
   refused (`wrong-show` at the door, an equivalent scope refusal at the API level) — proving her
   grant is genuinely per-show and not silently global. Both outcomes are asserted, not just the
   happy path — matching this project's existing "every check needs a negative control" rule.

**Content access (Sanity project members) — a separate action, in a separate system:** grant
Lee-Ann membership on the Sanity project with whatever content-editing role Sanity itself offers
(outside this spec's scope — Sanity's own role model, not `lib/admin-roles.ts`'s). This step exists
here only to record that it's a *second, independent* grant, not a consequence of step 1 above.

**Offboarding — write down as one checklist covering both systems, since the risk here is
forgetting one half:**

1. Ticketing: `pnpm exec tsx scripts/admin-revoke.ts leeann@example.com --role manager --show
   nationalShow` (revokes the claim and forces session invalidation, per §5.5) and remove her from
   `ADMIN_EMAIL_ALLOWLIST`.
2. Content: remove her Sanity project membership, separately, in the Sanity dashboard.
3. Verify both: confirm `/admin/door` and `/api/admin/export-csv` now refuse her (ticketing side),
   and confirm she can no longer reach `/studio` with editing rights (content side). Neither
   verification substitutes for the other.

Self-signup on `/admin/login` is still open (`admin-auth-hardening`'s known, tracked hole). This
spec does not re-solve it — the claim-before-allowlist ordering and squatter-shape warning already
in `admin-grant.ts` are the existing, sufficient mitigation, and apply unchanged to role grants.

---

## 6. QR, email, and the ITN re-pin — still Milestone 2, now on the corrected model

Everything in the earlier ground-truth research still holds and is not re-litigated here:

- `app/api/tickets/itn/route.ts` is sha256-pinned; it is being reopened **once**, folding in the
  unwired inbound-signature algorithm (`generateNotifySignature` /
  `buildPayfastNotifyParamString`, already built in `lib/payfast.ts` but not called), the
  `parseOrderedFields` `continue`-vs-`break` divergence, the order/position two-write transaction
  from §4.2, and the new post-commit, try/catch-isolated call to a confirmation-email helper. One
  ceremony, per `@architect`'s authored expected file and adversarial security review, exactly as
  documented in `docs/ticketing-hardening.md`.
- QR generation happens at email-send time (not purchase time — the ticket isn't paid yet), as an
  inline data-URI image, not a hosted ticket page (a hosted page reachable by booking ref alone
  reintroduces the guessable-URL problem the status endpoint already avoids).
- **One confirmation email is sent per order, not per position.** A family buying four tickets in
  one purchase receives a single email addressed to the buyer, containing all four attendee names
  and all four QR codes (one per position's `bookingRef`) — not four separate emails. This is a
  direct consequence of §4.2's order level: the email-send trigger fires once, when the *order*
  transitions to `paid`, and iterates its child positions to build the QR list. For Milestone 2
  (single-attendee purchases only), this degenerates to exactly what was already planned — one
  email, one QR — so nothing about the M2 build is blocked on multi-attendee purchases existing.
- **The unsigned, random booking-reference QR is correct as designed — confirmed, not merely
  assumed, by the prior-art review.** See §7 for the offline-strategy implication this settles.
- `wrong-show` is a real security control and is not weakened to make a demo show easier to
  build — the demo now runs against the real `nationalShow`/`active` show (§4.1), with demo ticket
  types and buyer emails marker-tagged, exactly the pattern already used for
  `@harden-check.invalid` / `door-qr-check.invalid` fixtures.
- No Resend account is configured anywhere today — this blocks the *human* receipt of a real email
  in Milestone 2, independent of anything this spec or that milestone builds. Flag it early rather
  than letting it stall silently.

This section intentionally stays short — the detailed design for this slice was already produced
and remains valid; it becomes Milestone 2 below rather than being redesigned here.

---

## 7. Door offline strategy and check-in audit trail (adopted from pretix and alf.io research)

### 7.1 Correcting an assumption: unsigned QR secrets were never the weak option

An earlier pass through this problem implicitly treated the plain, unsigned booking-reference QR
as a placeholder pending something more "real" — a signed secret. The prior-art review shows that
assumption was backwards. pretix's own guidance is explicit
(docs.pretix.eu/guides/ticket-secrets/, quoted directly): *"If you are uncertain whether you need
to use this feature, it is very likely that you do not."* Ed25519-signed secrets solve a different
problem — events north of 25,000 tickets, or ones where a stolen scanner exposing its local
attendee database is unacceptable — neither of which describes a national orchid show. Signed
secrets are also, concretely, **worse offline**: pretix's recommended default (an unsigned random
secret validated against a pre-synced local device database) preserves attendee-name display and
previous-scan deduplication offline; a signed-but-syncless secret can only prove "this code was
issued," not "this code hasn't already been used," without also talking to a server. No change is
needed to this project's existing 60-bit booking-reference design (§6) — it was already the right
shape.

### 7.2 The offline strategy: pre-sync and local validation, not cryptography

The actual answer for a venue with unconfirmed connectivity (The Hangar, an aerodrome) is
operational, not cryptographic: **before doors open, the door device downloads the current show's
full paid-ticket dataset (bookingRef, attendeeName, ticketType, status) into local storage, and
validates scans against that local copy when the network is unavailable**, exactly the pattern
pretix's own field tooling (pretixSCAN) implements, including an explicit "don't synchronise
orders back" fully-airgapped mode for the most disconnected venues.

Concretely, this needs:

- A `POST /api/admin/tickets/sync` (or similar, gated on the `scan-checkin` capability per §5.2 —
  so any tier holding it, `door-staff` included, can prep their own device) that returns the full current
  active show's position dataset for client-side caching.
- Client-side offline storage (IndexedDB) plus a service worker for `/admin/door`, so the scanner
  keeps working with no network at all: unknown `bookingRef` → not-found; found, locally marked
  checked-in already → already-checked-in; found and paid → admit locally, and queue the resulting
  state change for the server.
- On reconnect, queued offline admissions are POSTed with an explicit `source: 'offline-queued'`
  marker. Mirroring pretix's `force` parameter reasoning
  (docs.pretix.eu/dev/api/resources/checkin.html: *"there's no point in validating them since they
  happened whether they are valid or not"*) — an offline scan already happened in physical reality;
  the server's job on sync is to **record it truthfully**, including the rare case where the same
  ticket was also scanned online elsewhere in the meantime, not to silently drop or silently
  overwrite the conflict. Reconciliation of that rare conflict is an operator action afterward, not
  an automatic decision the sync path makes for them.

### 7.3 Check-in audit trail — closes a known P1 gap, ships regardless of offline mode

A new `checkinAttempts` Firestore collection, written on **every** scan attempt — admits and
refusals alike, which is the part missing today (currently only a successful admit leaves any
trace, via `checkedInAt` on the ticket itself). Fields: `bookingRef`, `showId`, `deviceId`,
`outcome` (`admit` / `not-found` / `wrong-show` / `unpaid` / `already-checked-in`), `scannedAt`,
`source` (`'online'` / `'offline-queued'`), `syncedAt` (null until an offline entry is reconciled).

This closes the existing backlog P1 ("door check-in refusals are never logged server-side")
independent of whether full offline mode is ever built, and it's cheap: one collection write per
scan, on the same transaction that already writes the admission decision in `lib/checkin.ts`. It
ships unconditionally in Milestone 1.

### 7.4 What's foundational here vs. what waits for evidence

The **audit trail** (§7.3) ships now, unconditionally — cheap, closes a known gap, no dependency on
anything else in this section. The **full offline PWA** (§7.2's client-side cache, service worker,
and sync/reconcile machinery) is deliberately gated on Milestone 2 confirming it's needed, and the
reasoning is stronger than "unconfirmed risk" alone:

The expensive-to-change-later part of going offline is the **data shape**, not the client-side
machinery — and the shape already ships in M1. §7.3's `checkinAttempts` collection carries
`source` (`'online'` / `'offline-queued'`) and `syncedAt` from day one, specifically so that scan
history recorded before any offline mode exists is already in the shape offline reconciliation
will eventually need. Nothing has to be migrated when and if §7.2 gets built later — this is the
same test this spec applies everywhere else (§4.1's `show`, §4.2's `orders`): decide the shape now,
defer the feature. Offline passes that test as cleanly as those two do.

What doesn't pass that test, and is correctly deferred, is the machinery itself: a service worker
plus an IndexedDB cache plus a sync/reconcile path with real conflict semantics is genuine new
engineering with its own failure modes — an offline scanner that silently admits against stale
local data is a worse outcome than one that plainly fails to connect. Building that before
confirming The Hangar actually has a connectivity problem risks shipping a subtle wrong-admission
bug to solve a problem that may not exist, and the alternative is cheap: Milestone 2's human proof
is someone standing at the venue with a phone.

Sequencing: Milestone 2's human proof at the venue explicitly observes connectivity and offline
behaviour (already recommended in the first draft's risk table, and made a required, recorded
output of that milestone in §11 below — this project has already deferred this exact observation
twice, in `admin-auth-hardening` F6's brief and again since). If it surfaces a real problem, §7.2 is
already designed and gets built next, rather than improvised from scratch under deadline pressure
at that point. If The Hangar's connectivity turns out fine, §7.2 stays specified but unbuilt, and
only the audit trail ships — with no data migration owed to it either way.

**Reference architecture, not adopted now, kept on file:** alf.io-PI
(github.com/alfio-event/alf.io-PI), a Raspberry Pi door station that pre-downloads an encrypted
attendee list and decrypts per scan, purpose-built for genuinely zero-connectivity venues. Closer
to what would be needed if a browser PWA's offline cache turns out to be insufficient — not needed
given the current browser-based scanner already works online (verified live 2026-08-17).

---

## 8. Public buyer accounts and ticket self-service

### 8.1 The gap and Brad's requirement

"If a visitor buys a ticket from the website, they're going to have to have a basic account, otherwise we don't have any way of looking up a lost ticket. We need a basic user subscription account system as well — register, subscribe to newsletters, view purchased tickets. We will have to keep some user data."

The problem this addresses is real: today, a buyer who loses a ticket confirmation email (or the QR within it) has no way to recover it. The ITN webhook sends exactly one email per order (§6), and that's the only source the ticket exists in. Loss of that email is loss of the ticket.

The solution this section specifies is two-part, and it reverses an implicit assumption in the earlier draft that account-gating was necessary. **Lost-ticket recovery must not require an account.** Forcing registration before payment costs conversion at the worst moment — the checkout flow — and makes SAOC custodian of personal data beyond what the sale actually requires. The POPIA data-minimisation principle §5.1 already applies to staff access; it applies equally to the public side.

An *optional* buyer account layer addresses the rest of Brad's requirement — newsletter subscription, viewing purchase history across multiple shows, updating contact details — genuinely useful features that do require persistence beyond one order. The account design keeps it separate from the administrative model entirely, removing a privilege-escalation path that open Firebase Auth self-signup would otherwise create.

### 8.2 Lost-ticket recovery without an account — two mechanisms

**Mechanism (a): Signed, high-entropy order-access URL**

Every confirmation email (§6) includes a recovery URL that resolves the order and its positions without requiring authentication. The URL contains a signed, high-entropy token — the same entropy standard as `lib/booking-ref.ts`'s 60-bit booking references — scoped to exactly one order and its buyer. The token itself is **not** the booking reference — booking refs are spoken aloud at the door and printed on tickets, so they're not suitable as long-term secrets. Instead, generate a new 60-bit secret at order creation time, store it server-side on the order document (field: `recoveryToken`), and sign it with the same HMAC used elsewhere in this system (or introduce a dedicated signing key, per the ITN re-pin ceremony; the choice is a deployment detail). Clients cannot forge or guess the token — attempting a brute-force attack has exactly the same cost as attacking a booking ref.

Include the signed token in the confirmation email as a full-URL deep link, e.g. `https://saoc.co.za/tickets/recover?token=<signed>`. An unauthenticated GET resolves the token to the order document, displays every position's QR code inline, and allows the buyer to re-send the full email.

**Mechanism (b): Resend-my-tickets form**

A public form on the `/tickets` page (or reachable from an "I lost my ticket" link) takes an email address and re-sends the order-access link to that address. The form responds identically whether or not the email matched any order — no account-enumeration oracle (timing or text difference) — and is rate-limited at the IP and email level (e.g. 5 attempts per email per hour) to prevent abuse. Rate-limit hits are logged but don't expose an error message to the attacker; the response is the same "check your email" message in all cases.

This form itself doesn't require an account and doesn't create one. It's pure recovery — the same operation §6's email contains as a clickable link, but discoverable by email address when the email itself is lost.

**Why guest checkout stays the default path.** Neither mechanism above requires creating an account. The default flow is checkout as a guest — no registration screen, no password, no email verification beyond the ITN webhook sending the confirmation to the address provided at checkout. Account creation is presented as optional, not mandatory.

### 8.3 Optional buyer account layer — design and constraints

**The problem an account layer solves, narrowly defined:**

- Newsletter subscription (opt-in, not implied by purchase, and requires explicit consent with an `optInAt` timestamp per POPIA §5.1)
- Viewing purchase history across multiple orders and years
- Updating one's own contact details (e.g., phone number for venue coordination)

**The design:**

A new `buyers` Firestore collection, keyed by Firebase Auth `uid`. Each document holds:
- `email` (string) — the email used to register or claimed from a guest order
- `displayName` (string, optional) — the buyer's name, editable by themselves
- `newsletterOptIn` (object) — `{ optedIn: boolean, optInAt: timestamp | null, source: string }`, where `optInAt` is null if not opted in, and `source` records where the opt-in came from (e.g. `'signup-form'`, `'admin-granted'`) for auditability per POPIA
- `createdAt` (timestamp) — when the account was created

A **new, optional field on the `orders` document:** `buyerUid` (string | null). This field is null for every guest order created before an account exists for that email. When a buyer creates an account or claims an existing guest order by email match, `buyerUid` is backfilled on every existing order with matching `buyerEmail`.

**Claiming guest orders by email match (the linking mechanism):**

When a buyer self-registers or logs in for the first time, a background task (or an on-login hook) searches the `orders` collection for any document with `buyerEmail` matching the verified account email, and backfills `buyerUid` on all matches. This is the key design point: **an account owner doesn't manually "link" their past purchases — the system does it automatically by email.**

Rationale: forcing a buyer to explicitly claim orders would require a UI ("you have 3 past orders, link them now?") and would fail silently if skipped, leaving the buyer thinking they have no purchase history when they do. Automatic linking is simpler and more reliable.

**Email verification is load-bearing.** A buyer account is a self-registered Firebase Auth account. The email must be `email_verified === true` before any claim occurs — otherwise anyone could register as someone else's email address and inherit their purchase history (an account-takeover vector). This matches the same requirement `lib/admin-auth.ts` enforces for the admin side.

### 8.4 The hard security boundary — buyer accounts are NOT staff accounts

**This is the most critical part of this section.** A `buyers` document and the existence of a buyer account grant zero capabilities from §5.2's fixed set. A buyer account is a public self-registered Firebase Auth account, distinct from the staff authentication and role model.

**Negative control, enforced by contract:**

1. A freshly self-registered account with a `buyers` document must resolve to the empty capability set when checked against `lib/admin-roles.ts`. An attempt to access any admin surface (any route in `/api/admin/*` or `/admin/*`) must fail with the same authorization check every other unauthenticated or under-provisioned request fails with — specifically, `missing-capability` or equivalent, not a silent denial that masks the attack.

2. No public buyer-facing route (`/tickets/recover`, `/my-tickets`, `/my-account`, etc.) may ever consult `lib/admin-roles.ts` or check any admin capability. A buyer's access to their own data is authorized **only** on `buyerUid` match (or verified-email match for the recovery URL) server-side per request — never based on a custom claim.

3. No admin route may ever grant access or escalate privileges based on the mere existence of a `buyers` document. An admin checking a buyer's status at the door is an admin because of their `admin: true` claim and their role in the `roles` map — not because they happen to have an account in `buyers` too.

**Why this boundary exists.** Open Firebase Auth self-signup is already live (documented in the `admin-auth-hardening` mission). Without this boundary, creating a public buyer account becomes a foothold attack against the admin panel — self-register as a buyer, then try to escalate via a misconfigured capability check or a route that forgets to gate on admin claims. The fail-closed default in §5.4 protects *new* admin routes automatically — but says nothing about *new public routes* that might accidentally consult the admin role model by mistake. This section's hard boundary — buyer accounts and admin accounts are separate systems, full stop — is the thing that prevents a bridge attack ever existing.

### 8.5 Ownership check on the buyer's own data

A route like `GET /api/tickets/my-orders` (returns the authenticated buyer's own orders) must authorize on `buyerUid` match **per request**. Concretely:

```
if (req.user.uid !== order.buyerUid) { throw 403; }
```

The `buyerUid` is server-side state on the order document; the auth token provides `req.user.uid`. Compare them before returning the order.

For **unauthenticated access** — the recovery URL case — this is the only exception: an unauthenticated GET to `/tickets/recover?token=<signed>` is allowed *because* the token itself is the scope. The token resolves to one specific order, and any token-holder (including someone who found or stole the email) sees only that one order's positions and QR. Leaking the full order details to an unauthenticated token-holder is a deliberate, scoped exception — it's what the recovery flow requires. The token is not reusable for anything else; it's a one-off, read-only, time-limited (or at minimum, revocable) credential.

### 8.6 Newsletter: consent-recorded, not implied

The design in §8.3 includes `newsletterOptIn` as an object, not a boolean, specifically because consent is a record. An opt-in event has a timestamp and a source, and that's what POPIA requires: not just "is this person subscribed" but "when did they consent, and how."

**Opt-in is explicit, unticked by default:**

- At signup, a checkbox for "Subscribe me to SAOC news and event updates" is presented, **unchecked by default**. Checking it sets `optedIn: true`, `optInAt: <now>`, `source: 'signup-form'`.
- On the buyer's account page (if/when that UI exists), a toggle to manage newsletter subscription, with the same audit trail (updating `optInAt` if toggled on, clearing it if toggled off).
- An unsubscribe link in every newsletter email (if newsletters are sent), clicking it sets `optedIn: false` and logs `optInAt: null`.

**What newsletters do not do:**

- A purchase does not automatically subscribe anyone. Guest orders created without an account have no `newsletterOptIn` field.
- Creating a buyer account does not automatically opt the account into the newsletter, even if they're migrating past guest orders that had email addresses. The account starts `optedIn: false` — they must explicitly opt in.

**Dependency on Resend.** Newsletter *sending* is blocked on the same Resend provisioning that §6 already flags as a hard blocker — no Resend account exists. Newsletter *consent capture* is not blocked by it; the `newsletterOptIn` structure ships in M1 alongside the rest of the buyer-account shape, ready to store consents. When Resend is eventually configured, the consent records are already there.

---

## 9. Foundational now vs. safe to defer

**Foundational — change later is a real migration or a security redesign, do it in Milestone 1:**

- `show` Sanity document type + `ticketType.show` reference (§4.1) — the core scalability fix.
- The `orders` collection and `orderId` on ticket (position) documents (§4.2) — corrects a gap in
  the first draft; retrofitting this onto live purchase records is expensive, deciding the shape
  now against zero real transactions is not.
- `TicketStatus` gains `'refunded'` (§4.3) — free now, a migration later.
- Gateway-neutral `gateway` / `gatewayPaymentId` fields, now on the order (§4.4).
- The comp-ticket design decision: bypass PayFast entirely via a dedicated route, using the same
  order/position shape as a paid purchase (§4.5) — deciding this now avoids ever needing amount-0
  special-casing inside the pinned ITN route.
- **The fixed capability set (§5.2)** — `view-admin-dashboard`, `scan-checkin`,
  `lookup-booking-ref`, `search-buyers`, `issue-comp`, `issue-refund`, `export-buyer-data` (the
  lookup split in particular is what lets the still-open "can door-staff look someone up by name"
  question resolve as a role-bundle change either way, §5.2). This is the part of the
  role/permissions model that is genuinely foundational: every route's fail-closed check is written
  directly against this set, so it needs code review and a deploy to change, same as any other
  security-relevant constant.
- The `roles` custom-claim model, its per-show map shape, its AND-only composition with the
  existing `admin` claim, and the revoke-on-mutate tooling requirement (§5.4–§5.6) — retrofitting a
  role model onto live, in-use accounts is harder than designing it before any roles exist.
- **Contract coverage for `lib/admin-roles.ts`'s role→capability mapping, behavioural, not
  structural.** A grep over the file's text would assert its *declaration*, not its *effect* — this
  project shipped exactly that failure shape once already (a timeout fix that passed 24/24 while
  changing nothing, because every assertion checked a declaration instead of an outcome). The
  mapping needs assertions that actually resolve roles and inspect what comes back: (1) every
  capability in §5.2's fixed set is granted by at least one role, and no role bundle references a
  capability that isn't in that set — catches a typo in either direction, including the dangerous
  one where a typo'd capability name in a bundle silently grants nothing and nobody notices until
  someone can't do their job on show day; (2) resolving an unrecognised or renamed role name
  against the mapping returns the empty capability set, asserted by actually calling `resolve()`
  with a nonsense name, not by reading the fail-closed reasoning off the code; (3) **the negative
  control that matters most**: resolving `door-staff`'s bundle must not include `export-buyer-data`
  **or `search-buyers`** — with the lookup split in place (§5.2), the door-staff bundle must be
  barred from the buyer-search half specifically, not just from the bulk CSV export, since either
  one alone would let thirty volunteers browse buyer names and emails. Both assertions together are
  the machine-checkable form of §5.1's entire POPIA argument — the day either one goes red is the
  day someone quietly widened door-staff access to buyer data, and it should fail a contract gate,
  not wait to be noticed.
- **Explicitly NOT foundational: the specific role *names* and which capabilities each bundles
  (§5.3).** These live in one server-side constant module precisely so the Council can rename or
  redefine them later as a config change plus a bounded re-grant (§5.6's rename procedure) — no
  schema migration, no code review of route logic, no re-architecting the claim shape. `door-staff`,
  `manager` and `owner` are Brad's own three tiers, shipped as the starting defaults — not
  placeholders waiting on him, but still renameable by the Council later at the quantified cost
  §5.3 states.
- **Batch/bulk grant tooling for `door-staff` provisioning (§5.6)** — foundational because "tons of
  door operators" is Brad's stated operating model, not a hypothetical scale concern; the
  three-manual-steps-per-person model breaks the moment there are thirty volunteers rather than
  three staff, and this needs to exist before the first show tries to onboard them, not be
  discovered as a bottleneck on show morning.
- The check-in audit trail (§7.3) — cheap, closes a known P1 gap, and the collection shape is
  worth getting right before real staff start generating scan history in it.
- Preserving the one-ticket-one-admission invariant on the position document (no `quantity`
  field) — this is a foundational *constraint* (a thing NOT to build), not a feature.
- **The signed order-access URL (§8.2(a))**, because it ships as part of §6's confirmation email
  — the email is being built anyway in Milestone 2, and adding the recovery link later means
  either re-sending all emails already issued or stranding every order created before the link
  existed. Ship it with M1's email infrastructure decision.
- The `buyers` Firestore collection shape (§8.3) — `email`, `displayName`, `newsletterOptIn` with
  consent record, `createdAt` — and the optional `buyerUid` field on orders, backfilled at claim
  time.
- **The hard separation between buyer and admin account systems, enforced by contract assertion
  (§8.4).** A freshly self-registered account with a `buyers` document must resolve to the empty
  capability set when checked against `lib/admin-roles.ts`, and must be refused by every admin
  surface. This is a negative control on the privilege-escalation path that open Firebase
  self-signup introduces — foundational because retrofitting it later (trying to "untangle" mixed
  buyer/admin accounts) is a security redesign, not a feature addition. Contract assertion that
  must go red if the boundary ever blurs.

**Incremental — safe to add later without redesigning anything above:**

- The QR/email pipeline and the one-time ITN re-pin (§6) — genuinely first-in-line functionally,
  but architecturally independent of everything in §4–§5; it's Milestone 2 for sequencing reasons,
  not dependency reasons.
- Actual `manager`-facing screens (issue / look up / comp / refund UI) — the API surface and role
  gating get designed now; the UI itself is incremental.
- Group/family booking UX — now writes into the `orders`/`orderId` shape decided in §4.2, but the
  checkout form, quantity picker and multi-attendee input screens themselves are incremental.
- The full offline PWA for the door scanner (§7.2) — specified now, built only if Milestone 2's
  human proof at the venue shows it's actually needed (§7.4). The audit trail underneath it ships
  regardless.
- Day-pass date-aware door admission (a day-visitor ticket currently would admit on any day of a
  multi-day show, not just the day paid for). Deliberately deferred: doing this correctly means
  extending `lib/checkin.ts`'s decision table with a date dimension, and that table's simplicity is
  exactly what makes it provably fail-closed today. Revisit before 2027 if day-tiers turn out to
  differ meaningfully in access, not before.
- **General-purpose, independent-of-show-dates automatic role expiry** — deferred; the lightweight
  date-window lapse tied to the `show` document's own dates (§5.6) is foundational and covers the
  real scale problem (volunteer churn) at far lower cost than a standalone expiry mechanism would.
  A more elaborate, fully independent expiry system is unnecessary complexity unless the
  date-window approach proves insufficient in practice.
- A unified identity system spanning Firebase claims and Sanity project membership (§5.6, §5.8) —
  deliberately not attempted. The two systems stay separate; the fix is documenting onboarding and
  offboarding as one two-system checklist, not building a bridge between them.
- Actual second-gateway integration and refund-API wiring — both explicitly blocked on Brad's
  gateway decision (deadline end of August 2026) and, for refunds, on Council policy sign-off
  already tracked as a separate legal item in the backlog.
- Microsoft/Apple sign-in console enablement — code-complete per `admin-auth-hardening` F4/F5,
  purely a console step, unrelated to this spec.
- **Buyer account UI and self-service (§8)** — registration and login screens, "my tickets" page,
  "my account" settings page, newsletter preference toggle. The data shape and hard security
  boundary (§8.3–§8.4) ship in M1; the user-facing UI is incremental.
- The "resend my tickets" form (§8.2(b)) — falls out of M2's email infrastructure build, but the
  form UI itself is a small incremental addition to `/tickets`.
- Newsletter *sending* (§8.6) — blocked on Resend account configuration (same blocker as §6).
  Consent capture is M1; actual newsletter delivery waits.
- Social sign-in for buyers (Google, Microsoft, Apple) — code-complete per `admin-auth-hardening`
  but not yet wired to public signup flows; incremental once buyer account UI exists.

---

## 10. Risks

| Risk | Mitigation in this spec |
|---|---|
| Weakening `wrong-show` to make a demo show convenient | Explicitly rejected (§6) — demo runs against the real active show with marker-tagged data, not a second show id |
| A role/capability check accidentally becomes an `OR` fallback that grants access some other way | Explicitly specified as additive `AND` only, defaulting to the strictest capability when unspecified (§5.4) |
| Role downgrade doesn't take effect for up to 5 days (stale session cookie) | Revoke-on-mutate is a hard requirement on the extended tooling, not optional (§5.5) |
| Two authorization surfaces (claims vs. a Firestore doc) drift apart | Rejected the Firestore-doc option specifically because of this, both for the claim itself (§5.4) and for where the role→capability mapping lives (§5.3) |
| Per-show `roles` claim grows unbounded across years and hits Firebase's ~1000-byte custom-claim cap | Named explicitly (§5.4); mitigated operationally by revoking event-specific roles after each show (§5.7), using the same tooling that already exists for full revocation |
| A role gets renamed and existing claims silently keep whatever access the old name granted | Explicitly rejected: an unrecognised role name resolves to zero capabilities by construction (§5.4), so a rename fails closed automatically; `admin-list.ts` flags every account holding an orphaned name so the rename procedure (§5.6) can re-grant them deliberately |
| Anyone with Sanity/CMS access could grant themselves export or comp capability if the role→capability mapping lived in content | Rejected outright — the mapping lives in a server-side constant module, never Sanity, per design principle 2 (§5.3) |
| Thirty volunteer `door-staff` accounts per show make manual, one-at-a-time provisioning and revocation unworkable, and dropping the allowlist to compensate would remove a fail-closed layer exactly where headcount and turnover are both highest | Batch/bulk grant tooling recommended (§5.6) rather than weakening the allowlist; the allowlist requirement is explicitly kept for every tier, `door-staff` included |
| Thirty `door-staff` accounts left un-revoked after a show because an operator forgot, or didn't have time, to run thirty individual revoke commands | Lightweight date-window lapse tied to the `show` document's own dates, recommended as foundational (§5.6, §9) — the safety net for the ordinary case; explicit revocation via `admin-revoke.ts` remains available for early/for-cause removal |
| Offboarding a `manager` who leaves the Council only revokes their ticketing claim, leaving Sanity content access live (or vice versa), because the two systems are governed separately | Documented explicitly as a single two-system onboarding/offboarding checklist (§5.6, §5.8) rather than left to be discovered when someone leaves |
| A visitor-lookup-by-name capability, if granted broadly, lets every `door-staff` account browse the full buyer list (name + email) — the exact POPIA exposure this role model exists to prevent | Lookup split into `lookup-booking-ref` (exact match, safe) and `search-buyers` (browsing, sensitive) specifically so either answer to the still-open "can door-staff look up by name" question is a role-bundle change, not a capability redesign (§5.2, §5.3) |
| ITN route reopened more than once, each time re-triggering the full ceremony | All four known changes (signature algorithm, `break` fix, order/position two-write, email hookup) folded into one ceremony (§6) |
| R0 comp tickets forced through PayFast, requiring amount-0 special-casing inside the payment security boundary | Comps bypass PayFast entirely via a dedicated authenticated route, using the same order/position shape as a real purchase (§4.5) |
| Public buyer self-registration becomes a foothold for privilege escalation into admin surfaces — a public account with `buyerUid` match accidentally grants access to admin paths, or an admin route consults the buyer account to make authorization decisions | Hard separation enforced by contract: a `buyers` document grants zero capabilities from §5.2, any new admin route automatically defaults to the strictest capability (§5.4), public buyer routes never consult `lib/admin-roles.ts`, and an admin route never escalates based on `buyers` document existence (§8.4). The negative control in the contract assertion is non-negotiable: a self-registered account with `buyers` must be refused by every admin surface with no exception path. |
| A later multi-show migration has to touch live purchase records | `show` document type and `ticketType.show` reference introduced now, against zero real transactions (§4.1) |
| A later group-booking feature has to touch live purchase records to add a linking entity | `orders` collection and `orderId` introduced now, against zero real transactions (§4.2) |
| No Resend account configured — blocks real email delivery | Already flagged to Brad (`needs-human.md` item 5); Milestone 2 builds and fixture-tests the send path regardless, and records the gap explicitly if unresolved by the time of the human proof |
| Payment gateway decision still open, deadline end of Aug 2026 | Schema stays gateway-neutral now (§4.4); route-level PayFast-specific code is deliberately left as-is since it's the cheap part to redo later |
| Door connectivity at an aerodrome venue is unconfirmed | Offline strategy now specified (§7.2) rather than left as an open question, but deliberately not built until Milestone 2's human proof confirms it's needed (§7.4) — building unconfirmed-risk infrastructure now would be its own kind of waste |
| Building a full offline PWA before confirming the venue actually needs it | Explicitly sequenced as evidence-gated, not built in Milestone 1 (§7.4) |

---

## 11. Proposed milestone sequencing

Mission breakdown is deliberately left light here — it gets derived from this spec once approved,
per this project's workflow rules. This section exists to show the dependency order the sequencing
must respect.

- **M1 — Foundation.** `show` document type, `ticketType.show` reference, `nationalShow` migrated
  to be the first `show` document (backward compatible), the `orders` collection with `orderId` on
  ticket (position) documents, `TicketStatus` gains `'refunded'`, `gateway`/`gatewayPaymentId`
  fields added to orders, the fixed capability set (§5.2) and `lib/admin-roles.ts`'s role→capability
  mapping with `door-staff`/`manager`/`owner` as Brad's own starting, renameable tiers (§5.3),
  behavioural contract coverage of that mapping — every capability granted by some role, no bundle
  referencing a non-existent capability, unknown names resolving to nothing, and `door-staff` never
  resolving to `export-buyer-data` or `search-buyers` (§9) — the `roles` custom claim (per-show map
  shape) shipped with
  revoke-on-mutate tooling, the batch-grant tooling and date-window lapse for `door-staff`-scale
  provisioning (§5.6), and the one-time migration of existing admin accounts to
  `roles: {"*": ["owner"]}` (§5.4–§5.6), the check-in audit trail (§7.3), comp-ticket route design
  (route can ship now or in M2 — no hard dependency either way), the `buyers` Firestore collection
  shape and optional `buyerUid` field on orders (§8.3), the hard security boundary enforced by
  contract assertion (§8.4), and the signed order-access URL (§8.2(a)) production-ready to ship in
  M2's email. No user-visible change to `/tickets` yet. Fully contract-verifiable, no human
  required except the deliberate `salesOpen` decision already noted for any content flip.
- **M2 — The end-to-end demo proof**, built on the M1 model instead of the old hardcoded singleton:
  demo tiers (day-visitor, full-show) as `ticketType` docs scoped to the real active `show`,
  the folded ITN re-pin (signature fix + `break` fix + order/position two-write + email hookup),
  QR+email, and a human purchase-and-scan proof on the deployed host, recorded as evidence (Cloud
  Logging, Firestore status trail, door scan sequence) rather than a narrated claim.
  **Required, recorded exit criterion, not an opportunistic add-on:** this milestone must observe
  and record door connectivity at the venue (a phone on the network the show will actually use,
  noting whether it drops) as an explicit deliverable — the input §7.4's gating decision depends
  on. "We forgot to check" is not an acceptable M2 outcome: this exact observation has already been
  deferred twice (it was in `admin-auth-hardening` F6's brief and still hasn't been done), and a
  third silent deferral would mean §7.4's offline-PWA decision never actually gets made.
- **M3 — Role-based onboarding proven, buyer self-recovery functional.** Lee-Ann's real account,
  granted a real per-show `manager` role via the extended tooling, verified against real HTTP round
  trips including a required negative control — per §5.8, that control is scope (a different show
  id refused), not a missing capability, since `manager` and `owner` are capability-identical
  within this system today. Also proves the batch-grant path for `door-staff` at a small scale (a
  handful of test accounts, not yet thirty) before the first real show relies on it for volunteers.
  Additionally, M3 operationally proves the lost-ticket recovery path (§8.2): a test buyer loses
  their ticket email and successfully recovers it via the "resend my tickets" form, demonstrating
  both mechanisms (signed recovery URL and email-based form) work end-to-end.
- **M4+ — Incremental features**, each its own mission, none blocking the above: `manager`-facing UI,
  group booking (writing into the M1 order/position shape), day-pass gating, the offline PWA (only
  if M2 shows it's needed), refund workflow (gated on the gateway decision and Council policy), a
  second gateway if Brad's decision lands on one, a general-purpose automatic role expiry mechanism
  if M1's date-window lapse proves insufficient in practice, and the self-service per-show invite
  link (§5.6) if batch-grant tooling turns out not to scale past thirty volunteers either.

---

## Sources

- `docs/ticketing.md`, `docs/ticketing-hardening.md`, `docs/payfast-integration.md`,
  `docs/payfast-itn-signature.md` — current flow, security boundary, and the ITN re-pin ceremony
- `docs/admin-access.md`, `lib/admin-auth.ts` — current authorization model
- `docs/firestore-ticket-schema.md`, `types/index.ts`, `sanity/schemas/documents/ticketType.ts` —
  current data model (note: `docs/firestore-ticket-schema.md` is stale on `TicketType` — it still
  documents the retired hardcoded union; `types/index.ts` is the accurate source)
- `.agent/memory/project/backlog.md` — refund-state gap, gateway decision status and deadline
- `scripts/admin-grant.ts`, `scripts/admin-revoke.ts`, `scripts/admin-list.ts` — existing
  provisioning tooling this spec extends rather than replaces
- `.agent/memory/project/missions/2026-08-12-sandbox-ticket-proof.md`,
  `.agent/memory/project/missions/2026-08-14-admin-auth-hardening.md` — prior, paused work this
  spec's M2/M3 supersede
- **Prior-art research (2026-08-17, via Alembic):** pretix developer docs —
  docs.pretix.eu/dev/api/resources/orders.html (Order/Position model),
  docs.pretix.eu/guides/ticket-secrets/ (unsigned vs. signed ticket secrets),
  docs.pretix.eu/dev/api/resources/teams.html and docs.pretix.eu/guides/teams/ (per-event Teams
  and permission model), docs.pretix.eu/dev/api/resources/checkin.html (offline `force` check-in
  semantics); alf.io-PI — github.com/alfio-event/alf.io-PI (reference offline door-station
  architecture, not adopted). Hi.Events' offline claim and alf.io's/Hi.Events' role granularity
  were surveyed but could not be verified — not relied on above.
