---
schema: athanor.mission/v1
slug: ticketing-pages
goal: Build the complete public ticket-purchase flow for the 2027 National Show —
  CMS-controlled pricing, a real buy page, confirmation and cancellation landings,
  and a scannable emailed ticket that closes the loop with the existing door scanner
created_at: '2026-08-11T18:45:00.000000+00:00'
started_at: null
last_active_at: null
status: pending
cost_estimate:
  features: 7
  milestones: 4
  total_calls: 15
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features:
- id: F1
  inline_brief: Move ticket pricing out of the hardcoded PLACEHOLDER_TICKET_PRICES
    map in the checkout route into Sanity, so Lee-Ann sets prices and capacity herself.
    Add a ticketType document schema (name, slug, price, description, capacity, active,
    order) and salesOpen/salesMessage fields on nationalShow. Amount MUST still be
    derived server-side from Sanity — never from the client. Sales default to CLOSED.
    Seed the five real council categories with today's placeholder values clearly
    marked provisional.
  title: CMS-controlled ticket pricing, capacity and a sales-open switch
  status: pending
  milestone: M1
- id: F2
  inline_brief: Build /tickets — the public buy page. Ticket-type selection with prices
    from Sanity, attendee name/email capture, client + server validation, POST to
    /api/tickets/checkout, then auto-submit the returned signed field set to PayFast.
    Honour the sales-open switch and per-type capacity. Full loading, error, disabled
    and sold-out states. Uses the Sage & Paper design system only — no new colours,
    fonts or tokens.
  title: /tickets — the buy page
  status: pending
  milestone: M2
- id: F3
  inline_brief: Build /tickets/confirmation, the PayFast return_url landing. CRITICAL
    correctness trap - the buyer lands here via browser redirect, which races the
    server-to-server ITN, so the ticket is very often still 'reserved' not 'paid'
    at first paint. Must show an honest pending state and poll a new read-only status
    endpoint rather than claiming success or failure prematurely.
  title: /tickets/confirmation — return landing that handles the ITN race honestly
  status: pending
  milestone: M2
- id: F4
  inline_brief: Build /tickets/cancelled, the PayFast cancel_url landing. Explain
    nothing was charged, offer a clear route back to /tickets, and leave the reserved
    Firestore doc in a documented state. Small page, but it is a live PayFast URL
    today and currently 404s.
  title: /tickets/cancelled — cancellation landing and recovery path
  status: pending
  milestone: M2
- id: F5
  inline_brief: On confirmed payment, email the buyer their ticket via Resend, carrying
    the booking reference as a QR code. This CLOSES THE LOOP with the existing door
    scanner at /admin/door, which reads a QR containing the bookingRef and today has
    nothing to scan. Includes a printable/saveable ticket view. Email send must never
    be able to break or reverse the ITN write.
  title: Emailed ticket with a QR code the door scanner can actually read
  status: pending
  milestone: M3
- id: F6
  inline_brief: Adversarial QA across the whole flow plus an accessibility and responsive
    pass from 320px up. Every interactive element labelled, keyboard-operable and
    focus-visible. Probe the payment security boundary specifically - client-supplied
    amount tampering, replayed ITN, double submit, capacity oversell, and the sales-closed
    bypass.
  title: Accessibility, responsive and payment-security hardening pass
  status: pending
  milestone: M4
- id: F7
  inline_brief: Document the flow in docs/ticketing.md, add SITE_URL and any new env
    vars to apphosting.yaml and .env.local.example, and write plain-language notes
    for Lee-Ann on setting prices, opening sales and reading the door scanner. Record
    the go-live checklist that still needs SAOC's own PayFast merchant account.
  title: Documentation, deploy config and secretary handover
  status: pending
  milestone: M4
milestones:
- id: M1
  title: Prices and sales state are controlled by the client, and cannot go live by
    accident
  features:
  - F1
  status: pending
- id: M2
  title: A visitor can buy a ticket end to end against the PayFast sandbox
  features:
  - F2
  - F3
  - F4
  status: pending
- id: M3
  title: The buyer gets a scannable ticket and the door can admit them
  features:
  - F5
  status: pending
- id: M4
  title: Production quality — accessible, responsive, hardened, documented
  features:
  - F6
  - F7
  status: pending
---


# Mission: Build the National Show ticketing pages

## Context

**Brad's directive, 2026-08-11 evening.** Build the ticketing pages properly — "not placeholder
pages, proper beautiful pages."

The payment machinery already exists and is hardened. What does not exist is any way for a human
to use it. There is no `/tickets` route anywhere in the app. `return_url` and `cancel_url` point
at `/tickets/confirmation` and `/tickets/cancelled`, both of which **404 today**. The PayFast
sandbox was configured and verified end to end earlier this session — a signed payload was
accepted by `sandbox.payfast.co.za`, which minted a payment session and rendered the real payment
page showing "SAOC 2027 National Show Ticket / R 150.00". The signing path is proven. The gap is
entirely the user-facing flow.

Selling tickets early is commercially the point: the council wants the longest possible runway to
sell out before the 2027 show, and ticket revenue is the item the client status report names as
most directly delayed.

## What already exists — do not rebuild, do not casually modify

- `lib/payfast.ts` — signature generation (PHP `urlencode` semantics), ITN host list, client-IP
  resolution through the App Hosting load balancer. **Verified against three golden vectors and
  against the live sandbox. Treat as correct.**
- `app/api/tickets/checkout/route.ts` — validates input, derives amount server-side, writes a
  `reserved` ticket doc to Firestore, returns the signed field set. Now reads `SITE_URL` at
  request time (changed this session).
- `app/api/tickets/itn/route.ts` — **a security boundary that fails closed.** Signature check,
  source-IP allowlist, amount match, PayFast server-confirm, then a transactional idempotent
  write. Heavily commented with the reasoning behind each check. Any change here needs a very good
  reason and adversarial review.
- `app/admin/door/page.tsx` — the door check-in scanner. Uses `html5-qrcode` and expects to scan a
  QR code **containing the booking reference**. It is built and waiting for something to scan.
- `app/api/admin/checkin`, `/api/admin/tickets`, `/api/admin/export-csv` — door-staff APIs.
- Firestore `tickets` collection; the `Ticket` type in `types/index.ts`.

## Design direction — no invention required

The project rule is **no invented brand assets** — no new colours, logos, fonts or visual
decisions ahead of a Claude Design handoff. That rule stands, and it does not block this mission,
because a complete design system already exists in `app/globals.css`:

- **Palette "Sage & Paper"** — `--primary` deep sage `#384138`, `--accent` brass `#9e8c6b`,
  `--parchment` paper `#f4f3ec`, `--bone`, `--ink`, `--muted`, `--rule` hairlines.
- **Type** — serif display (Crimson Pro) at `--display-xl/lg/md/sm`, sans body (Manrope) at
  `--body-xl/lg/md/sm/xs`, mono eyebrows (JetBrains Mono) at `--mono-md/sm/xs` with
  `--mono-tracking: 0.18em`.
- **Spacing** — 8-point base scale.

"Beautiful" here means using that system with the same rigour as the existing marketing pages —
study `components/home/`, `components/events/EventCard.tsx` and `components/societies/SocietyCard.tsx`
and match their idiom, density and restraint. **Do not introduce a single new token.** If
something appears to need one, that is a signal to reuse an existing one, not to invent.

## The commercial safety rule — read this before writing any code

**Real ticket prices have never been confirmed by the council.** The current values
(`general 150.00`, `member 100.00`, `vip 300.00`) are placeholders invented by us, and they do not
even match the five categories the council actually uses (adult, pensioner, child, SAOC member,
exhibitor). Venue capacity is likewise unknown. Both are named as outstanding asks in
`documents/SAOC-Status-Report-LeeAnn-2026-08-11.md`.

Therefore:

1. **Sales default to CLOSED.** The buy page must render a dignified "tickets not yet on sale"
   state until someone deliberately opens sales in Sanity. Shipping a live buy button at invented
   prices is the single worst outcome of this mission.
2. **Prices come from Sanity**, so the council sets them without a developer.
3. **The amount is always derived server-side** from the Sanity value, never from the client. This
   is a payment security boundary and is already correct in the checkout route — keep it that way.
4. Seeded placeholder prices must be **visibly marked provisional** in Studio, so nobody mistakes
   them for council-approved figures.

## Features

### F1 — CMS-controlled pricing, capacity and the sales switch

Replace `PLACEHOLDER_TICKET_PRICES` with a Sanity-driven source.

New `ticketType` document schema: `name`, `slug`, `price` (ZAR), `description`, `capacity`,
`active`, `order`. Add to `nationalShow`: `salesOpen` (boolean, default false), `salesMessage`
(what to show when closed).

Seed the five real council categories — adult, pensioner, child, SAOC member, exhibitor — with
provisional prices clearly labelled as such. Note the existing `TicketType` union in
`types/index.ts` is `'general' | 'member' | 'vip'`, which does not match; reconciling that is part
of this feature, and the Firestore `tickets` collection already holds documents using the old
values, so handle that transition deliberately rather than by force.

**Heed the seeder hazard:** `scripts/seed-page-singletons.ts` uses `createOrReplace` with
hardcoded literals for every text field, so running it silently reverts editor changes. Whatever
seeding F1 adds must be create-if-absent or preserve-existing. This is already logged as a blocker
on mission `saoc-pages-editable` — **do not make it worse.**

### F2 — `/tickets`, the buy page

The main build. Ticket-type cards priced from Sanity, quantity or type selection, attendee name
and email, validation on both sides, then POST to `/api/tickets/checkout` and auto-submit the
returned signed fields to PayFast's process URL.

States that must all exist and look considered: loading, submitting, validation errors, server
error, sales closed, individual type sold out, and all types sold out. Per project rules, loading
and error states are mandatory for every async operation — no silent failures.

### F3 — `/tickets/confirmation`

**The subtle one.** The buyer arrives here by browser redirect the instant they finish paying.
The ITN is a separate server-to-server call that may not have arrived yet, so the ticket will
frequently still read `reserved`. Do not claim success on arrival, and do not claim failure
either.

Show an honest pending state, poll a new read-only status endpoint keyed on the booking reference,
and resolve to confirmed or to "still processing, we'll email you". The status endpoint must not
leak other people's ticket data — a booking reference is guessable enough to matter
(`SAOC-2027-` plus six digits), so return only what that reference legitimately owns and consider
rate limiting.

### F4 — `/tickets/cancelled`

Small but live today. Explain plainly that nothing was charged, route back to `/tickets`, and
document what happens to the abandoned `reserved` Firestore document.

### F5 — The emailed ticket and its QR code

On confirmed payment, send the buyer their ticket by Resend (`lib/email.ts` exists). The ticket
carries a **QR code encoding the booking reference**, because that is exactly what
`app/admin/door/page.tsx` scans. Without this the door scanner has nothing to read and the whole
check-in system stays theoretical.

The send must be isolated from the ITN write — a failed or slow email must never break, delay or
reverse a payment that PayFast has already confirmed.

### F6 — Accessibility, responsive and security hardening

Mobile-first from 320px. Every interactive element labelled, keyboard-operable, focus-visible.
Then adversarially probe the money paths: client-supplied amount tampering, replayed ITN,
double-submit, capacity oversell under concurrency, and bypassing the sales-closed switch by
POSTing directly to the checkout API.

### F7 — Documentation, deploy config and handover

`docs/ticketing.md`. Add `SITE_URL` (and any new vars) to `apphosting.yaml` — **currently absent
there, so a deployed ITN would use the fallback origin and never reach the app.** Plain-language
notes for Lee-Ann on setting prices, opening sales, and using the door scanner. Record the
go-live checklist.

## Out of scope

- **Phase 2 unified multi-category booking** — Symposium, WOSA and workshops in one transaction.
  Specification V2 records this as confirmed by Inunu; it was not. General admission only.
- Waiting lists, automatic capacity closure, per-society logins, the members portal.
- Any branding or logo work. Brad supplies a Claude Design prompt when ready.
- Changing the ITN verification logic without adversarial review.
- Going live on real payments — that needs SAOC's own non-profit PayFast merchant account, which
  the council has not yet registered.

## Verified state at mission creation

- PayFast sandbox credentials are Brad's own account, in `.env.local`, with a custom passphrase
  matched on both sides. Verified: sandbox accepted a signed payload and rendered the payment page.
- `SITE_URL` is set locally to the App Hosting origin; **not yet in `apphosting.yaml`** (F7).
- Firestore test tickets from tonight's verification runs were cleaned up.
- Sibling mission `saoc-pages-editable` is live and at M1 complete (F1, F2 done). These two
  missions touch different areas; the shared risk is the seeder-overwrites-editor-content hazard.
