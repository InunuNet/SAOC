# nos-critique-r12 F3 — the two not-founds and the missing-ticket branch (sweep-221 and sweep-26f, P2)

Sources:
- lead tasks 2026-10-18: NOS 404; the SAOC 404 extension; /tickets/<missing>, ruled NOS.
- sweep-221 and sweep-26f results.
- BASE main 26fde668.

@architect measured every value below on a 26fde668 `next start` (.tmp/sandbox/r12-arch-base). The positive proof was a full F2-F4 prototype on that tree. That prototype was a test fixture, not a deliverable.

| route | status | title | canonical | description | robots | landmarks / axe |
|---|---|---|---|---|---|---|
| /national-show/zz (NOS 404) | 404 | National Orchid Show \| South African Orchid Council \| South African Orchid Council | the 404 URL | site default | noindex, plus R63's "noindex, nofollow" | 1 main, axe clean |
| /zz (SAOC 404) | 404 | South African Orchid Council (= the home title) | https://saoc.co.za/_not-found | site default | noindex (Next's automatic tag only) | 0 main: axe landmark-one-main and region |
| /tickets/zz | **200** | Tickets \| South African Orchid Council | the 404 URL | site default | noindex | 1 main (the marketing chrome's), axe clean |

## Causes
- **NOS title:** the not-found sets no title, so it takes the NOS layout default 'National Orchid Show | South African Orchid Council' (national-show/layout.tsx:30). That default already ends in the root suffix, and the root template (app/layout.tsx:45) adds it again.
- **Canonicals:** every canonical is the root's `alternates: { canonical: './' }` (app/layout.tsx:49), resolved at the request URL.
- **Hydration flip:** the NOS catch-all (national-show/[...slug]/page.tsx) throws notFound() from the page only. Measured: even with correct not-found metadata, the served HTML is right, but the hydrated head (Chromium, after network idle) flips back to the doubled default title, the 404-URL canonical and the site description. Adding `generateMetadata(): never { notFound(); }` to the catch-all fixes it. /tickets/zz is consistent once its generateMetadata calls notFound().
- **Where the SAOC 404 renders:**
  - For an unmatched URL, app/not-found.tsx renders under the root layout only, with no chrome and no <main>.
  - A notFound() from a marketing page (/tickets/<slug>, /societies/<slug>, /events/<slug>) renders the SAME root not-found inside the marketing ChromeFrame <main>.
  - So a <main> added to app/not-found.tsx alone would nest two <main>s on those routes. A route-group not-found, app/(marketing)/not-found.tsx, catches them first and renders the section without <main>. Measured: 1 <main>, axe clean, on /tickets/zz and /societies/zz.
- **/tickets/zz status:** it answers 200 because tickets/[slug]/loading.tsx streams the shell before notFound() runs. A soft 404 with noindex and no canonical. It is recorded, not fixed here (see the lead list).

## Decision (F3 footprint: goldens/f3-footprint.json)

| file | change |
|---|---|
| app/(marketing)/national-show/not-found.tsx | the metadata statement only: `title: 'Page not found'` (the F24 template renders "Page not found — National Orchid Show \| SAOC"), `description: 'The page you’re looking for doesn’t exist or may have moved.'` (its own lede, :27), `alternates: { canonical: null }`, robots kept (R63, Codi's noindex condition). |
| app/(marketing)/national-show/[...slug]/page.tsx | add `export function generateMetadata(): never { notFound(); }` above the default export. Nothing else. |
| app/not-found.tsx | rename the existing component to the named export `NotFoundSection`, leaving its <section> byte-identical. Add a default export that returns `<main><NotFoundSection /></main>`. Add metadata: `title: 'Page not found'` (root template: "Page not found \| South African Orchid Council", distinct from the home title), `description: 'The page you’re looking for doesn’t exist or may have moved. Start from the home page or find a society near you.'` (its own lede, :28-29, entities resolved), `alternates: { canonical: null }`, `robots: { index: false, follow: false }`. |
| app/(marketing)/not-found.tsx (new) | `import { NotFoundSection } from '../not-found'; export { metadata } from '../not-found';` with a default export returning `<NotFoundSection />` and no <main>. |
| app/(marketing)/tickets/[slug]/page.tsx | generateMetadata: `if (!ticketType) notFound();` and `return { title: ticketType.name };` (F4 then turns this return into buildPageMetadata). The 'Tickets' fallback goes. |

### Sources and checks
- **No invention:** "Page not found" is the eyebrow "404 — Page not found" of both not-founds (national-show/not-found.tsx:21, app/not-found.tsx:22) without the numeral. Each description is that page's own lede.
- **Measured zero visual change:** the <main> has no styles (no `main` rule in app/globals.css). The SAOC section box and the document size at 375 and 1280 are unchanged on /zz, /tickets/zz and /societies/zz (goldens/f3-baseline.json).
- **Robots duplicates:** a SAOC 404 now carries both Next's automatic `noindex` and the explicit `noindex, nofollow`, the same pair the NOS 404 has had since R63. Both say noindex.

Edits (@dev): the five files above, plus docs/nos-critique-r12.md (an F3 section that names the canonical).

Proof:
- f3-static S1-S6.
- f3-rendered: for the NOS 404 (flat and nested), the SAOC 404 (flat and nested) and /tickets/zz-r12-missing, it checks:
  - in both the served HTML and the hydrated DOM: one title, no canonical, the page's lede and noindex;
  - one <main> and no axe-core violation (default rules) at 375 and 1280;
  - the SAOC 404 title is not the home title;
  - boxes equal 26fde668;
  - non-regression for /, /national-show, /national-show/archive and /tickets/vip (title, and canonical https://saoc.co.za/tickets/vip); the vip title may be the 26fde668 one or F4's "VIP Ticket — National Orchid Show | SAOC".
- Negative test at 26fde668: FAIL on every row of the table above (titles, canonicals, descriptions, 0 <main>, landmark-one-main and region). Robots and non-regression green.
- Positive test on the prototype: PASS.

## Addendum (lead 2026-10-18, finding 2): missing entities on three dynamic routes

At 26fde668, /societies/<missing>, /events/<missing> and /national-show/archive/<bad year> serve a 404 page, but their own generateMetadata returns entity metadata, so the hydrated head flips back. Measured at BASE:
- /societies/zz-r12-missing reads "South African Orchid Council" with the slug canonical and the site default description.
- /events/zz-r12-missing reads the same.
- /national-show/archive/1800 reads "1800 — National Orchid Show | SAOC" (or the doubled layout title) with a canonical.

The fix is the one the NOS catch-all got: notFound() inside generateMetadata. The nearest not-found (the marketing one for /societies and /events, the NOS one for the archive) then supplies the head.

| file | change (f3-static S7; comments and blank lines aside, nothing else may change) |
|---|---|
| app/(marketing)/societies/[slug]/page.tsx | `if (!society) return { title: 'Society not found' };` → `if (!society) notFound();` |
| app/(marketing)/events/[slug]/page.tsx | `const title = event?.title ?? 'Event';` + `const description = event?.description ?? undefined;` → `if (!event) notFound();` + `const title = event.title;` + `const description = event.description ?? undefined;` |
| app/(marketing)/national-show/archive/[year]/page.tsx | the `if (!show) { return buildPageMetadata({ … neutral archive … }); }` block → `if (!show) notFound();`. The comment above it may be reworded. |

All three files already import notFound. They are added to goldens/f3-footprint.json.

f3-rendered now also covers these routes in the served HTML and the hydrated DOM at 375 and 1280:
- /societies/zz-r12-missing: HTTP 404, SAOC not-found head, section box vs baseline.
- /events/zz-r12-missing: HTTP 404, SAOC not-found head.
- /national-show/archive/1800: HTTP 404, NOS not-found head.

Each needs one <main> and must be axe clean.

- Negative at 26fde668: FAIL on all three routes, with the titles, canonicals and descriptions above.
- Positive on the prototype (the dev's b34be044 plus the F4 prototype): see the report.

## For the lead (found, not in F3's scope)
- /tickets/<missing> is a soft 404 (HTTP 200; loading.tsx streams first). It is noindex with no canonical after F3. A real 404 needs the ticket lookup to run before the stream starts, which changes the buy screen's loading UX. The lead routed it as P3, outside r12.
