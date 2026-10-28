# M3-F3 spec: cache-header probe (F3a) and Sanity request volume (F3b)

DECISION: three small product changes remove about 98 percent of Sanity requests, plus two project-owned check scripts.
No Sanity writes, no env changes, no secrets printed.

## F3b product changes (dev implements; paths relative to repo root)

P1. `app/not-found.tsx`: remove `requestSite()` (import `:9`, uses `:29`, `:69`) so the root not-found stops calling `headers()`.
   - Root not-found becomes host-neutral (SAOC chrome and copy: today's non-NOS branch).
   - Keep host-correct 404s with static mechanisms that need no headers():
     * SAOC host: add `app/(marketing)/[...slug]/page.tsx` that calls `notFound()` (resolves to `(marketing)/not-found.tsx`).
     * NOS host: proxy.ts already rewrites every unmatched NOS path to `/national-show/<path>`; add
       `app/(nos)/national-show/[...slug]/page.tsx` calling `notFound()` (resolves to `(nos)/national-show/not-found.tsx`).
     * Both catch-alls: `generateStaticParams` returning `[]`, no `dynamic` export, no headers()/cookies().
     * NOS host, short top-level trees that proxy.ts passes through un-rewritten (verified at proxy.ts:253-273: NOS_TOP_LEVEL_PREFIXES
       and SHARED_PREFIXES call NextResponse.next()): add `app/(nos)/vsp/[...slug]/page.tsx` and
       `app/(nos)/tickets/[slug]/[...rest]/page.tsx` (`/tickets/<a>/<b>`; `(nos)/tickets/[slug]` covers one segment), each only
       `notFound()`, resolving to `(nos)/not-found.tsx` (NOS chrome). On the SAOC host `/vsp/*` and `/tickets/*` are 308 redirects to
       the NOS origin (SHOW_PREFIXES), so they need no SAOC 404.
     * Shared tree `/newsletter/<unknown>`: `app/(shared)/layout.tsx` already calls `requestSite()` and wraps NOS in `NosThemeScope`, so that
       subtree is already dynamic. Add `app/(shared)/newsletter/[...rest]/page.tsx` (only `notFound()`) and `app/(shared)/not-found.tsx`,
       host-aware with `requestSite()`: SAOC host renders `NotFoundSection`, NOS host renders `NosPageNotFound` (bare: the layout owns the
       chrome and the theme scope). A group-level not-found only enters that group's own tree, so it should not make other routes dynamic; A11's
       ISR checks prove it. Only the (shared) not-found may read headers; the root not-found and every catch-all may not.
   - Metadata: `(marketing)/not-found.tsx` and `national-show/not-found.tsx` already export their own `metadata`.
   - If a catch-all cannot be made to build static or loses the host-correct title/chrome, STOP and report DECISION NEEDED
     (fallback: neutral root 404 on the NOS host). Do not re-add headers() to the root not-found.
   - Prove with the build table: `/`, `/about`, ... show `○` and respond `s-maxage=60`.
P2. `sanity/lib/fetch.ts`: extract and export a pure `buildSanityFetchOptions({isDraft, live, tags})` and
   `SANITY_REVALIDATE_SECONDS = 60`, per `goldens/sanity-fetch-options-table.json`.
   - Published, non-live: `next: { revalidate: 60, tags }`. Same tags default `['sanity']`, so `app/api/revalidate`
     (`revalidateTag('sanity','max')` and `revalidateTag(_type,'max')`) keeps invalidating exactly as today.
   - Draft: `cache: 'no-store'`, `useCdn:false`, `perspective:'previewDrafts'`, no revalidate (unchanged semantics).
   - New optional `live?: boolean` on `sanityFetch`: `cache: 'no-store'`, no revalidate.
P3. Route the direct readers through `sanityFetch` so they join the data cache:
   - `lib/view-models/load-presenters.ts:185` (keep the log-and-return-[] boundary; pass `propagateErrors: true` and keep the try/catch
     so failure still logs and returns `[]`), tags `['presenter','sanity']` (use the doc type names in the query).
   - `lib/view-models/load-workshop-sessions.ts:45`, tags `['workshopSession','sanity']`.
   - `lib/view-models/load-ticket-card.ts:100` and `lib/data/ticket-type-lookup.ts:39`: `live: true` (single-type buy path stays uncached; same as today).
   - Do NOT touch `app/api/tickets/checkout/route.ts`, `lib/show-window-lookup.ts`, `sanity/lib/cdn-fallback.ts`, `app/api/revalidate`,
     `app/api/draft`, `app/api/disable-draft`.

Price freshness (Brad's constraint): the checkout route re-reads price, sales state and the show window live and uncached (unchanged),
so a displayed price can never change what is charged. Listing and hub pages show prices at up to 60 s old, which the ISR hub
(`app/(nos)/national-show/page.tsx`, `revalidate = 60`, ticket cards inside) already allows today. The single-type buy reads stay live.
Sanity publish still triggers the tag webhook for immediate refresh (if the webhook is configured, see Needs Brad).

## F3a probe (dev implements)

`scripts/checks/cache-headers-probe.mjs` (project-owned; `execution/` is HARNESS per `.agent/update-manifest.yaml:12`, so not there).
- Modes: `--selftest` (offline: classifier against `goldens/cache-header-expectations.json` selftest_vectors, must pass good, reject bad),
  `--spawn` (start `next start` on port 3219 with SITE_PUBLIC_LAUNCH=true and stub Sanity via the count preload, send both Host headers,
  assert `launched` expectations), `--live --mode walled|launched` (GET `https://beta.saoc.co.za` and `https://nos.saoc.co.za` paths from the golden;
  Basic Auth read inside node from `BETA_BASIC_AUTH_USER/PASSWORD`, never printed; exit 77 when absent).
- Read-only: GET/HEAD only, no body. Exit 0 pass, 1 mismatch, 2 setup error, 77 skip. Print route, class, observed header, verdict.
- `docs/launch-checklist.md` Performance block gains: `- [ ] Cache headers: run node scripts/checks/cache-headers-probe.mjs --live --mode launched`
  (ISR routes `s-maxage=60`, per-request routes `no-store`). Note beside it: while the beta wall is up only `--mode walled` can pass.

## Measurement harness (dev implements)

`scripts/checks/sanity-request-count.mjs` productionises `goldens/reference-measure.mjs` + `reference-count-preload.mjs`
(keep the preload beside it as `scripts/checks/sanity-count-preload.mjs`). Flags: `--build` (run `next build` with the preload and
`NEXT_PUBLIC_SANITY_PROJECT_ID=fakeproj`, FIREBASE_* blanked so no Firestore read occurs, even if `.env.local` exists),
`--assert` (measure, then compare with `goldens/request-count-targets.json` targets; also assert ISR routes answer `s-maxage=60`),
`--ttl-check` (wait SANITY_REVALIDATE_SECONDS+5 s, prove the cache expires and then holds again), `--notfound` (the A13 path matrix: 404 on both hosts, SAOC title ends "South African Orchid Council", NOS title contains "The National Orchid Show").
Empty `.next/cache/fetch-cache` first with `fs.rmSync` on that fixed path. Never use the real project id or any token.

## Accepted gaps (documented, NOT fixed here)

Unknown NOS-host paths that proxy.ts treats as host-neutral (`isHostNeutralPath`, proxy.ts:226): any path with a file extension,
`/og/*`, unknown `/admin/*`, `/api/*`, `/studio/*`. They render the headerless root not-found (SAOC chrome) on nos.saoc.co.za.
Accepted by NOS Site and team-lead: none is a page a visitor navigates to.

## Not in this contract (follow-ups, named for Brad)

- cdn-fallback circuit breaker (stop trying the CDN for N seconds after a 402): halves requests during an outage only.
- Raising SANITY_REVALIDATE_SECONDS above 60: worst case after this fix is about 31 distinct queries per minute per instance
  while every route is hit each minute. A longer window is one constant but depends on the webhook being live.

## Needs Brad (named, not decided)

1. Sanity plan or quota: the repo cannot lift the 402. This contract only reduces volume.
2. Is the Sanity webhook actually configured, and to which URL? docs/launch-checklist.md:126 says `/api/sanity-revalidate`, the route is `/api/revalidate`.
   Until confirmed, keep 60 s.
3. Only if P1's catch-all route cannot give the NOS host its own 404 chrome: accept a neutral 404 there.

## Risks

- P1 changes which 404 renders for odd paths; mitigated by `--notfound`.
- Making `/` and friends static changes their headers to public `s-maxage`; the launch wall still forces private/no-store while up (proxy.ts), covered by `contracts/checks/beta-password-wall`.
- Preview of draft content depends on cookie bypass of the prerender cache; unchanged semantics, covered by the options table.
