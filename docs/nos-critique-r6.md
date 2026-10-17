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
what-to-expect) lead with the photograph, fixed at 300px on the hub and 220px on the inner heroes (Codi) (`order: -1`, `aspect-ratio: auto`), then the
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

### R82 supersedes launch-weekend F7

Codi (final): the Trading name label reads exactly "Trading name (if different, optional)" and no label
carries ") (". The field components append nothing to a label, and every required input keeps `required` and
gains `aria-required="true"`, so dropping the visible "(required)" suffix loses no semantics (a fieldset takes
no aria-required, so the vendor category group stays as it was). R82 supersedes launch-weekend F7's
`check-h-vendor-static.mjs` and `check-i-vendor-runtime.mjs`, which pinned the "(required)" and "(optional)"
suffixes; both are amended in this branch (now asserting no "(required)" suffix, aria-required on required
inputs and the exact Trading name label) so main is never red. F18's supersession.json is untouched.

### f2 update (Codi, final)

The recovery links now follow the hero's R67 order: Tickets (primary), National Show, Plan your visit. Below
480px they stack full width at 48px with a 12px gap. The not-found is noindex, still a real 404, and does not
shadow `archive/[year]`.

## f9 — NOS chrome: utility bar and Search off, nav-config naming

Source: Brad chrome decision #2 and #6 (2026-10-15), via NOS Design 2026-10-17, from the NOS v4 pack. HANDOFF
"Approved decisions (Brad, 2026-10-15)", decision 2: "Left off NOS pages: Search and SAOC's utility bar."
Decision 6: "Phone header: two rows and not sticky, so the logo stays at 390px with a 6.27px cap." The one-row
mobile header (R74 #7) was withdrawn and is not built; the 97px (sticky from 700px) and 146px (two rows, not
sticky) header geometry is unchanged.
- The NOS variant of `UtilityBar` renders nothing, so the NOS header sits at y=0. The SAOC path is untouched.
  The NOS header carries no Search.
- `nav-config.ts`: leadLabel "19th National Orchid Show"; "SAOC Symposium" becomes "National Orchid Show
  Symposium" in the Symposium descriptor; the rail's Day Visitor and Weekend Pass link to
  `/national-show/tickets#ticket-day` and `#ticket-weekend`. nav-config is shared, so the SAOC menus read the
  same strings (lead-approved site-wide naming); the closed SAOC header is unchanged.
Source: lead saoc-2b 2026-10-17.

## f6 — R34: exhibitors "On this page" jump chips

`/national-show/exhibitors` is a long guide, so it gets the same wrapping jump chips the FAQ uses.
The R52 chip class string now lives in one file, `components/show/ShowJumpChips.tsx`;
`ShowFaqList` imports it and its output is unchanged. `ExhibitorJumpNav.tsx` shows the chips
from 768px and, below 768px, the same chips inside a collapsed native `<details>` ("On this page",
44px summary with a chevron) that works without JavaScript. One chip per section heading: the four
page h2s plus the nine reference-section h3s (13 in preview), in page order, only for blocks that
render. Each heading carries an id and the r4 scroll offset (62px / 74px from 768) so a chip
lands clear of the sticky header. The R11 banner now carries the existing "Contact the council"
button (the end CTA stays), and the step numerals are Fraunces at 16px.

Public build: `withholdPlaceholderProse()` (called once, in the page) switches the per-row
markers off. Rows carrying an open-question marker are not rendered, and the banner, the research
line and the "to be confirmed" chips merge into ONE surface above "On this page"
(`ShowStatusLine.tsx`, the existing marker): chip, the list of affected headings, the banner
sentence as plain body text, the research label as a quieter foot line, then the "Contact the
council" button. Preview keeps today's 3 / 9 / 11 markers and the banner pill.

## f8 — R50: what-to-expect logistics first

On `/national-show/what-to-expect` the visit logistics (Show dates, Opening hours, Admission, Food
and refreshments, Photography, Cloakroom and plant holding, Accessibility) now render straight under
the hero and ahead of the Drive narrative. This is a reorder in the page; `LongFormPage`, `ShowFacts`
and `HoldingState` are untouched. The seven narrative paragraphs are unchanged and the Dates fact is
dropped from the aside while the Show dates block carries it. All seven headings are siblings at h2
in one type (`VisitorInfoBlock` takes an additive `headingLevel`, default h3, so plan-your-visit is
unchanged). The dates read with weekdays, derived from `showDate` / `showEndDate` with
`Intl.DateTimeFormat`, never retyped.

Preview keeps one status line per unconfirmed block. In a public build (`withholdPlaceholderProse()`,
called once in the page) every unconfirmed row is withheld and `ShowHoldingNote` shows one R11 line
naming exactly those rows, then the existing "Be the first to know" link. The hero lede and the
concession and photography text, which have no Drive source, are withheld there too. No copy was
added. Venue and parking, family and pensioner prices, and online-versus-door booking remain gaps.

## f10 — group sub-nav below 768px (critique H1, audit 2.4.7)

The R27 group sub-nav under every inner hero (`NosSubNav`; `ShowSectionNav` is the footer grid) now
brings the current item fully into view on load, with a lead equal to the row's own gutter. The
effect sets the row's `scrollLeft` directly to the item's `offsetLeft` minus the row's computed left
padding, clamped, and only when the row overflows;
there is no `scrollIntoView` (it can scroll the page past the hero) and nothing is smooth. A 40px mask
fade (to fully transparent) shows only on an edge that hides items, driven by `data-fade-start` and `data-fade-end`, which
follow scroll and resize. The scroller breakpoint is 767px rather than 700: the capture run measured the
sa-exhibitors row overflowing at 701 and 720 (687px of links against 666 and 684 of room), recorded in
`goldens/f10-breakpoint.json`. Everything from 768px up is untouched. Also, `ShowSectionNav` reads
"National Orchid Show Symposium" in place of "SAOC Symposium" (Brad's naming ruling); no page renders it.

## f7 — R33: plan-your-visit emergency numbers and the venue map button

Source: lead saoc-2b 2026-10-17; NOS Design R34/R33 sign-off 2026-10-17. On `/national-show/plan-your-visit`
each emergency number that is phone-shaped becomes a `tel:` link built from `contact.number` (every
character except digits and + stripped) with a 44px target. The numeral is set in Fraunces, light, from
2.4rem, above its label; a number that is not phone-shaped stays plain text. The venue card sits in an
`<aside>` beside "Getting there", and its "Open in a map ↗" becomes a ghost NOS Button (50px, new tab, on
the existing `mapsUrl`) through a new optional `mapAction` prop on `VenueCard`. The prop defaults to the
plain link, so `/contact` is unchanged. No copy was added and no Button variant was created.
