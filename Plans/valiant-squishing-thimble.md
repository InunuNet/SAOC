# Plan — Orchid Exhibition Ticketing (First Slice)

## Context

The council delivered a draft ticketing specification (`Ticketing system overview - with details.docx`,
Drive `1fegrT9UKObJ71tUjUme_kFtqieSOsYca`, modified 2026-08-19). It is a 768-line developer spec and
is materially broader than anything previously scoped or priced — exhibition tickets, a cocktail
event, capacity-managed workshops, capacity-managed field trips, conference registration, per-guest
dietary and accessibility capture, emergency contacts, time-conflict detection, refunds, and a full
admin reporting layer.

Decisions taken during planning, which narrow this plan considerably:

- **Build one branch of the council's mind map at a time.** First slice is **Orchid Exhibition** —
  Visitors (Early Bird, Day Visitor, Weekend Pass, VIP) and Vendors (Exhibit, Food). Chosen because
  it is closest to what already works.
- **Packaging is deferred.** No workspace package, no host adapters, no content-repository
  abstraction. Revisit once SAOC works. Timelines don't allow a week of infrastructure work.
- **PayFast stays.** Not starting fresh on Ozow, not porting yet. Ozow cannot be started at all
  until SAOC has a merchant account (Ozow releases its integration manual only to committed
  merchants), and the gateway is not the critical path — nearly all the spec's work is
  gateway-agnostic.
- **A thin internal payment seam is worth one session.** Not a package — `lib/payments/` with a
  `PaymentProvider` interface and PayFast moved behind it. Three gateways are now in prospect
  (PayFast for SAOC now, Ozow as the council's preference, Peach for Brad's own site and the shop
  project), and all three are the same architectural shape: redirect to a hosted page, async webhook
  back. The interface is therefore designed against three real gateways, not one imagined one.

Intended outcome: a ticket-type catalogue to send Lee-Ann for indicative pricing, and a working
Orchid Exhibition booking flow.

---

## 1. Ticket Type Catalogue — to send to Lee-Ann

Prices marked `R___` are what we are asking for. Prices shown are the council's own provisional
figures from spec §B1, which they marked "final prices to be confirmed".

### Category A — Orchid Exhibition: Visitors  *(this slice)*

| # | Ticket Type | Provisional | Capacity | Still needed |
|---|---|---|---|---|
| A1 | Early-Bird Exhibition Ticket | R130* | Limited | **Cut-off date** and released quantity |
| A2 | Day Visitor Ticket | R150* | Uncapped? | Buyer picks a day — see date conflict below |
| A3 | Early-Bird Weekend Pass | R380* | Limited | Same cut-off as A1? |
| A4 | Weekend Pass | R400* | Uncapped? | **Which days is it valid for?** |
| A5 | VIP Ticket | R300* | Capped | Thursday 17:00–18:30. Spec wants named attendees |

### Category B — Orchid Exhibition: Vendors  *(this slice — largely already built)*

| # | Type | Status |
|---|---|---|
| B1 | Exhibit Vendors | Registration, review, payment and booth allocation already live |
| B2 | Food Vendors | Same flow — confirm whether pricing or booth rules differ |

### Category C — Conferences  *(later slice; separate system per spec §761)*

| # | Ticket Type | Price | Notes |
|---|---|---|---|
| C1–C2 | SAOC Symposium — Early Bird / Normal | R___ | Cut-off date needed |
| C3–C4 | WOSA Conference — Early Bird / Normal | R___ | Cut-off date needed |
| C5–C6 | SAOC/WOSA Joint — Early Bird / Normal | R___ | Discount on the pair? |

Commercial question attached to C3–C6: if SAOC sells WOSA tickets, SAOC's gateway receives WOSA's
money. That is an inter-organisation settlement arrangement, not a build decision.

### Category D — Additional Experiences  *(later slices)*

| # | Ticket Type | Price | Notes |
|---|---|---|---|
| D1–D2 | Sunset Cocktails — Single / Couple | R___ | Strictly 18+, guest names required |
| D3 | Workshop — per session | R___ | Each workshop its own product, own capacity |
| D4–D5 | Field Trip — Single / All Outings | R___ | Emergency contact becomes mandatory |

Workshops and field trips cannot be enumerated yet — the spec says details "will be provided as they
are confirmed".

---

## 2. What We Need Back From Lee-Ann

**Blocking this slice:**

- **The exact show dates.** Lee-Ann's spec describes a **Thursday–Sunday** show (VIP Thursday
  evening, day tickets Friday/Saturday/Sunday) and, per Brad's standing instruction, her document
  takes precedence over any older project data. The **18–21 September 2027** we have been carrying
  falls Saturday–Tuesday and cannot be right — those day-numbers were an invented placeholder, never
  council-confirmed (`docs/show-visitor-info.md:110` records the original as "an invented date
  presented as a live ticking fact"). Her doc establishes the weekday structure but not the calendar
  dates, so **the real dates must come from her — do not derive 16–19 September**, which would
  substitute a new invention for the old one. The Day Visitor day-picker and the VIP date are
  blocked until she answers.
- **Early-Bird cut-off date and released quantity**, and which days the Weekend Pass covers.

**Needed but not blocking:** prices and capacities per type; whether the 5-tickets-per-booking limit
(spec §414) applies to all types or only exhibition admission; cancellation and refund policy text;
booking terms and conditions.

**Conflicts to raise:**

- **No child, pensioner or SAOC-member ticket exists** in the new list, yet Section A asks for
  "Number of Children" and earlier council material had adult/pensioner/child/member. Are children
  free, or is a ticket type missing?
- **"Number of Adults / Number of Children" duplicates the ticket quantities.** Two sources of truth
  for the same number will disagree. Recommend ticket quantities are authoritative.

**Also for the council, time-sensitive:** if they want Ozow for this show, onboarding must start now.
There is no documented NPO path, and **card payments must be explicitly activated or international
attendees cannot pay at all**.

---

## 3. What Already Works, and What Is Genuinely New

The order lifecycle is sound and stays: reserve → PayFast redirect → ITN webhook → paid, with
idempotency keys, transactional capacity counting (`lib/data/tickets.ts`), booking reference, QR,
confirmation email, door check-in and audit trail. This path was proven live end-to-end (mission
`prove-ticket-purchase-works-end-to-end-b`, real mobile QR scan).

New work in this slice:

1. **Multi-line-item orders.** `app/api/tickets/checkout/route.ts:138-160` accepts exactly one
   `ticketType` and one attendee name/email per request. The `Order`→positions model already
   supports N positions; the request shape and reservation transaction do not. This is the core
   change.
2. **Four admission products** as `ticketType` documents, with an early-bird availability window and
   released quantity.
3. **Day selection** on Day Visitor tickets — a new field on the position, which check-in must then
   validate.
4. **Named attendees** for VIP tickets (per-position names), not required for general admission.
5. **Multi-day admission semantics.** This is the sleeper item. `lib/checkin.ts` flips a ticket to a
   terminal `checked-in` state and refuses any second scan. A Weekend Pass must admit on several
   days; a Day Visitor ticket on exactly one specified day; VIP only at the Thursday session.
   Check-in becomes per-day, not once-per-ticket-lifetime. The double-scan refusal must survive
   within a day while allowing admission across days.
6. **Booking contact block** (spec §A1) — name, surname, email, mobile, country, conditional
   province, town, postal code, referral source, and two separate consents. Replaces the current
   single `attendeeName`/`attendeeEmail` pair.
7. **Per-booking ticket limit** (5, per spec §414).

Deliberately **not** in this slice: workshops, field trips, cocktails, time-conflict detection,
conference registration, refunds, the reporting layer.

---

## 4. Build Sequence

Every stage runs the full chain (@architect contract + goldens → @dev → @qa → Codex GPT-5.5
cross-model review → @docs → contract gate → @maintainer).

**Stage 0 — Catalogue to Lee-Ann.** Send sections 1 and 2. No code.

**Stage 0b — SHIPPED 2026-08-19 (`66cb9f6`), gate 14/14.** `/privacy` rewritten (the false
"not shared with third parties" claim removed, real recipients disclosed), `/terms` extended with
conditions of sale, `/refunds` created with no fabricated figures, footer links all three.
`/terms` had existed since launch but was linked nowhere. All three carry a visible AI-draft notice.
Still open, both council decisions: the POPIA Information Officer designation, and the actual refund
terms. **Not yet deployed** — the pages do nothing for a merchant application until they are live on
the site the gateway reviews. Original scoping below.

**Stage 0b — Legal pages required for merchant approval. GATES THE GATEWAY.** Ozow's merchant
application requires them to review the live site and find three pages: **Terms & Conditions**,
**Privacy / POPIA policy**, and a **Refund / Cancellation Policy**. Brad confirmed this from Ozow's
own reply while trialling the application, 2026-08-19. Most South African gateways require the same,
so this is needed whichever provider is chosen — it is not Ozow-specific work.

All three currently fail, and two of them fail in a worse way than being absent:

- **Refund / Cancellation Policy — does not exist.** No route, no page. Its content is exactly what
  question 5 of the pricing artifact asks Lee-Ann for, so her answer feeds this page directly.
- **`app/(marketing)/privacy/page.tsx` (80 lines) is factually wrong now.** Written for a brochure
  site before ticketing existed. Its sections are *Data we collect / Cookies and analytics / Your
  rights / Questions*, and it states we collect only contact-form name, email and message, and that
  the information "is not shared with third parties". We now take buyer names, emails and phone
  numbers, pass them to a payment gateway, store orders in Firestore and send mail via Resend. It
  also has no Information Officer, no operator disclosures, no retention periods — the substance
  POPIA actually requires. This is a live inaccuracy about how personal data is handled, independent
  of the Ozow deadline.
- **`app/(marketing)/terms/page.tsx` (73 lines) says nothing about buying anything.** Its sections
  are *Use of this site / Content ownership / Disclaimer / Contact*. No conditions of sale, no
  ticket or admission terms, no event liability, no age restriction for the cocktail event.

Note this cancels the earlier "POPIA deferred until pre-launch" position — the gateway application
forces it now. Content and legal review are the council's, not ours to author unilaterally; what we
own is the pages, the routes and making them accurate about what the system actually does.

**Stage 1 — Payment seam (one session, standalone).** Define `PaymentProvider` in `lib/payments/`
(`initiate`, `verifyNotification`, `mapStatus`, `refund`) and move the existing PayFast logic behind
it — currently inlined at `app/api/tickets/checkout/route.ts:307-396` and
`app/api/tickets/itn/route.ts:103-263`. Done **separately and first**, before the cart work, so the
proven end-to-end purchase validates the refactor in isolation. Changing one thing at a time is the
whole point; bundling this into the cart rewrite would leave a regression with two candidate causes.

**Stage 2 — Multi-line-item cart.** Extend the checkout request to N line items, extend the
reservation transaction to reserve capacity across several ticket types atomically, and keep
idempotency-key replay behaviour intact. Highest-risk change in the slice.

**Stage 3 — The four admission products.** Ticket-type schema additions: early-bird window and
released quantity, a "requires day selection" flag, a "requires attendee names" flag. Day capture on
Day Visitor positions; VIP attendee names.

**Stage 4 — Booking contact block and the 5-ticket limit.**

**Stage 5 — Multi-day check-in.** Rework `lib/checkin.ts` from a terminal single-admission state
machine to per-day admission, preserving same-day double-scan refusal and the audit trail.

**Stage 6 — Vendors reconciliation.** Confirm the existing vendor flow covers both Exhibit and Food
vendors, and whether their pricing or booth rules differ.

**Stage 7 — Purge the placeholder show dates.** Triggered when Lee-Ann confirms the real dates.
`18–21 September 2027` / `2027-09-18` must be corrected in one pass, not piecemeal — it is written
into Sanity by `scripts/seed-page-singletons.ts:216` and `scripts/seed-show-visitor-info.ts:128`,
appears in `lib/data/events.ts:171`, drives the live home-page countdown, and is presented to
Lee-Ann herself as a *confirmed* value in `docs/show-visitor-info-for-editors.md:56`. Also in
`docs/show-visitor-info.md:189`, `docs/b4-national-show.md:57`, `docs/m3-home.md:14,36`,
`docs/dataset-residue-guard.md:83`. A partial fix leaves the countdown contradicting the site.
Same defect class as the CTICC venue placeholder.

---

## 5. Verification

- **Stage 1's gate is the existing live proof.** The PayFast sandbox purchase → ITN → confirmation →
  door check-in path must stay green through the seam refactor. There are 17 ticketing contracts and
  140 contract check files in `contracts/` covering signature algorithms, ITN source-IP handling,
  idempotency, capacity-transaction ordering and double-scan refusal — that corpus is the regression
  net.
- **New assertions must be observed failing against unfixed code before the fix is written.** This
  subsystem's dominant defect class is an assertion that tests presence rather than the actual
  property.
- **Multi-day check-in needs adversarial capacity and replay testing specifically** — it changes a
  state machine that currently fails closed by being terminal.
- **All UI verified in a real browser** (BrowserAgent at 1440 / 375 / 320px), per project rule.
  Contract greps cannot see a rendered page.
- **Codex GPT-5.5 cross-model review after every @qa pass**, no exceptions.

---

## 6. Open Questions

1. Show dates versus the Thu–Sun ticket structure — **blocks Stage 3**.
2. Whether children need a ticket type.
3. Whether SAOC receives WOSA money through SAOC's gateway (affects the later conference slice).
4. Ozow onboarding and card activation — council action, time-sensitive.
5. Commercial position: this spec is materially beyond the accepted proposal, and `backlog.md`
   already carries a P1 saying Spec V3 needs a scope-and-price conversation first.
