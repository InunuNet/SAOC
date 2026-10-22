# nos-archive-public-r64 - Past shows hidden in public until records exist; one noun (Codi, r64 P2/P3; 2026-10-22)

Ruling (Codi, NOS design lead, final authority, verbatim): "P2: in public mode, remove 'Past shows' from the subnav and the Explore index and return notFound for the route until records exist; keep it in preview. Same rule as r56/r57: empty sections are hidden in public. The H2 is internal status, not visitor copy (critique H8/H2)." "P3: one noun. The nav says 'Past shows', the H1 'National Show archive', the title 'Archive'. Use the existing 'Past shows' for the H1 and title (H4)." Architect note: confirm the coverage map lists the archive as having no content; "until records exist" keys off existing data, not a new flag.
saoc-82 (speaks for Brad) approved: hide /national-show/archive and its "Past shows" entries in public only, preview unchanged. Base: origin/main b1c29304. Branch fix/nos-archive-public-r64. No invention; Sanity and Firestore are READ only.

## Where "records exist" lives (evidence, 2026-10-22)
- The archive pages read Sanity `show` documents only: `pastShowsQuery` (`status == "past"`) -> `mergePastShows` (lib/data/mergeShows.ts). No page reads Firestore `nationalShows`.
- Live read (published perspective, public CDN): 2 `show` docs, none past (show-19-2027 upcoming; show-fictional-test cancelled, no year). So 0 past shows.
- f1-coverage-map.json (site-content-alignment) has NO entry for the archive (it lists Lee-Ann's 20 sections); there is no "has content" claim to contradict. Evidence for emptiness is the dataset.
Predicate: `hasPastShowRecords(shows)` = `mergePastShows(shows)` holds a show with a recorded fact: non-empty venue, or entries, exhibitors or awards > 0. Year and title alone are a label, not a record. The route is shown when `!withholdPlaceholderProse()` (preview) or `hasPastShowRecords(...)`.

## Dev brief (names are binding: unit.mjs and static.mjs import/grep them)
New `lib/data/past-shows.ts` (PURE: no next/*, no sanity client, no process.env): `PAST_SHOWS_HREF = '/national-show/archive'`; `hasPastShowRecords(shows)`; `navWithoutHref(nav, href)` (copy; removes the leaf from `lead.theShow.links`, every column, and `featureRail.destinations`; never mutates NAV).
New `lib/data/past-shows-public.ts`: `showPastShowsRoute()` (async; preview true, public = hasPastShowRecords(sanityFetch(pastShowsQuery, tags ['show','sanity']))) and `getVisibleNav()` (NAV or navWithoutHref(NAV, PAST_SHOWS_HREF)).
Surfaces (each follows the predicate; nav-config.ts, footer-data.ts, content/national-show-routes.json stay untouched):
1. `app/(marketing)/layout.tsx`: fetch `getVisibleNav()` with the show; pass `nav` to `Header` and `NosHeader`. Both gain `nav?: readonly NavItem[]` (default NAV) and render it (desktop mega, SAOC MobileMenu via `nav={nav}`, NosHeader drawer; NosHeader's module-level `megaItem` moves inside the component).
2. `nos-subnav-groups.ts`: `subNavGroupFor(route, nav)`; `NosHero` becomes async and passes `await getVisibleNav()`.
3. `NosShowIndex`: async; filter `PAST_SHOWS_HREF` out of GROUPS unless `showPastShowsRoute()`. LABELS still read the static NAV.
4. Hub `national-show/page.tsx`: filter the 'Past shows' entry of VISITOR_CARDS ("Planning a visit") the same way.
5. `national-show/layout.tsx`: async; breadcrumb labels from `getVisibleNav()` (otherwise the string stays in the client payload).
6. `app/sitemap.ts`: drop the manifest row for the archive and the year routes when the route is withheld.
7. `archive/page.tsx`: `notFound()` when `!showPastShowsRoute()` in BOTH the page and a `generateMetadata` (replaces the static `metadata` export, else the 404 head carries a canonical and og:url of the missing page: found in the trial). `archive/[year]/page.tsx`: same guard in page and generateMetadata.
P3 (the same noun, "Past shows", existing copy): archive H1 `title="Past shows"`, metadata title 'Past shows', og text `nosOgImage('Past shows')`; year page: "← Archive" -> "← Past shows", crumb 'Show history' -> 'Past shows', button "Full archive" -> "Past shows". The empty-state h2 ("Show history awaiting committee records") is untouched: it is reachable in preview only.
Docs: `docs/nos-archive-public-r64.md` (the rule, the evidence, the surfaces, the owner flags). `goldens/reference-trial.patch` is the architect's trial, proven green on A2-A9 then reverted. Non-binding.

## Checks
A1 hashes. A2 footprint vs b1c29304 (goldens/footprint.json, docs, spec dir). A3 static S1-S7. A4 unit (tsx; 9 predicate fixtures incl. the live shape, nav filter purity). A5 prettier no dirtier. A6 eslint. A7 tsc. A8 rendered public (R1-R4: archive and years 404, no `national-show/archive` string in the HTML of hub/faq/sponsors/tickets/about or the 404 page, hub list 4, Explore index 15, sitemap without it, SAOC mega without the link at 1280). A9 rendered preview (P1-P3: 200, H1 and title "Past shows", links and sitemap entry kept, counts 5 and 16).
Rendered expectations are computed from a live Sanity read (`hasRecords`), so they flip when the committee publishes a past show; the "records exist" branch of the code is what unit.mjs proves, because the dataset has none today.

## Caveats
- The 390px mobile menu keeps its sections collapsed, so the browser probe runs at 1280 only; S4 pins that Header passes the same filtered nav to MobileMenu.
- Sanity outage reads as "no records": a public build hides the route until revalidation (60 s).
- `ShowSectionNav.tsx` still lists "Past Shows" but is rendered nowhere (dead code); not touched.
- The revalidate/ISR 404: a published past show appears within 60 s.
