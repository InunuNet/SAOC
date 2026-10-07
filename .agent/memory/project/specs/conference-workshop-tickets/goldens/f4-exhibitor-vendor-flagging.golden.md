# F5 Golden — Exhibitor/Vendor R3500 Flagging Decision Record

Mission `conference-workshop-tickets`, feature F5, **its own milestone (M3)** — isolated
because it is the only feature in the mission that touches (by reading, never writing) the
live, already-shipped vendor stand payment path (`lib/vendor-stand-pricing.ts`,
`app/api/vendors/stand-payment/initiate/route.ts`).

**REVERTS this golden's own prior revision**, which implemented R3500 as a flat fee
replacing the confirmed R1450-per-booth-size model. Team-lead's correction (2026-10-07,
second pass): *"F4 being doc-only for vendors is right until Brad answers #10"* — i.e.
needs-Brad item #10 (the full Exhibitor/Vendor R3500 block) stays OPEN, and this feature
stays doc-only, matching this mission's original (pre-message-6) design. **No code change
to `lib/vendor-stand-pricing.ts` or any vendor payment path in this feature.**

## Source (verbatim, unchanged)

Lee-Ann's sheet (`.agent/memory/scratch/leeann-notes-2026-10-07.md`), lines 25-30:

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

## What the codebase actually has today (factual finding, for Brad to map against)

Researched read-only across `app/(marketing)/national-show/vendors/**`,
`components/vendors/**`, `lib/vendor-stand-pricing.ts`,
`app/api/vendors/stand-payment/initiate/route.ts`, `lib/vendor-submissions.ts`,
`lib/vendor-applications.ts`, `types/index.ts`:

| Form | Field | Values | Drives price today? |
|---|---|---|---|
| Stand-payment page (`VendorStandPaymentForm.tsx`) | `boothSize` (numeric) | `1 \| 2 \| 3` | **YES — the ONLY price-driving field in the entire vendor flow.** Feeds `resolveVendorStandPrice()` directly, R1450/R2900/R4350 (confirmed 2026-09-01). |
| Registration form (`VendorBoothFieldset.tsx`) | `boothSize` (string) | `single \| double \| triple` | NO — explicitly disconnected from price (`VendorStandPaymentForm.tsx:28-33` comment: independent of `VendorSubmission.boothSize`). |
| Registration form (`VendorBoothPositionFieldset.tsx`) | `boothType` | `standard-in-row \| corner \| end-of-row \| no-preference` | NO — row-position preference only. |
| Application + registration forms (`VendorCategoryFieldset.tsx` / `VendorApplyForm.tsx`) | `vendorCategory` | 14-item product-category checklist (orchids, succulents, books, food-beverage-retailer, etc.) | NO. |
| Registration form (`VendorBusinessIdentityFieldset.tsx`) | `businessEntityType` | `company \| close-corporation \| sole-proprietor \| partnership \| individual \| other` | NO. |
| Backend schema only (`lib/vendor-submissions.ts`), **not rendered by any form component today** | `exhibitorPassesRequired` / `exhibitorPassesCount` | boolean / integer | NO — dormant field, unexposed. |

**Fact, not a guess, confirmed by repo-wide grep with zero matches outside irrelevant
contexts:** there is no "Exhibitor vs Vendor" role selector anywhere in the current form
or schema. The only "Exhibitor" concepts in the codebase are (a) the competitive-showing
content area at `/national-show/exhibitors` (judging/display, unrelated to vendor stands)
and (b) a separate, explicitly-unresolved `ticketType` category `exhibitor` in
`lib/ticket-taxonomy.ts` with no purchase surface — neither is the vendor
registration/payment flow. **"Indoor/Outdoors" and "Full Access" exist nowhere in the
codebase at all** (zero grep matches for either term). This directly contradicts what
Brad's message appears to assume exists ("remember the vendor exibitor for where is it")
— reported as a fact for him to resolve, not guessed around.

## What this feature DOES do

1. Record the table above, verbatim-sourced, in
   `docs/national-show-conference-workshop-tickets.md`'s needs-Brad section.
2. Add needs-Brad item #10 (verbatim, unresolved): is R3500 a new figure that replaces the
   confirmed R1450/booth-size model, a second additional product, or something with no
   existing product at all? What do "Same", "Indoor/Outdoors" and "Full Access" mean? Which
   existing field (if any) is "the vendor exhibitor" Brad refers to, or does one need to be
   added?
3. Proves, by assertion, that `lib/vendor-stand-pricing.ts` and the live vendor stand
   payment path are completely untouched by this mission — the confirmed, already-shipped
   R1450/booth-size model stays exactly as it is until Brad resolves #10.

## What this feature does NOT do

- Does not add, change, or remove any constant in `lib/vendor-stand-pricing.ts`.
- Does not add a new `ticketType` category document, Sanity field, UI field, or price for
  "Exhibitors", "Vendors", "Indoor/Outdoor", or "Full Access".
- Does not touch `app/(marketing)/national-show/vendors/**` or
  `app/(marketing)/national-show/exhibitors/**`.
