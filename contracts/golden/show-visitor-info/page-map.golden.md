# Page map, components, and the reachability graph

## Routes

| Route | File | Feature |
|-------|------|---------|
| `/national-show/plan-your-visit` | `app/(marketing)/national-show/plan-your-visit/page.tsx` + `loading.tsx` | F2 |
| `/national-show/what-to-expect` | `app/(marketing)/national-show/what-to-expect/page.tsx` + `loading.tsx` | F3 |
| `/national-show/faq` | `app/(marketing)/national-show/faq/page.tsx` + `loading.tsx` | F4 |

All three are **Server Components**. None carries `'use client'`. All three set
`export const revalidate = 60`, matching every other CMS-backed route on the site
(see the F1 cms-loop comment block already present on `/national-show/page.tsx`).

All three use the existing `PageHero` from `components/ui/PageHero.tsx` — no new hero component,
no new imagery beyond images already in `public/images/`.

## Components

`components/show/` (existing directory — export each from `components/show/index.ts`):

| Component | Client? | Purpose |
|-----------|---------|---------|
| `ConfirmationBadge.tsx` | server | The pending / research marker. See `confirmation-status-model.golden.md`. |
| `VisitorInfoBlock.tsx` | server | Heading + body text + its `ConfirmationBadge`. The unit every text block on both info pages is built from. |
| `VenueCard.tsx` | server | Venue name, address lines, city/postal, directions note, static map image (if set) and map link. Every value from `nationalShow.venue`. Reused by `/contact`. |
| `TravelRoutes.tsx` | server | Maps over `airportRoutes`. |
| `AccommodationList.tsx` | server | Groups `accommodation` by `distanceBand`. |
| `ShowFaqList.tsx` | server | Groups FAQs by category, renders each as `<details>`/`<summary>`. |
| `ShowSectionNav.tsx` | server | The cross-links between the four show pages. |

Every component stays under the project's 150-line limit. `VenueCard` doing double duty on
`/contact` is deliberate — it is why the venue block on Contact cannot drift from the show pages.

## The FAQ disclosure — non-negotiable shape

Native `<details>` / `<summary>`. No `useState`, no `'use client'`, no `aria-expanded` managed
by hand, no JS-only reveal.

Rationale, and why this is asserted rather than advised: `<details>` is keyboard-operable
(Tab to focus the summary, Enter or Space to toggle), screen-reader-announced, works with
JavaScript disabled, and — the one that matters for a council document — its content is present
in the DOM and therefore printable and findable by in-page browser search even while collapsed.
A hand-rolled accordion gets all four of those wrong by default.

`check-faq-keyboard.mjs` drives this with real Playwright keyboard input: Tab to a summary,
press Enter, assert the answer becomes visible. Not a grep for the word `details`.

## Reachability graph — F5

`/national-show/archive` is the standing cautionary example: built, returns 200, linked from
nothing. **A page that returns 200 is not shipped. A page a visitor can click to is shipped.**

Required edges, every one asserted by parsing real rendered HTML for `href` values:

```
/national-show ──> /national-show/plan-your-visit
               ──> /national-show/what-to-expect
               ──> /national-show/faq
               ──> /national-show/archive        (free to fix while here — the orphan)

/national-show/plan-your-visit  ──> /national-show, /national-show/what-to-expect,
                                    /national-show/faq, /contact
/national-show/what-to-expect   ──> /national-show, /national-show/plan-your-visit,
                                    /national-show/faq, /tickets
/national-show/faq              ──> /national-show, /national-show/plan-your-visit, /contact

/contact ──> /national-show   (venue block, spec §4.18)
```

Implementation of the landing-page edges: a "Plan your visit" card grid on
`/national-show/page.tsx`, plus `ShowSectionNav` rendered on all four show pages.

`components/chrome/SearchOverlay.tsx` also gains the three pages in its link list, so the
site-wide search surfaces them. The primary `Header` NAV is **not** changed — adding three
top-level items would unbalance a six-item bar, and the section nav plus landing cards satisfy
the reachability requirement without touching global chrome.

## `/national-show/upcoming`

Currently `redirect('/national-show')`. It is not broken, just impermanent: `redirect()` emits a
307. Change it to `permanentRedirect()` (308) so search engines consolidate the URL. One-line
change, no behavioural risk. That is the whole of the "fix the stub while in the area if cheap"
item — do not expand it into building an upcoming-show page.

## Prohibited across all new files

- Any `--custom-property: value` declaration.
- Any `#rrggbb` / `#rgb` hex colour literal.
- Any venue literal (see `venue-single-source.golden.md`).
- Any ticket price figure or currency amount.
- Any `'use client'` on the three page files.
