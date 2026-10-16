# nos-critique-r6

Source for every item: lead saoc-2b, 2026-10-17 (R80/R63/R82/SEO lane), relaying Brad.

## f2 — R63: NOS-scoped not-found for /national-show/*

An unmatched URL under `/national-show` used to render the SAOC root not-found inside the root
layout alone, with no NOS header or footer. `app/(marketing)/national-show/[...slug]/page.tsx`
now calls `notFound()` for any URL no real route owns, and
`app/(marketing)/national-show/not-found.tsx` renders inside the NOS chrome and `.nos-theme`
with HTTP 404. Copy is the SAOC root not-found eyebrow, headline and first sentence verbatim;
the second sentence is cut because it points at SAOC society links this page does not carry.
Recovery links use the nav-config labels: National Show, Tickets, Plan your visit.
`app/not-found.tsx` is unchanged.

## f3 — R82: /national-show/vendors/apply form

The intro sentence is unchanged. With `showRequirement` a required field's label is just its text and
an optional one keeps " (optional)" (VendorFormField, VendorCheckboxGroupField). Labels and legends
use one new class, `.nos-form-label` (nos-theme.css): Karla 14px/500 in full ink, no tracking, no
capitals; F18b reuses it on the ticket forms. The register form keeps its existing label class.
`tradingName` gains `autoComplete="organization"` as specified; businessName already carries the same
token, so a browser may offer the business name in the "(if different)" field, and flipping that prop
to `off` is the alternative. The POST payload is unchanged. Source: lead saoc-2b 2026-10-17.

## f4 — SEO: FAQPage and BreadcrumbList JSON-LD (and R61)

`faqPageJsonLd()` and `portableTextToPlainText()` are added to `components/seo/JsonLd.tsx`.
`/national-show/faq` emits a FAQPage built from the same `faqs` array the list renders: only entries
with a question, an answer (`hasFaqAnswer`) and `status === 'confirmed'`, the one status that carries no
confirmation badge. In the holding state, or when none qualify, no FAQPage node is emitted.
One BreadcrumbList is emitted on every `/national-show/*` page by `components/nos/NosBreadcrumbJsonLd.tsx`,
mounted once by the national-show layout with a href-to-label map built from nav-config. The trail starts at
National Show and ends at the nearest labelled ancestor; an unlabelled segment is dropped, never invented.

Event offers were already delivered on the hub (ZAR price via `resolveEffectivePrice`, availability from
released quantity, none while sales are closed) and are untouched. `validFrom` was not added: no Sanity field
carries a sale-start date, and the builder deliberately emits `validThrough` from `earlyBirdCutoff`.

R61 (font preloads and LCP): no font preload was removed. Crimson Pro, JetBrains Mono and Manrope are declared in
the shared root layout and Lora in SaocLockup; Next.js computes font preloads per page entry, so no change inside
the cleared files can drop them on `/national-show/*` while keeping them on SAOC routes. Reported to the lead.
Source: lead saoc-2b 2026-10-17.

## f5 — R80 #1: hub and photo heroes below 768px

Below 768px the hub hero and the four photographic inner heroes (plan-your-visit, symposium, programme,
what-to-expect) lead with the photograph, fixed at 300px (`order: -1`, `aspect-ratio: auto`), then the
h1, lede and CTAs, then on the hub the countdown and the facts. At 390x844 the Tickets button ends at
y=812, inside the 828 fold line. The 768-1023px stacked rules and the 1024px-and-up heroes are unchanged.
Every hero lede below 768px is 18px/1.5 with max-width 60ch (Codi); 768px and up keep their sizes.
`object-position` per photograph is its measured bloom focal point: `HERO_PHOTOS` in
`components/nos/hero-photos.ts` carries it and NosHero passes it to the CSS as `--nos-hero-pos`, used
only below 768px. The positions come from `goldens/measure-bloom.py` (`goldens/bloom-marginals.json`),
scored against the best possible crop of the 390x300 window. NosHero also sets `fetchPriority="high"`
on a priority hero image (R61 LCP). Source: lead saoc-2b 2026-10-17.

## f1 — R65: body text 16px / 1.55 across the NOS pages

Brad, R65: "Body text should be standard across both sites." The value is the design handoff's, verbatim from
`design/design_handoff_saoc/design_system_README.md` line 100: "Sans body — Manrope — running copy, buttons, nav.
16px base, 1.55 line-height." NOS body text is therefore 16px / 1.55; Karla stays the NOS face (R14).
- `nos-theme.css`: two lines only, the `.nos-theme` root `line-height` 1.65 to 1.55 and `--fs-body` 1.0625rem to 1rem.
  `presenters.css` follows (leading 1.55, `--pc-bio-lh` 1.55, the stale 17px fallback and comment).
- Body role routing: size comes from the one token, `text-[length:var(--fs-body,1rem)]` (the `1rem` fallback because
  `VenueCard` also renders on /contact, outside `.nos-theme`), and the leading is an explicit `leading-[1.55]` on
  each body element rather than inherited, because components set their own. Existing 16px lines keep `text-[16px]`
  and take the same leading.
- Prose that was 13-15px (accommodation, travel routes, nursery and sponsor cards, event description, page notice,
  workshops note, WOSA closing paragraph, vendor grid and empty state) is raised to 16. Labels, meta lines, links,
  controls, tracked-caps markers and the R52 FAQ chips keep their sizes. The 17px serif names and titles are unchanged.
- /contact's venue card moves from 17px to 16px because `VenueCard` is shared.
Source: lead saoc-2b 2026-10-17.
