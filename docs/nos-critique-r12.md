# nos-critique-r12

## F1 - provenance: manifest purposes, the featureRail blurb check, the vendors title pin

Four pre-existing provenance items left `check-descriptor-provenance` and two older checks red on
main 26fde668. No copy is new: every string below already exists on main.

- (a) Archive. 6f805df0 trimmed the archive nav descriptor to 'Previous editions.' but missed the
  route manifest. `scripts/generate-nos-route-manifest.ts` and `content/national-show-routes.json`
  now carry the same purpose, 'Previous editions.', in place of 'Previous editions and their
  champions.'
- (b) Symposium. The F18 rename to "National Orchid Show Symposium" ran end to end in `app/`,
  `components/` and `lib/`, but its sweep did not cover `scripts/` or `content/`. The manifest
  purpose in both files now matches the nav descriptor (`components/chrome/nav-config.ts:216`):
  'The National Orchid Show Symposium — what it is, its theme, and who it is for.' The generator
  keeps its double quotes, and the manifest still regenerates byte-identical from it.
- Neither purpose is rendered. The absent-page fallback (`lib/data/show-pages.ts`) takes a page's
  own purpose, so there is no visual change.
- (c) featureRail blurb. F8 removed the Tickets rail blurb on purpose (menu-system-layout4
  `f8-tickets-rail.json`), so `check-featurerail-blurb-provenance.mjs` is RETIRED with its body
  unchanged. The blurb is not added back; the F8 e2e still asserts that it is gone.
- (d) Vendors title. F24 (911fd349) moved the National Show inner pages onto the layout title
  template, so the vendors page title is now 'Exhibitors and Vendors'. The title pin in
  `check-labels-static.mjs` is re-pinned to it. The label itself is unchanged.

Items (c) and (d) are QA inputs committed by @architect; the code change is (a) and (b), one line
each in the generator and the manifest.

## F2 - single-ticket heading level

Sweep-221 found an axe heading-order violation on `/tickets/vip?quantity=1`: the summary card's
ticket name was an h3 directly under the hero h1.

- `TicketCard` takes `headingLevel?: 'h2' | 'h3'`, defaulting to 'h3' (the `VisitorInfoBlock`
  idiom). The name keeps `data-ticket-name=""` and `className="nk-name"`.
- `tickets/[slug]/page.tsx` passes `headingLevel="h2"` to its summary card. Every other caller
  keeps h3: on the tickets, conferences and workshops pages the cards sit under a section h2.
- `.nos-theme .nk-name` sets every typographic property and outranks `.nos-theme h2`, so the name
  looks the same as an h2 as it did as an h3.

## F3 - the two not-founds and missing entities

Sweep-221 and sweep-26f found that both 404s carried the wrong head, and that the SAOC 404 had no
`<main>`.

- Titles. The NOS 404 took the NOS layout default, which already ends in the site name, so the
  root template doubled it. The SAOC 404 had the home page's title. Both not-founds now set
  `title: 'Page not found'` (their eyebrow without the numeral), so the NOS 404 reads "Page not
  found — National Orchid Show | SAOC" and the SAOC 404 "Page not found | South African Orchid
  Council". Each description is that page's own lede.
- Canonical. Every page inherits the root's `alternates: { canonical: './' }`, so a 404 pointed
  its canonical at the missing URL. Both not-founds set `alternates: { canonical: null }`. Both
  are noindex: the NOS 404 keeps R63's robots, and the SAOC 404 gains the same pair.
- Hydrated head. A page that calls notFound() only from the page body ships the served head
  right, but the hydrated head flips back to the route's own metadata. So `generateMetadata`
  calls notFound() too on the NOS catch-all, `tickets/[slug]` (which loses its 'Tickets'
  fallback), `societies/[slug]`, `events/[slug]` and `national-show/archive/[year]`.
- Landmark. An unmatched URL renders `app/not-found.tsx` under the root layout alone, so its
  section is now the named export `NotFoundSection`, wrapped in `<main>` by the default export.
  A notFound() from a marketing page renders the new `app/(marketing)/not-found.tsx` instead,
  inside the chrome's own `<main>`, so it renders the section bare and re-exports the metadata.
  The section is byte-identical and `<main>` has no styles, so nothing moves.
- `/tickets/<missing>` still answers HTTP 200, because `loading.tsx` streams the shell before the
  lookup fails. It is now noindex with no canonical; a real 404 status is left to the lead.

## F4 - unique meta descriptions

Sweep-26f found the site default description ("The South African Orchid Council (SAOC) —
coordinating orchid societies across South Africa since 1968.") on nine routes. Each route below
now takes its description through `buildPageMetadata` (`lib/seo.ts`), from text the page already
renders. No copy is new.

| route | description source |
|---|---|
| /about | the first sentence of the About copy; the hero has no lede |
| /judging | the hero lede |
| /events | the hero lede |
| /contact | the hero lede |
| /sponsors | the hero lede |
| /tickets/[slug] | the ticket type's Sanity description, which the hero renders as its lede |
| /societies | left at the default: its only lede is withheld on the public build (no source) |

- The four hero ledes move into a `LEDE` constant that both the hero and the metadata read, so
  the rendered text is unchanged.
- `buildPageMetadata` also sets each page's own canonical (the same URL as before) and its
  openGraph and twitter tags, as on every NOS page since F18.
- Ticket titles. `/tickets/*` sits outside `national-show/layout.tsx`, so a ticket's title now
  spells out the NOS suffix: "VIP Ticket — National Orchid Show | SAOC".
- Title casing (Codi R64). Three NOS titles now follow their h1: "What to expect", "Plan your
  visit" and "Sponsors", with their og images to match.
- Symposium. The page's description was meta-talk ("This page is the programme and registration
  hub…"), and its only rendered lede is one 185-character sentence. The description is now that
  sentence cut at a word boundary to 147 characters and ended with "…", the single-route ellipsis
  exception the F24 rules (`_rules.mjs` `ellipsisCut`) allow for `/national-show/symposium`.

## F5 - lockup request guard

F5 is a regression guard only; it changes no app code. Codi reported the 1080 desktop lockups
requested alongside the 828 and 750 mobile ones at a 405px viewport. On fresh loads in Chromium
(390 at DPR 1, 2 and 3, 405 at DPR 2, 700, 701 and 1280) every page requests exactly one header and
one footer lockup, from the `<picture>` source for that width, with no lockup preload. The
{1080, 828, 750} set appears only when the page loads at 1280 (DPR 2) and the viewport is then
resized to 405: the `<picture>` re-selects its source on the media change and fetches the new
candidate, as the spec requires. Measurements: `.agent/memory/scratch/measure-26f/`. The guard
fails any fresh load that requests more than one header or one footer lockup, or a file outside
r9's 2x cap.

## F6 - one section gap after a status disclosure

On `/national-show/what-to-expect` (public mode) and `/national-show/workshops`, a section ends in
a status disclosure and another full section follows on the same ground. Each carried the shared
rhythm, `padding-block: clamp(72px, 9vw, 120px)`, so the gap from the disclosure to the next
content was two stacked units: 230px at 1280 and 144px at 390.

- Two additive rules in `nos-structure.css` apply only when the disclosure is the section's last
  content, either a direct child of `[data-nos-wrap]` or the last child of its last block. The
  section's bottom padding becomes 40px (the `space-y-10` step the page already uses), and the
  following `.nos-section` or `.nk-section` drops its top padding. The gap is now 40px at both widths.
- The shared `.nos-section`, `.nk-section` and `.nos-section-joined` rules are unchanged. A
  disclosure in the middle of a section (exhibitors) does not match, and the stacked ticket
  sections on `/national-show/tickets` are left as they are.
