# Sanity request volume

## Why

The root `app/not-found.tsx` read the request host through `requestSite()` (`headers()`). Next renders the root not-found into every route's tree, so every page became dynamic and hit Sanity on each request. Measured on a local production build with Sanity stubbed: warm Sanity requests per pass went from 92 to 0, and build-time requests from 61 to 27.

## The rule

- `app/not-found.tsx` and every catch-all page must never read `headers()`, `cookies()` or `requestSite()`.
- Only `app/(shared)/not-found.tsx` may call `requestSite()`. The `(shared)` layout already reads the host, so that subtree is dynamic regardless, and a group-level not-found only enters its own tree.
- Host-correct 404 chrome comes from five catch-alls, each only calling `notFound()`:
  - `app/(marketing)/[...slug]` (SAOC host)
  - `app/(nos)/national-show/[...slug]` (NOS host; `proxy.ts` rewrites unmatched NOS paths there)
  - `app/(nos)/vsp/[...slug]` (NOS, passed through un-rewritten)
  - `app/(nos)/tickets/[slug]/[...rest]` (NOS, `/tickets/<a>/<b>`)
  - `app/(shared)/newsletter/[...rest]`
- Three are static (`generateStaticParams` returns `[]`). `tickets/[slug]/[...rest]` and `newsletter/[...rest]` are `force-dynamic`: a static page under the `[slug]` layout (live ticket read) or the host-reading `(shared)` layout returns 500 ("Page changed from static to dynamic at runtime"). Contract assertions A23 and A24 pin exactly these two.

## sanityFetch options

`buildSanityFetchOptions` in `sanity/lib/fetch.ts` decides the options:

- Published reads: `next: { revalidate: SANITY_REVALIDATE_SECONDS (60), tags }`. Default tags `['sanity']`, so `app/api/revalidate` still invalidates.
- Draft reads and `live: true` reads: `cache: 'no-store'`, no revalidate.
- Use `live: true` for anything that decides price, sales state, show window or availability on a buy path. Current call sites:
  - `app/(nos)/tickets/[slug]/page.tsx:108` (sales state) and `:109` (show window)
  - `app/(nos)/tickets/[slug]/page.tsx:168` (`loadTicketCardViewModels({ live: true })`, Day Pass counts)
  - `lib/data/ticket-type-lookup.ts`
  - `lib/view-models/load-ticket-card.ts`
- Page loaders never call `client.fetch` directly; go through `sanityFetch`. The checkout route (`app/api/tickets/checkout`, `lib/show-window-lookup.ts`) is the deliberate exception: it re-reads price, sales state and window live at purchase time.

## Accepted 60 s staleness

- Hub and listing pages can show sales state up to 60 s old; checkout still refuses a closed sale.
- Order-email and PDF venue and visitor info can lag up to 60 s (QA L3, L4).
- Gap: NOS-host paths with file extensions, `/og/*`, and unknown `/admin`, `/api`, `/studio` keep the SAOC-chrome root 404.

## Probes

Both run from the repo root; Sanity is stubbed and Firebase blanked, so no live Sanity or Firestore is touched. GET only.

- `node scripts/checks/sanity-request-count.mjs --build | --assert | --ttl-check | --notfound`. Run `--build` first; `--assert` refuses a build from a different source revision.
- `node scripts/checks/cache-headers-probe.mjs --selftest | --spawn | --live --mode walled|launched`. `--live` reads `BETA_BASIC_AUTH_USER/PASSWORD` inside node and exits 77 if absent. While the beta wall is up only `--mode walled` can pass; use `launched` after `SITE_PUBLIC_LAUNCH` flips.

## Open items

- QA L1: the gate does not pin the buy-path `live` flags.
- QA L2: 404 cache entries are unbounded.
- The Sanity webhook is unverified, and `docs/launch-checklist.md:126` names `/api/sanity-revalidate` while the route is `/api/revalidate`.
