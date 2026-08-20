---
schema: athanor.mission/v1
slug: multi-line-item-cart
goal: 'Visitor ticketing purchase flow: multi-line-item cart, the four admission products,
  day selection and named attendees, and the booking contact block with the per-booking
  limit'
created_at: '2026-08-20T07:42:29.138799+00:00'
started_at: '2026-08-20T07:49:48.246148+00:00'
last_active_at: '2026-08-20T13:10:04.060528+00:00'
status: in_progress
cost_estimate:
  features: 6
  milestones: 3
  total_calls: 36
last_checkpoint:
  milestone: M2
  feature: F4
  ts: '2026-08-20T13:10:04.060528+00:00'
features:
- id: F1
  status: done
  title: Contract + goldens for N-line-item checkout and atomic multi-type reservation
  inline_brief: null
  started_at: '2026-08-20T07:49:48.245961+00:00'
  completed_at: '2026-08-20T07:55:15.640683+00:00'
  spec: Plans/valiant-squishing-thimble.md
  contract: contracts/contract-ticketing-multi-line-item-cart.yaml
- id: F2
  status: done
  title: Checkout API accepts N line items and reserves capacity atomically
  inline_brief: null
  started_at: '2026-08-20T07:55:16.212868+00:00'
  completed_at: '2026-08-20T08:06:13.108182+00:00'
  spec: Plans/valiant-squishing-thimble.md
  contract: contracts/contract-ticketing-multi-line-item-cart.yaml
- id: F3
  status: done
  title: Cart UI — select multiple ticket types and quantities, then check out
  inline_brief: null
  started_at: '2026-08-20T08:06:13.508161+00:00'
  completed_at: '2026-08-20T12:35:59.761355+00:00'
  spec: Plans/valiant-squishing-thimble.md
  contract: contracts/contract-ticketing-multi-line-item-cart-ui.yaml
- id: F4
  status: done
  title: The four admission products as ticket-type documents
  inline_brief: 'Early Bird, Day Visitor, Early-Bird Weekend Pass, Weekend Pass, VIP.
    Schema additions: an early-bird availability window, a released quantity, a requires-day-selection
    flag and a requires-attendee-names flag. Prices and capacities are PROVISIONAL
    until Lee-Ann returns the questionnaire — they live in one place, flagged, per
    .agent/memory/project/provisional-figures.md. Never render a provisional figure
    to a public page as settled fact.'
  completed_at: '2026-08-20T13:10:04.060261+00:00'
- id: F5
  status: pending
  title: Day selection and named attendees on positions
  inline_brief: 'Day Visitor positions carry a chosen day; VIP positions carry a named
    attendee. BLOCKED-ADJACENT: the real show dates are NOT known — 18-21 September
    2027 is an invented placeholder and Lee-Ann''s spec establishes Thursday-Sunday
    without calendar dates. Do NOT derive dates. Drive the day-picker from the show
    record so the feature ships data-driven and the dates drop in when she answers.
    Check-in must later validate the chosen day (Stage 5, not this mission).'
- id: F6
  status: pending
  title: Booking contact block and the per-booking ticket limit
  inline_brief: 'Replaces the single attendeeName/attendeeEmail pair with the council''s
    Section A1 block: name, surname, email, mobile, country, conditional province,
    town, postal code, referral source, and two separate consents. Enforce the 5-tickets-per-booking
    limit (spec §414) SERVER-SIDE — a client-side limit is not a limit. POPIA: the
    privacy page must remain accurate about what is now collected.'
milestones:
- id: M1
  title: Cart works end to end — API and UI
  features:
  - F1
  - F2
  - F3
  status: done
  gate_ran_at: '2026-08-20T12:37:11.523439+00:00'
  gate_result: pass
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
