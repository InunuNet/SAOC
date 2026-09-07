# Golden — M6 conversion, SEO and social kit (F17–F19)

Authority for the ticket-purchase conversion surface, the SEO/structured-data layer,
and the social artboard kit.

---

## Part A — F17, ticket purchase as a conversion surface

### A.1 Ownership split — read this before writing any code

F17's brief says "end to end". End-to-end crosses a session boundary:

| Surface | Path | Owner | This milestone |
|---|---|---|---|
| Show ticket front door | `app/(marketing)/national-show/tickets/page.tsx` | **this session** | **F17a — build now** |
| Admission list / buy screen | `app/(marketing)/tickets/**`, `components/tickets/**` | sibling SAOC session | **F17b — specified, blocked** |
| Confirmation | `app/(marketing)/tickets/confirmation/page.tsx` | sibling SAOC session | **F17b — specified, blocked** |

`components/tickets/CategoryTicketsPage` is named in the mission as untouchable; the
same rule applies to the rest of `components/tickets/**` and `app/(marketing)/tickets/**`.
**F17b must not be implemented until the sibling session confirms in writing.** If
confirmation has not arrived, F17a ships alone and F17b is reported as deferred with
the reason — it is not silently dropped and it is not silently done anyway.

### A.2 F17a — `/national-show/tickets`, verified current defects

Read from `app/(marketing)/national-show/tickets/page.tsx` on 2026-09-07:

1. **Orphan grid cell.** Five `OPTIONS` in `grid gap-6 sm:grid-cols-3`. At ≥640px the
   fifth card sits alone in a row of three, leaving an empty cell.
2. **No price anywhere.** A person cannot learn what admission costs without clicking
   through to `/tickets`.
3. **No primary path.** All five cards carry identical weight, identical CTA styling,
   identical body length. The overwhelmingly most common intent — a visitor buying
   admission — is given the same prominence as "I'm a nursery or trader".
4. **Hero contrast.** `PageHero` renders a white heading over `/images/orchid-yellow.jpg`,
   the lightest of the five cleared photographs.

### A.3 F17a — required shape

**Reframe from router to front door with a primary path.**

- **Primary block — admission.** One dominant block, full content width, showing:
  the real "from" price sourced from Sanity `ticketType` (never a hardcoded number),
  the early-bird cutoff if one is set, and one primary CTA to `/tickets`. Any hard
  constraint (must-book, day selection required) is its **own short line adjacent to
  the price**, not folded into prose — Kew's pattern, research §B.
- **Secondary group — taking part.** The remaining four options (exhibitor, vendor,
  conference, workshops) in a **two-column** grid. Four items in two columns leaves no
  orphan cell at any breakpoint. `sm:grid-cols-2`. A three-column grid with a
  non-multiple-of-three item count is the defect being fixed and must not reappear.
- **Copy is preserved verbatim.** The five `OPTIONS` headings and bodies are existing
  real copy. Restyle and re-rank; do not rewrite. Only genuinely new strings (a price
  line, a constraint line) are added, and those come from data.
- **Hero.** Either move to a darker cleared photograph or strengthen the scrim until
  the headline measures ≥4.5:1 against the actual crop. Guardrail 6: the scrim serves
  legibility before mood; test against the real image, not its average.
- **NOS-branded** — this route is inside `app/(marketing)/national-show/**`, so it
  renders through the F1 scoped token layer like every sibling page.

**Conversion and SEO are one decision here, not two.** Google requires each
`offers.url` to be a page whose predominant purpose is selling that specific ticket
(Part B). An index listing five products does not qualify. The per-product pages that
satisfy it — `/tickets/<slug>` — **already exist and are already linked** from
`components/tickets/TicketTypeCard.tsx:121`. So the same structure serves both goals and
neither requires new routes: this front door surfaces the price and hands the visitor to
the dedicated product page, and the Event markup's offers point at those same pages.
The conversion fix and the structured-data constraint resolve together, for free.

### A.4 F17b — buy screen and confirmation (specified, gated)

**Day selection and attendee naming already exist** — `components/tickets/CartDayPicker.tsx`,
`components/tickets/CartAttendeeFields.tsx`, `cartValidation.ts`, backed by F4/F5 schema
fields (`requiresDaySelection`, `requiresAttendeeNames`) and server-side validation of
`chosenDay` against the show window. **Do not rebuild any of it.** F17b is
presentational only: labelling, grouping, error placement, and making the required-vs-
optional distinction visible before submit rather than after.

**Confirmation must read as a ticket, not a receipt.** Current state
(`app/(marketing)/tickets/confirmation/page.tsx`): centred text, a bare `<img>` QR, a
download button. Required shape — a **ticket stub component**, one per position:

- a bounded card with the NOS/SAOC hairline and soft shadow, not free-floating text;
- a perforation rule separating the stub end from the body;
- QR inside the stub end, at its current 240px, alt text unchanged;
- booking reference in monospace at the stub end;
- show name, dates and venue on the body — from Sanity, `data-placeholder` if absent;
- the position's `chosenDay` and attendee name printed on the body when present;
- the download button attached to the stub, not floating below the page;
- a `@media print` rule that renders one stub per page cleanly.

**No new data is required** — every field above already exists on
`getConfirmedOrderForDisplay()`'s `positions`. If a field is null, the stub omits that
line; it never prints a placeholder that looks like real data.

### A.5 Two content questions that are Brad's call — surface, do not resolve

Carried through to the platform README and left open:

1. **The VIP ladder is incoherent.** VIP R300 sits below plain Weekend Pass R400 and
   below Early-Bird Weekend R380, while VIP is described as "Reception access plus
   full-weekend admission" — i.e. strictly more product for less money. Any conversion
   design that presents these five products side by side will make this visible and
   invite the question. **Do not renumber, reorder to hide it, or reword the VIP
   description.** Flag it and ship the honest presentation.
2. **Two live general-enquiry addresses** — `council@saoc.co.za` and `info@saoc.co.za`.
   Do not pick one.

---

## Part B — F18, SEO and discoverability

### B.1 Verified current state

- `app/sitemap.ts` exists. It lists **`/national-show/upcoming`** — which is an
  intentional **308 permanent redirect** (mission constraint 4). A sitemap advertising a
  permanent redirect is a real defect and wastes crawl budget. **Remove it.**
- The sitemap is missing every `/national-show/*` child: `plan-your-visit`,
  `what-to-expect`, `faq`, `exhibitors`, `tickets`, `vendors`, `vendors/apply`,
  `workshops`, `conferences`, and `archive/[year]`.
- `app/robots.ts` exists and is sound (AI crawlers allowed, Bytespider disallowed).
- `components/seo/JsonLd.tsx` provides `JsonLd`, `organizationJsonLd`,
  `breadcrumbJsonLd`. **No `Event` structured data exists anywhere.**
- Only three files touch `openGraph` (`app/layout.tsx`, `(marketing)/page.tsx`,
  `societies/[slug]`, `events/[slug]`). Every `/national-show/*` route ships a bare
  `metadata = { title }`.
- `app/og/route.tsx` exists — a dynamic OG image endpoint. **Extend it with an NOS
  variant; do not add a second endpoint.**

### B.2 Required

**One metadata helper.** `lib/seo.ts` exports a single `buildPageMetadata()` taking
`{ title, description, path, image? }` and returning a Next `Metadata` with title,
description, `alternates.canonical`, `openGraph`, and `twitter` filled consistently.
Every `/national-show/**` route uses it. Per-route hand-rolled `openGraph` blocks are a
defect after this feature.

**Structured data — built against research §H2 (Google Search Central, fetched
directly), NOT §H. Section H's `subEvent`, `EventCompleted` and `previousStartDate`
claims are confirmed wrong and must not be implemented.**

- **Exactly one `Event` node exists on the whole site**: on `/national-show`, for the
  current edition. `name`, `startDate`, `endDate` (bare `YYYY-MM-DD` spanning the full
  show — never a midnight timestamp, which Google flags as a mistake), `location` with
  `location.name` **and** `location.address` from Sanity `showVenue`, and `offers`.
- **No `subEvent`. No `superEvent`. No `eventAttendanceMode`.** Google's Event
  documentation never mentions any of the three. Google's stated pattern for
  separately-ticketed sessions is one standalone Event per session on its own leaf page —
  and its technical guidelines say "the event experience on Google only supports pages
  that focus on a single event". Nesting is folklore; implementing it is wasted work.
- `eventStatus` is limited to the four values Google documents — `EventScheduled`,
  `EventCancelled`, `EventPostponed`, `EventRescheduled`. `EventCompleted` is **not**
  among them and must not appear anywhere in this codebase. `previousStartDate` is
  **ruled out**: it is strictly for a rescheduled instance and requires
  `eventStatus: EventRescheduled` alongside it. It is not a mechanism for linking prior
  years.
- **`offers`** — one `Offer` per Sanity `ticketType`, each with `price` (the lowest
  available price, `0` if free), `priceCurrency: 'ZAR'`, `availability` restricted to
  `InStock` / `SoldOut` / `PreOrder`, `validFrom` where an early-bird cutoff makes the
  offer date-restricted, and `url`.
- **`offers.url` points at `/tickets/<slug>`, never at an index.** Google requires the
  offer URL to be a crawlable page whose *predominant purpose* is selling that specific
  ticket to the general public. `/national-show/tickets` is a router listing five
  products and does **not** satisfy this. **Per-product purchase pages already exist** —
  `app/(marketing)/tickets/[slug]/page.tsx`, linked from
  `components/tickets/TicketTypeCard.tsx:121`. So this constraint is satisfied by
  pointing at what is already built. **No new routes are required for admission.**
- **Every required field must be real.** Google requires `name`, `startDate`,
  `location`. If Sanity does not supply one of them, **emit no Event node at all** rather
  than an Event carrying a fabricated date or venue. A malformed Event is worse than
  none; a fabricated one violates the mission's hardest rule.

**Workshops and conferences — no Event markup, and the reason is missing data, not
route economics.** Google's documented pattern would be one Event per separately-ticketed
session on its own leaf page. Those leaf pages **already exist** (`/tickets/<slug>` is
generated for every `ticketType`, workshop and conference products included), so there is
no route explosion to weigh — the honest blocker is different: **Sanity's `ticketType`
schema carries no session date.** Its fields are name, slug, price, description,
capacity, active, order, show, demo, provisional, earlyBirdCutoff, regularPrice,
releasedQuantity, requiresDaySelection, requiresAttendeeNames, category, capacityPool,
headcountPerUnit. `startDate` is a hard requirement and cannot be supplied.

Therefore: **emit no Event markup on workshop or conference pages in this milestone.**
Recommended follow-up, not in scope here: add `sessionStart` / `sessionEnd` to
`ticketType`, conditioned on `category`, and only then add Event markup to those leaf
pages. Faking a session date to unlock a rich result is exactly the failure this mission
exists to prevent.

**The gated vendor flow carries NO `Event` and NO `Offer` markup — anywhere.** Google's
content guidelines make events requiring "a membership, or invitation prior to purchasing
the ticket" ineligible for the event experience. The vendor registration flow is
single-use-HMAC-token gated, which is precisely that. Marking it up is at best inert and
at worst a guidelines problem. Additionally `/national-show/vendors/register` and
`/national-show/vendors/payment` are token-gated and should carry `noindex` — they are
not public content and have nothing to rank for.

**Cannibalisation — the decision, and it is my judgement, not documented guidance.**
Google's Event feature is framed end to end around upcoming, bookable, attendable events;
nothing in its documentation addresses past editions, and no fetched source resolves the
question either way (research §H2 flags it as open). A past edition is not bookable, so
Event markup on it buys nothing documented while creating a second Event entity competing
under the same series name as the live one.

**Decision: `/national-show/archive/[year]` pages carry NO `Event` markup.** They are
regular content pages — descriptive metadata plus the existing `BreadcrumbList` from
`components/seo/JsonLd.tsx`. `/national-show` is the canonical current edition and the
site's only Event.

The anti-cannibalisation reasoning is unchanged and does not depend on the dropped
vocabulary. Each archive page stays **self-canonical**. Cross-canonicalising them to
`/national-show` would deindex genuinely unique historical content back to 2012 — the
site's strongest long-tail asset. The mechanism is **entity distinctness plus unambiguous
titles**: every archive `<title>` and `<h1>` leads with the year and edition, and every
archive page carries a visible link to the current edition. That was always doing the real
work; `superEvent` was never load-bearing.

**Rejected**: `eventStatus: EventCompleted` on archives (not a value Google documents;
effect unknown, so it is a guess dressed as a standard) and `previousStartDate` linking
editions (explicitly ruled out — rescheduling only).

**Sitemap.** Add every `/national-show/*` child route and every archive year (sourced
from Sanity, not hardcoded). Remove `/national-show/upcoming`. Exclude `/admin/**`,
`/studio/**`, `/tickets/confirmation`, and the F19 social-kit route.

### B.3 The JSX whitespace trap

A live bug class in this repo: an inline close tag ending a source line drops the
following space in rendered output, and **it is not visible in source**. Therefore:

> Any assertion about rendered copy, a rendered title, or a rendered meta tag must
> check **served HTML** — `curl` against a running server — never `grep` against a
> `.tsx` file.

Source greps are permitted only as cheap structural guards, and must be labelled as
necessary-but-not-sufficient.

---

## Part C — F19, social and advertising kit

### C.1 Decision: artboards are a rendered route, exported by script

Artboards live at **`/national-show/social-kit`** — a `noindex`, sitemap-excluded
route rendering each artboard at true pixel dimensions inside a CSS-scaled preview
container. A Playwright export script screenshots each artboard element at
`deviceScaleFactor: 2` into `.agent/evidence/nos-design/social/`.

Sizes, exactly four:

| Name | Pixels | Ratio |
|---|---|---|
| `instagram-square` | 1080 × 1080 | 1:1 |
| `instagram-portrait` | 1080 × 1350 | 4:5 |
| `story` | 1080 × 1920 | 9:16 |
| `facebook-link` | 1200 × 628 | 1.91:1 |

Each artboard element carries `data-artboard="<name>"` and
`data-artboard-size="<w>x<h>"` so the exporter selects by attribute rather than by
DOM position.

### C.2 Rules

- Built from the **NOS scoped tokens and the Layout-B emblem** — Cormorant Garamond
  wordmark, Jost wide-tracked lockup line, flat royal purple / pale gold / white
  fields, or a cleared photograph under a scrim. No gradients, no synthetic textures,
  no duotone on photography.
- Only the **five cleared photographs** in `public/images/` may appear. Scott
  Ormerod's 13 are uncleared and must not be used.
- **Every string comes from Sanity `nationalShow` or a new `socialAsset` document** —
  show name, dates, venue, CTA. A field Sanity does not supply renders
  `data-placeholder`. No invented dates, venues, prices, or names, ever.
- `noindex` via route metadata **and** excluded from `app/sitemap.ts`.
- Story artboards keep all text inside a 250px top / 250px bottom safe area.

### C.3 Rejected alternative

Committing static PNGs to `public/`. Rejected: they desynchronise from the token layer
the moment a colour or the wordmark changes, cannot be regenerated without the original
design file, and put binary assets in git with no way to diff them. A rendered route
re-exports in one command and is always consistent with the shipped brand.
