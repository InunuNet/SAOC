# NOS content standard

Mission `nos-content-standard`. Every NOS content route renders one hero, one document layout and one
type scale, with copy taken only from Lee-Ann's Drive documents. The spec, the route table and the
gates live in `.agent/memory/project/specs/nos-content-standard/` (`goldens/spec.md`,
`goldens/route-table.json`, `checks/`).

## What every route shares

- **Hero.** `components/nos/NosHero.tsx`: crop from `hero-photos.ts`, breadcrumb "National Show - {page}"
  (`crumbLabel`), the h1 as the nav label, an optional lede, and an optional facts row
  (`heroFactsFromShow`, `heroFactsForEvent`). An h1 over 20 characters takes `.is-long` (LT-1).
- **Body.** `DocumentLayout` (7fr/5fr) with an index aside, a content aside, or none. Event pages
  (`/symposium`, `/wosa-conference`, `/workshops`) use the `.nos-ev-*` grid with the live ticket card in
  the aside; `/conferences` uses `.nos-cr-*` rows.
- **Copy.** Verbatim from `goldens/sources/*.md`; strings that have no source are not rendered. Struck
  lines in her documents are not copy. Typos in her text are kept.
- **Chips.** None. The only pill is the hero eyebrow.

## Shared profile (PR-1)

`components/nos/PresenterSection.tsx` renders one editorial profile per guest
(`[data-guest-profile]`, `data-presenter-id` = Sanity `_id`). The portrait shows only when its source is
at least 640 px wide (`portraitFor` in `lib/view-models/load-presenters.ts`); there is no placeholder
tile. Country and organisation render only when set. `/international-guests` lists every profile with a
country set and not South Africa; `/symposium` and `/wosa-conference` list the presenters of their event.
Order: Sanity `order`, then `PRESENTER_FALLBACK_SEQUENCE` keyed by `_id`
(`lib/view-models/presenter-order.ts`).

## Routes

| Route | Source | Notes |
|---|---|---|
| `/about` | About v1.2 | h1 "About the show", theme in the hero, gateway aside of nav labels. |
| `/what-to-expect` | What to Expect v1.0 | Static copy plus the live admission prices. |
| `/plan-your-visit`, `/faq`, `/sponsors`, `/programme`, `/exhibitors` | their Drive documents | See the spec. `/exhibitors` is hero and contact panel only. |
| `/vendors` | South African Exhibitors v1.1 | One page for exhibitors and vendors (`/sa-exhibitors` answers 301). Invited-vendor wall hidden (D-SX1). |
| `/international-guests` | CMS | Hero and sub-nav only while no guest has a country. |
| `/symposium`, `/wosa-conference` | What to Expect, About, FAQ 46-56 | Live ticket card beside the copy. |
| `/workshops` | FAQ 57-60 | One ticket card; workshop records render once SAOC enters `workshopSession` data. |
| `/conferences` | FAQ sections 6-7, 38, 47 | One row per conference with its ticket card. |
| `/contact` | Contact v1.1 | Committee list, form, address aside. |
| `/privacy`, `/terms`, `/refunds` | existing legal content | NOS host renders `NosHero`; SAOC host keeps its own hero. |

## Known gaps (owner items)

- Tibbs photo at 640 px or wider; Lee-Ann's confirmation of "refrenshments" (FAQ 51) and of the invited
  vendors' spellings.
- Workshop records need level, duration, included and bring entered in Sanity; places come from the
  ticket's capacity and `getPoolRemaining`.
- `/about` has one heading in her document, so it has no section index.
