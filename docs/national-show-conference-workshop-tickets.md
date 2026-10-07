# National Show — Conference & Workshop Tickets

Mission `conference-workshop-tickets`. This doc covers what M1/M2 (F1–F4) changed in
ticketing, and records the F5 (M3) decision record for the open Exhibitor/Vendor R3500
question. F6 extends this doc; keep new sections additive rather than restructuring what's
here.

## What this mission changed (M1/M2, F1–F4)

Source of truth for every figure below: `lib/provisional-figures.ts`. Do not re-type any of
these numbers anywhere else in the codebase — import the constants instead.

- **Conferences** (F1): SAOC Symposium and WOSA Conference are separate products, R2000 each,
  80 places each, no early-bird mechanism of any kind (`CONFERENCE_PRODUCTS`).
- **Workshops**: R100 per session, 10 tickets per session; no real session (name/date) is
  council-confirmed yet, so no sellable `workshopSession` ticketType document exists for any
  specific session (`WORKSHOP_PRICING_STRUCTURE`).
- **Admission early-bird pool** (F2): Day Visitor's early-bird tier (`early-bird` slug) and
  Weekend Pass's early-bird tier (`weekend-pass-early-bird` slug) draw from **one shared pool
  of 500** (`ADMISSION_EARLY_BIRD_POOL_CAPACITY`), not two independent allocations — early-bird
  sales close when the combined 500 is sold, not on a date cutoff.
- **Day Pass per-day cap** (F4): day-visitor and early-bird are "day-visitor-shaped" products
  (`DAY_VISITOR_SHAPED_SLUGS`, derived from `requiresDaySelection`) and share **one physical
  per-day pool of 1000** (`DAY_VISITOR_DAY_CAP_POOL_KEY`) — Lee-Ann's sheet states Day Visitor
  capacity as "1000 Total per day" across both price tiers, not two independently-tracked 1000s.
- **Thursday excluded**: day-visitor and early-bird both exclude `2027-09-23`
  (`DAY_VISITOR_EXCLUDED_DAYS`) — no Day Pass sells for the Thursday of the show.
- **Legacy no-chosenDay positions**: any early-bird position reserved before this mission's M1
  (commit `cbac259c`, 2026-10-07) was written before the checkout route asked for a
  `chosenDay` at all. Such a position is counted conservatively against **every day** being
  checked, never dropped and never guessed onto one day (`lib/data/pool-remaining.ts`).
- **`getPoolRemaining()` moved to `lib/data/pool-remaining.ts`** (F4 production-build fix,
  2026-10-07): it used to live in `lib/checkout-reservation.ts`, which a client component
  (`components/vendors/VendorStandPaymentForm.tsx` → `lib/vendor-stand-pricing.ts` →
  `lib/checkout-reservation.ts`) reaches transitively. `getPoolRemaining()` needs a real,
  non-type `firebase-admin` import, so leaving it in `checkout-reservation.ts` pulled
  `firebase-admin` into a client bundle. Moving it to `lib/data/pool-remaining.ts` (alongside
  `lib/data/tickets.ts`, the project's convention for server-only Firestore-touching code)
  keeps `lib/checkout-reservation.ts` — and therefore the vendor stand-payment client
  component's import chain — client-safe. Every other export of `checkout-reservation.ts`
  (`planPooledCapacity`, `resolveDayQualifiedPoolKey`, etc.) is unchanged.

## Needs Brad

### Item #10 — Exhibitor/Vendor R3500 (OPEN)

Source, verbatim:

Lee-Ann's sheet (`.agent/memory/scratch/leeann-notes-2026-10-07.md`, lines 25–30):

```
Same
Exhibitors(R3500)
Vendors(R3500)
Inbdoor/Outdoors

Full Access
```

Brad's message 6 (`.agent/memory/scratch/brad-ticket-news-2026-10-07.md`): *"Vendors and
exibitors R3500 depnding o nthe form selection choice when registring remember the vendor
exibitor for where is it."*

**Question for Brad:** is R3500 a new figure that replaces the confirmed regular/early-bird
booth-size model (R1450/R2900/R4350 or R1160/R2320/R3480 — see field-mapping table below), a
second additional product, or something with no
existing product at all? What do "Same", "Indoor/Outdoors" and "Full Access" mean? Which
existing field (if any) is "the vendor exhibitor" Brad refers to, or does one need to be
added?

This item stays **OPEN**. No code change has been made to `lib/vendor-stand-pricing.ts` or
any vendor payment path for this mission — the confirmed, already-shipped regular/early-bird
booth-size model stays exactly as it is until Brad resolves #10.

## Field-mapping table — what the vendor flow actually has today

Researched read-only across `app/(marketing)/national-show/vendors/**`,
`components/vendors/**`, `lib/vendor-stand-pricing.ts`,
`app/api/vendors/stand-payment/initiate/route.ts`, `lib/vendor-submissions.ts`,
`lib/vendor-applications.ts`, `types/index.ts`:

| Form | Field | Values | Drives price today? |
|---|---|---|---|
| Stand-payment page (`VendorStandPaymentForm.tsx`) | `boothSize` (numeric) | `1 \| 2 \| 3` | **YES — the ONLY price-driving FORM field in the entire vendor flow.** Feeds `resolveVendorStandPrice()` directly. Two tiers apply, both confirmed 2026-09-01: regular R1450/R2900/R4350, or early-bird R1160/R2320/R3480 (20% discount, `VENDOR_STAND_EARLY_BIRD_DISCOUNT_PERCENT`, `lib/vendor-stand-pricing.ts:40`). The tier is chosen by `isWithinEarlyBirdWindow(now, cutoffIso)` against a 90-day-before-show cutoff (`VENDOR_STAND_EARLY_BIRD_CUTOFF_DAYS_BEFORE_SHOW`, `lib/vendor-stand-pricing.ts:59`) — a time-derived axis, not a second form field. See `lib/vendor-stand-pricing.ts:37-40,122-135`. |
| Registration form (`VendorBoothFieldset.tsx`) | `boothSize` (string) | `single \| double \| triple` | NO — explicitly disconnected from price (`VendorStandPaymentForm.tsx:28-33` comment: independent of `VendorSubmission.boothSize`). |
| Registration form (`VendorBoothPositionFieldset.tsx`) | `boothType` | `standard-in-row \| corner \| end-of-row \| no-preference` | NO — row-position preference only. |
| Application + registration forms (`VendorCategoryFieldset.tsx` / `VendorApplyForm.tsx`) | `vendorCategory` | 14-item product-category checklist (orchids, succulents, books, food-beverage-retailer, etc.) | NO. |
| Registration form (`VendorBusinessIdentityFieldset.tsx`) | `businessEntityType` | `company \| close-corporation \| sole-proprietor \| partnership \| individual \| other` | NO. |
| Backend schema only (`lib/vendor-submissions.ts`), **not rendered by any form component today** | `exhibitorPassesRequired` / `exhibitorPassesCount` | boolean / integer | NO — dormant field, unexposed. |

### Fact-finding: no Exhibitor/Vendor selector, Indoor/Outdoors, or Full Access concept exists

Confirmed by grep across the application code and schema (`app/`, `lib/`, `components/`,
`sanity/`, `types/`):

- There is **no Exhibitor-vs-Vendor role selector** anywhere in the current form or schema.
  Every "Exhibitor" concept that does exist in the codebase is unrelated to the vendor
  stand-payment flow: (a) the competitive-showing content area at `/national-show/exhibitors`
  (judging/display — `types/index.ts:361-449`'s `ShowExhibitorInfo` and friends); (b) a
  separate, explicitly-unresolved `ticketType` category `exhibitor` in
  `lib/ticket-taxonomy.ts` with no purchase surface; (c) `NationalShow.exhibitors?: number`
  (`types/index.ts:45-46`) — a past-show attendance **count** stat ("Exhibitor count — Sanity's
  `show.exhibitors`. Distinct from `visitors`"), not a role or a form field; (d) the
  dormant, unexposed `exhibitorPassesRequired`/`exhibitorPassesCount` vendor-submission fields
  in the table above; and (e) `/national-show/sa-exhibitors` — the PUBLIC South African nursery
  directory, whose own top-of-file comment (`app/(marketing)/national-show/sa-exhibitors/page.tsx:13-18`)
  states it is "distinct from `/national-show/exhibitors` (the grower entry guide) and from
  `/national-show/vendors` (the trade showcase, another lane's untouchable route)". It renders
  Lee-Ann's verbatim "South African Exhibitors Pavilion" copy (`components/vendors/VendorIntro.tsx`)
  and reads a separate Sanity query (`southAfricanNurseriesQuery`, `vendorNursery` tag) — a
  public-facing label reusing the word "Exhibitors", not a role on the vendor registration or
  stand-payment form. None of the five is an Exhibitor-vs-Vendor role selector, and none is
  the vendor registration/payment flow.
- The term **"Indoor/Outdoor"** has zero matches in the application code or schema (`app/`,
  `lib/`, `components/`, `sanity/`, `types/`). A repo-wide re-grep (excluding `node_modules/`,
  `.next/`, `.git/`) turns up no real usage either — the only other occurrences anywhere in
  the repo are self-referential: this doc, its source golden
  (`.agent/memory/project/specs/conference-workshop-tickets/goldens/f4-exhibitor-vendor-flagging.golden.md`),
  and the F5 contract check script's own search pattern
  (`contracts/checks/conference-workshop-tickets-f5/check-no-vendor-flagging-content-added.mjs:39`).
  Nowhere does the concept itself actually exist.
- The term **"Full Access"** has zero matches in the application code or schema (`app/`,
  `lib/`, `components/`, `sanity/`, `types/`) — no vendor field, UI, or schema concept by this
  name exists. A repo-wide re-grep found exactly one unrelated occurrence outside this doc and
  its golden: `docs/ticketing.md:564-565` uses the ordinary-English phrase "Full access" to
  describe the `manager`/`owner` admin roles' capability set
  (`lib/admin-roles.ts:23-49` — `owner` holds every capability) — a ticketing-admin-permissions
  concept, unconnected to vendor stands, booth sizing, or any vendor form field.

This directly contradicts what Brad's message appears to assume exists ("remember the
vendor exibitor for where is it") — reported here as a fact for him to resolve against item
#10, not guessed around.

### What this feature does NOT do

- Does not add, change, or remove any constant in `lib/vendor-stand-pricing.ts`.
- Does not add a new `ticketType` category document, Sanity field, UI field, or price for
  "Exhibitors", "Vendors", "Indoor/Outdoor", or "Full Access".
- Does not touch `app/(marketing)/national-show/vendors/**` or
  `app/(marketing)/national-show/exhibitors/**`.
