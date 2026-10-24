# saoc-seo-polish: expected behaviour (PR-1, branch fix/saoc-seo-polish)

Contract: `contracts/saoc-seo-polish.yaml`. Checks: `contracts/checks/saoc-seo-polish/`.
Source of the findings: QA's crawl of beta. Each was verified in code before it was written here.

Governing rules: `docs/rules/no-invention.md` (no new copy; no visual change in this PR at all),
the design handoff and `branding/` (untouched), and Lee-Ann's answers in
`.tmp/sandbox/health/leeann-doc-2026-10-24.txt` (nothing in it bears on these four findings).

Run the checks with `pnpm exec tsx` for `.mts` files (it resolves the `@/` alias) and `node` for
`.mjs`. The worktree has no `node_modules`; run `pnpm install` in it first.

## (a) Sitemap: `app/sitemap.ts`, new `lib/saoc-sitemap-routes.ts`

Defect: `staticRoutes` was a hand-kept list of six pages and omitted six public ones.

Implement: `lib/saoc-sitemap-routes.ts` exports
`SAOC_STATIC_ROUTES: ReadonlyArray<{ path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }>`
holding exactly the paths in `sitemap-expected.json` `include` (the home page is path `''`).
`buildSaocSitemap()` builds its static entries from it as `${baseUrl}${path}`. The existing six
keep their current changeFrequency and priority; the six new ones are `/sponsors`, `/members`
(monthly, 0.5), `/constitution`, `/privacy`, `/terms`, `/refunds` (yearly, 0.3). The Sanity
society and event blocks and the whole NOS block are not touched.

Decision on `/events/submit`: excluded. It is members-only, its metadata is robots noindex
(after this PR via `noIndex: true`), and a sitemap entry for a noindex URL is a contradiction.
`/media-kit` stays out (gated), and so does `/newsletter/unsubscribe` (token utility page).
`check-sitemap-routes.mts` walks `app/(marketing)` and `app/(shared)` and fails if a static page
is neither listed nor in the golden's `exclude`, so the list cannot drift again.

## (b) og:title on six pages

Defect: these pages export a hand-written `metadata` literal, so `openGraph` falls through to the
root layout's generic "South African Orchid Council".

Implement: in each of `/members`, `/constitution`, `/privacy`, `/terms`, `/refunds`,
`/events/submit` replace the literal with `export const metadata: Metadata = buildPageMetadata({ title, description, lede?, path })`.
Keep each page's existing title (without the site name; the layout template adds it) and its
existing description and `fitDescription` lede, so no copy changes. `/events/submit` is titled
`Submit an Event` (the trailing ` — SAOC` is dropped: the template already appends the site
name) and passes `noIndex: true` (this replaces its `robots: { index: false }`).
It has no description today; use its own on-page sentence verbatim, `Your submission will be reviewed by the council before it appears on the site.` (78 chars, kept as written by `fitDescription`), not new copy.
`/refunds` is not in QA's list but has the same literal; it is included so the sitemap entry
added in (a) lands on a page with a correct og:title.

Accepted consequence: `(shared)` pages (`/privacy`, `/terms`, `/refunds`) are served on both
hosts. `buildPageMetadata` gives them the SAOC canonical on either host, which is the right
duplicate-content answer for the Council's own policies. On the NOS host their og:site_name now
reads "South African Orchid Council".

## (c) `/events/[slug]` metadata

Defect: `generateMetadata` returns `description: undefined` for an event with no description and
hard-codes `openGraph.url` to `https://saoc.co.za/events/<slug>` while the canonical is the site
origin. The JSON-LD `url` on the same page has the same hard-coded origin.

Implement: new `lib/event-metadata.ts` exporting
`buildEventMetadata(event: { title; date; endDate?; description?; venue?; location? }, slug): Metadata`,
which calls `buildPageMetadata({ title: event.title, description, path: '/events/' + slug })`
(that is the "existing origin helper": it builds canonical and og:url through `saocUrl`).
`generateMetadata` returns it. The page's JSON-LD `url` uses `saocUrl('/events/' + slug)`.
Description: a non-blank `event.description` is used as written. Otherwise it is built only from
existing event data, parts joined with `. ` and ended with `.`: title; the start date, plus
` – ` and the end date when the end is a different day (page format: en-ZA, long month, UTC);
venue and location joined with `, ` when present. No other words. Exact strings are in
`event-metadata-fixtures.json`. The OG image stays the `/og?title=` default.

## (d) ICS all-day events: `lib/ics.ts`

Defect: every event is emitted as a timed UTC instant, so the 19th show (23-26 Sept) gets
`DTEND:20270926T000000Z`, which ends it at the start of the 26th.

Implement in `lib/ics.ts` only (both `app/api/events.ics/route.ts` and
`app/api/events/[slug]/ics/route.ts` already build through `buildVCalendar`; neither may format a
date itself). The rule, the line order and 17 cases are in `ics-fixtures.json`. An event is all-day
ONLY when (a) its start is a date-only string, or (b) start AND end are both present, both sit on
the SAME boundary kind (both exactly midnight UTC, or both exactly midnight SAST), and end minus
start is a whole number of days of at least 1. Emit `DTSTART;VALUE=DATE:YYYYMMDD` and
`DTEND;VALUE=DATE:` the day after the last day. A start with no end, mixed boundary kinds, equal or
reversed instants, or any other time is timed and is emitted exactly as today, so a real 02:00 SAST
(00:00Z) or 00:00 SAST (22:00Z) event is not misread. The 19th show (23-26 Sept) still gives
`20270923`/`20270927`. `toIcsDate`, `escapeIcsText`, `buildVEvent`, `buildVCalendar` keep their
signatures.

Accepted residual ambiguity: a genuinely timed event lasting exactly N whole days from one boundary to
the same boundary (e.g. 02:00 SAST to 02:00 SAST the next day) cannot be told from an all-day range
and is emitted as all-day (fixtures `wholeutc24h`, `wholesast24h`). The proper fix is an explicit
`allDay` field on the event later. A date-only start with an instant end is not fixtured.

## Email

None of these four changes sends email or touches an email path, so no `gws_inbox_check` is
declared. The triad coverage linter will report that kind missing; that is correct here.

## Out of scope

No visual change, no new copy, no new route, no change to robots.ts, the NOS sitemap or the
`/media-kit` gate.
