# Audit fixes, 2026-10-25

Engineering-only fixes from the 2026-10-25 live-site audit. No new copy, brand asset or route. Governing rule:
`docs/rules/no-invention.md`.

| id | finding | fix |
|---|---|---|
| F1 | society pages gave the wrong show cadence | `components/societies/SocietyExpect.tsx` says "triennial" (Lee-Ann's about-2027 and what-to-expect documents) |
| F2 | four NOS pages carried two h1 | `NosHero` takes `titleAs` (`h1` default, `p`); every `loading.tsx` under `app/(nos)` passes `titleAs="p"`. The Suspense fallback stays in the streamed document beside the resolved page, so an h1 there doubled the page's own |
| F3 | NOS 404 had no `lang`, no h1 | see below |
| F4 | NOS sitemap omitted `/contact` and the ticket pages | `lib/nos-sitemap-routes.ts`; slugs come from the cards `/tickets` lists, never a raw ticketType query. `/privacy`, `/terms`, `/refunds` stay out: their canonical is the SAOC host |
| F5 | 3-5 MB hero images | `docs/image-delivery.md` |
| F6 | five fonts preloaded on first paint | JetBrains Mono and Lora set `preload: false` |
| F7 | literal origins in schema and og URLs | `docs/launch-flip-inventory.md` |
| F8 | footer newsletter input lost its focus ring | the existing `focus-visible:outline-2 outline-offset-2 outline-ivory` ring replaces `focus:outline-none` |

## F3, the NOS 404

Measured on `next dev` and `next start`: on this Next (16.4.3) a `notFound()` thrown from a page ships the
`<html id="__next_error__">` shell: status 404, but no `lang` and no h1 in the server HTML, the UI appearing only after
hydration. It is not specific to the NOS tree: a bare page and SAOC `/societies/<bad-slug>` do the same, and so do
nested `not-found.tsx` files. Only a URL that matches no route renders server-side, through the root `app/not-found.tsx`.

NOS unmatched URLs never reached it: `proxy.ts` rewrites them to `/national-show/<path>`, which the catch-all page
`app/(nos)/national-show/[...slug]/page.tsx` owned and answered with `notFound()`. The fix:

- `app/(nos)/national-show/[...slug]/page.tsx` is removed, so unmatched NOS URLs reach `_not-found`.
- `app/not-found.tsx` is host-aware: on the NOS host it renders `NosFrame` (the unified NOS header and footer), the
  `.nos-theme` scope and `NosPageNotFound`; on the SAOC host it is unchanged.
- `NosPageNotFound` (exported from `app/(nos)/national-show/not-found.tsx`, shared with `app/(nos)/not-found.tsx`) is
  the typographic `NosHero` (NOS black, serif h1 at 300, no photo) with the existing strings and the three existing
  buttons. A route with no entry in `components/nos/hero-photos.ts` keeps the hero typographic.

Still client-rendered shells, a framework limit rather than something this batch can fix: a `notFound()` raised by a
real NOS page (`/archive/<bad year>`, `/vendors/<bad>`, `/tickets/<bad>`) and by SAOC pages. They keep their 404
status and `noindex`.
