# Baseline: Sanity request volume on origin/main d52d3eb6 (measured 2026-10-28/29)

Method: `pnpm build` then `next start` locally, SITE_PUBLIC_LAUNCH=true, NEXT_PUBLIC_SANITY_PROJECT_ID=fakeproj.
A preload (`goldens/reference-count-preload.mjs`, loaded with NODE_OPTIONS=--import) wraps `globalThis.fetch` BEFORE Next
patches it, so it sees only real network calls (after the Next data cache). Every request to `*.apicdn.sanity.io` /
`*.api.sanity.io` is counted and answered locally with `{"result":null}`: zero live traffic, zero quota, no writes.
Each route is requested twice; `cold` = requests caused by the first, `warm` = by the second. `.next/cache/fetch-cache`
is emptied first. Numbers per route are in `request-count-targets.json`.

## Findings (all confirmed by build output or measurement, not inferred)

1. ROOT CAUSE, every route is dynamic. `next build` marks `/`, `/about`, `/societies`, `/events`, `/judging`, `/contact`,
   `/sponsors`, every `/national-show/*` page and even `/members` as `ƒ` (server-rendered on demand), although the pages
   declare `export const revalidate = 60`. They respond `cache-control: private, no-cache, no-store, max-age=0,
   must-revalidate`. A page whose whole body is `<p>a</p>` fails `dynamic = 'error'` with "used headers()".
   The only `headers()` caller on that path is `app/not-found.tsx:29` and `:69` (`await requestSite()`; import at `:9`):
   the root not-found is host-aware, and Next renders the root not-found into every static route's tree, so it poisons all
   of them. Proof: temporarily replacing those two `requestSite()` calls with constants turns `/`, `/about`, `/societies`,
   `/events`, `/judging`, `/contact`, `/sponsors`, `/members`, `/national-show`, `/faq`, `/programme`, `/sponsors`,
   `/vendors` (NOS) into `○` with `s-maxage=60, stale-while-revalidate=31535940`, and build-time Sanity requests
   fall 61 to 31. (Introduced by the nos-site-split work, #49; docs/f6-cdn-invalidation-investigation.md still describes the
   old static behaviour.)
2. Data-cache gap on per-request routes. `sanity/lib/fetch.ts:38-42` passes `next: { tags }` with no `revalidate`.
   On a dynamic route a tagged fetch with no revalidate is not cached, so every request is a Sanity request:
   `/` 4, `/about` 2, `/events` 3, `/contact` 3, NOS `/` 8, `/programme` 7, `/tickets` 7, `/workshops` 8, `/symposium` 8,
   `/wosa-conference` 9. Adding `revalidate: 60` to that one call takes those routes to 0 warm requests, even on routes that
   stay `force-dynamic` (the route flag does not override an explicit fetch revalidate on this Next version; verified).
3. Direct `client.fetch` callers bypass `sanityFetch` and the data cache entirely (1 request per render each):
   `lib/view-models/load-presenters.ts:185` (symposium, wosa-conference), `lib/view-models/load-workshop-sessions.ts:45`
   (workshops), `lib/view-models/load-ticket-card.ts:100` (single-type ticket card, price bearing).
   Deliberately LEFT as direct live reads: `app/api/tickets/checkout/route.ts:426,505,527,572,700,795` and
   `lib/show-window-lookup.ts:143` (authoritative price/sales/window reads at purchase time).
4. `force-dynamic` pages (reason is real: Firebase stock, admin cookie): `app/(nos)/national-show/{what-to-expect,workshops,
   symposium,conferences,wosa-conference,tickets}/page.tsx`, `app/(nos)/tickets/[slug]/page.tsx:38`, `archive/[year]/page.tsx:88`.
   They stay dynamic. Only their Sanity reads become cached.
5. Within one render Next already de-duplicates identical GET fetches (same URL), so layout-plus-page duplicates were NOT
   found as a cost; `loadShowPageSettings` is issued once per `loadShowPage` and de-duplicated. No draft-mode leak was
   found: `draftMode()` is read in `sanityFetch` only, and a draft read already sets `useCdn: false`.
6. `sanity/lib/cdn-fallback.ts:39-40`: on 402/429/5xx a CDN read is retried once on the API host, so during the current
   plan-limit outage every read costs TWO requests. Not changed here (see spec.md, follow-up).
7. Docs mismatch: `docs/launch-checklist.md:126` tells the operator to point the Sanity webhook at
   `/api/sanity-revalidate`; the route is `app/api/revalidate/route.ts`. Whether the webhook is configured is unknown to the repo.
8. `docs/launch-checklist.md` has NO unchecked cache-header item on origin/main (searched for cache, header, s-maxage, ISR,
   probe). The closest unchecked lines are 194 ("Edit a society in /studio -> page revalidates within 60 seconds") and the
   Performance block (lines 199-201). F3a therefore ADDS a Performance item pointing at the probe.

## Totals (one request to each of 20 routes, second pass)

| | warm Sanity requests |
|---|---|
| origin/main | 92 |
| 3-file experiment (goldens/poc-experiment.patch) | 2 |
| contract target | <= 2, and every ISR route 0 |
