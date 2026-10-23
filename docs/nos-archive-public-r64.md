# Past shows hidden in public until records exist (r64)

Mission `nos-archive-public-r64`. Codi (NOS design lead, final authority), P2: "in public mode, remove 'Past shows' from the subnav and the Explore index and return notFound for the route until records exist; keep it in preview. Same rule as r56/r57: empty sections are hidden in public." P3: one noun, "Past shows", for the H1 and the title (H4). saoc-82 approved hiding in public only.

## The rule

`hasPastShowRecords()` (`lib/data/past-shows.ts`) is true when the Sanity `show` documents the archive already renders (`pastShowsQuery` through `mergePastShows`, `status == "past"`) hold a past show with a recorded fact: a venue, or entries, exhibitors or awards above zero. A year and a title alone are a label, not a record. `showPastShowsRoute()` (`lib/data/past-shows-public.ts`) is true in preview and, in public, when `hasPastShowRecords()` holds. No new flag or env var: the public/preview switch is `withholdPlaceholderProse()`.

Evidence (2026-10-22, published perspective, read only): the dataset holds no `show` with status past (one upcoming 2027, one cancelled test show without a year). The coverage map of `site-content-alignment` has no entry for the archive. Firestore `nationalShows` is read by no page.

## Surfaces that follow the rule

Header and NosHeader (desktop mega, mobile menu) take the `nav` prop that `app/(marketing)/layout.tsx` fills from `getVisibleNav()`; the NOS sub-nav (`NosHero`), the Explore index (`NosShowIndex`), the hub Planning a visit list, the breadcrumb labels (`national-show/layout.tsx`) and the sitemap (the route and its years) do the same. `/national-show/archive` and `/archive/[year]` answer 404 through `notFound()`. A preview build is unchanged apart from the noun.

## Owner flags

- A Sanity outage reads as "no records": a public build hides the route until the next revalidation (60 s).
- The empty-state copy on the archive page ("Show history awaiting committee records") is now preview-only.
- `ShowSectionNav` still lists "Past Shows" but is rendered nowhere; left alone.
- The layout reads the dataset on every marketing page through `sanityFetch` with the `show` and `sanity` tags, so it shares the page fetch cache and revalidates with the webhook. `sanityFetch` resolves to null on a missing client or a failed read, which the predicate treats as "no records"; the read never throws.
