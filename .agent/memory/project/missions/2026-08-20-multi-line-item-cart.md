---
schema: athanor.mission/v1
slug: multi-line-item-cart
goal: 'Visitor ticketing purchase flow: multi-line-item cart, the four admission products,
  day selection and named attendees, and the booking contact block with the per-booking limit'
created_at: '2026-08-20T07:42:29.138799+00:00'
started_at: null
last_active_at: null
status: pending
cost_estimate:
  features: 6
  milestones: 3
  total_calls: 36
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features:
- id: F1
  status: pending
  title: Contract + goldens for N-line-item checkout and atomic multi-type reservation
  inline_brief: '@architect authors this BEFORE any code. Pin the current single-item request
    shape (CheckoutRequestBody / isValidCheckoutBody, checkout/route.ts ~138-160) as the baseline,
    then specify the N-line-item shape. Non-negotiable invariants that must survive and be
    asserted: showId must equal the pinned NATIONAL_SHOW_ID (an unvalidated showId picks a
    fresh always-empty capacity ledger and bypasses the gate entirely); prices come from the
    server, never the request; readiness(''initiate'') keeps its position before the reservation
    write with its verdict gating a pinned 500; the RECOVERY_TOKEN_SECRET fail-closed guard
    precedes the write; an idempotency key replayed with N line items must not double-reserve.
    Decide and justify: what happens when one line item fits and another does not (must be
    all-or-nothing AND observably so, never silently partial), and a pinned maximum line-item
    count with a reason derived from Firestore transaction limits rather than discovered in
    production. Every assertion must be observed failing first.'
- id: F2
  status: pending
  title: Checkout API accepts N line items and reserves capacity atomically
  inline_brief: '@dev implements against F1''s goldens only. Extend the request shape and
    the reservation transaction to reserve across several ticket types in ONE transaction.
    Idempotency-key replay behaviour must remain correct. No change to readiness, the recovery
    guard, or the amount/price authority. This is the highest-risk change in the ticketing
    slice per Plans/valiant-squishing-thimble.md.'
- id: F3
  status: pending
  title: "Cart UI \u2014 select multiple ticket types and quantities, then check out"
  inline_brief: "The API is useless to a buyer without this. Mobile-first from 320px, loading\
    \ and error states mandatory, every interactive element labelled and keyboard-operable.\
    \ MUST be verified in a real browser by BrowserAgent at 1440/375/320 \u2014 contract greps\
    \ cannot see a rendered page, and this project has shipped a green gate over invisible\
    \ input fields before."
- id: F4
  status: pending
  title: The four admission products as ticket-type documents
  inline_brief: "Early Bird, Day Visitor, Early-Bird Weekend Pass, Weekend Pass, VIP. Schema\
    \ additions: an early-bird availability window, a released quantity, a requires-day-selection\
    \ flag and a requires-attendee-names flag. Prices and capacities are PROVISIONAL until\
    \ Lee-Ann returns the questionnaire \u2014 they live in one place, flagged, per .agent/memory/project/provisional-figures.md.\
    \ Never render a provisional figure to a public page as settled fact."
- id: F5
  status: pending
  title: Day selection and named attendees on positions
  inline_brief: "Day Visitor positions carry a chosen day; VIP positions carry a named attendee.\
    \ BLOCKED-ADJACENT: the real show dates are NOT known \u2014 18-21 September 2027 is an\
    \ invented placeholder and Lee-Ann's spec establishes Thursday-Sunday without calendar\
    \ dates. Do NOT derive dates. Drive the day-picker from the show record so the feature\
    \ ships data-driven and the dates drop in when she answers. Check-in must later validate\
    \ the chosen day (Stage 5, not this mission)."
- id: F6
  status: pending
  title: Booking contact block and the per-booking ticket limit
  inline_brief: "Replaces the single attendeeName/attendeeEmail pair with the council's Section\
    \ A1 block: name, surname, email, mobile, country, conditional province, town, postal\
    \ code, referral source, and two separate consents. Enforce the 5-tickets-per-booking\
    \ limit (spec \xA7414) SERVER-SIDE \u2014 a client-side limit is not a limit. POPIA: the\
    \ privacy page must remain accurate about what is now collected."
milestones:
- id: M1
  title: "Cart works end to end \u2014 API and UI"
  features:
  - F1
  - F2
  - F3
  status: pending
- id: M2
  title: Real products, with day and attendee capture
  features:
  - F4
  - F5
  status: pending
- id: M3
  title: Booking contact block and limits enforced
  features:
  - F6
  status: pending
---

# Mission: Visitor ticketing purchase flow

## Context

Stage 2-4 of `Plans/valiant-squishing-thimble.md`, taken as one aggressive mission rather
than three sequential ones. Stage 1 (the payment seam) shipped 2026-08-20 as
`payment-provider-seam` and is proven live with a real purchase.

**What already works and must not regress.** The order lifecycle is sound: reserve ->
gateway redirect -> ITN webhook -> paid, with idempotency keys, transactional capacity
counting, booking reference, QR, confirmation email, door check-in and audit trail. It was
proven end-to-end live, most recently as `SAOC-2027-EAS2GC19BG1K` on 2026-08-20. That path
is the regression net for everything here.

**The core gap.** `app/api/tickets/checkout/route.ts` accepts exactly ONE `ticketType` and
one attendee per request. The `Order` -> positions model already supports N positions; the
request shape and the reservation transaction do not. Everything in M1 follows from that.

## Deliberately NOT in this mission

Workshops, field trips, cocktails, time-conflict detection, conference registration,
refunds, the reporting layer, and multi-day check-in (Stage 5 — it reworks `lib/checkin.ts`
from a terminal single-admission state machine to per-day admission and deserves its own
mission).

## Known blockers, and how each is worked around rather than waited on

- **Real show dates are unknown.** `18-21 September 2027` is an invented placeholder;
  Lee-Ann's spec establishes Thursday-Sunday but no calendar dates, and deriving 16-19
  would swap one invention for another. F5 therefore drives the day-picker from the show
  record so it ships data-driven and her dates drop in when they arrive.
- **Prices and capacities are provisional.** Web-team estimates, contained in
  `.agent/memory/project/provisional-figures.md`, flagged, replaced wholesale when the
  questionnaire returns.
- **No child / pensioner / member ticket exists** in the council's new list, yet Section A
  asks for "Number of Children". Raised, unanswered. Build the five products specified;
  do not invent a sixth.

## Standard for assertions in this mission

Last night's `payment-provider-seam` found four assertions green while testing nothing, and
Codex found two real production defects that survived a green 14-assertion gate — one that
could mark an order paid for money never received, one that accepted a one-cent
underpayment. Read `.agent/memory/project/learned.md` and
`specs/dead-assertion-sweep/findings.md` before writing a single check.

For every assertion: **if the defect it guards against were present, would it still pass?**
If yes or unclear, rewrite it. The model to copy is `admin-signout-revocation` A6 — where
buggy and fixed code both returned HTTP 200, it measured a second independent observable the
bug could not fake. Every behavioural claim needs a negative control proving the harness
itself can fail. Every check file must be registered in a contract.

## Notes
