# F2 — Page-by-Page Editability Audit

Read-only audit against the SAOC repo as of 2026-08-11 (commit `aaca3f6`). Method: walked every
page under `app/(marketing)/`, the components each page renders, cross-referenced against
`sanity/schemas/documents/*.ts` and `sanity/queries.ts` (the actual GROQ projections — a schema
field that exists but isn't in the query for a page cannot reach that page regardless of what's
in Studio). `scripts/seed-sanity.ts` was checked to see which singleton page docs (`homePage`,
`aboutPage`, `judgingPage`, `contactPage`, `nationalShow`) are seeded — **none of the five are**,
only reference collections (`award`, `boardMember`, `societyEvent`, `province`, `society`, `show`,
`showClass`, `sponsor`). So for singleton-doc fields, whether Studio currently holds real content
or is blank cannot be determined by reading code alone; I did not query the live dataset (out of
scope for this read-only pass). Where the mission doc already confirms a field is populated
(home Title/Mission Text/Countdown/Hero Images), I've used that; everywhere else I mark content
status as unverified.

**Scope note:** the mission lists "Judges Training" as one of the 8 pages. No such route or
component exists — searched `app/` and `components/` for `judges-training` / `JudgesTraining`,
zero hits. The only judging-adjacent content is the `becomingAJudge` portable-text field embedded
in `/judging` (`sanity/schemas/documents/judgingPage.ts:25`, rendered at
`app/(marketing)/judging/page.tsx:114-129`). Either "Judges Training" was meant to be that
section, or it's a page that was priced but never built — flagging for Brad, not assuming either
way.

Legend: **SANITY** = field is queried and rendered from a Sanity doc today. **HARDCODED** = literal
copy in a `.tsx` file, no schema field backs it. **SCHEMA-EXISTS-BUT-EMPTY** = a schema field
exists and *could* carry the value but content status in Studio is unverified from code alone.
**SCHEMA-EXISTS-BUT-UNUSED** = a schema field exists, is even fetched in some cases, but is never
rendered on this page — dead wiring.

---

## 1. Home (`app/(marketing)/page.tsx`)

Fetches `homePage` (title, heroImages, missionText, countdownDate), `societyEvent` (upcoming),
`sponsor` (partners), `nationalShow` (countdownDate only).

| Field | Component:Line | Status | Current copy |
|---|---|---|---|
| Hero images | `components/home/Hero.tsx:24-31` | SANITY (`homePage.heroImages`) — falls back to `lib/data/heroImages.ts` static images if empty | — |
| Hero eyebrow pill | `components/home/Hero.tsx:75` | HARDCODED | "SINCE 1968 · BLOEMFONTEIN" |
| Hero headline | `components/home/Hero.tsx:79-81` | HARDCODED | "The national home of *orchid culture* in South Africa." |
| Hero lede | `components/home/Hero.tsx:84-86` | HARDCODED (known instance from mission) | "Uniting twenty-one affiliated societies in the cultivation, exhibition, and appreciation..." |
| Hero CTA labels (2) | `components/home/Hero.tsx:94, 100` | HARDCODED (nav-chrome, low priority) | "Find Your Society →" / "19th National Show, 2027" |
| Mission text | `components/home/MissionBlock.tsx:33` | SANITY (`homePage.missionText`) — confirmed populated per mission notes | — |
| Mission fallback paragraph | `components/home/MissionBlock.tsx:35-40` | HARDCODED fallback (only shows if missionText empty) | "SAOC exists to promote the culture, hybridisation..." |
| Mission headline | `components/home/MissionBlock.tsx:25-27` | HARDCODED | "Where South African growers bring their finest blooms to the bench." |
| Mission stats (4) | `components/home/MissionBlock.tsx:1-6` | HARDCODED | 21 Societies / 1968 Founding / 18 Shows / 56 Judges |
| WOSA remit paragraph | `components/home/MissionBlock.tsx:42-50` | HARDCODED, and the link is `href="#"` — dead link, doesn't even point to WOSA | "Our remit is orchids in cultivation..." |
| Nav cards (4 cards × title/body/meta/badge) | `components/home/NavCards.tsx:14-51` | HARDCODED — entire `NAV_CARDS` array, no schema of any kind backs this section | Societies / National Show / Judging / About cards |
| Show band meta (4 items) | `components/home/ShowBand.tsx:9-14` | HARDCODED | Dates "September 2027" / Host Region "Western Cape" / Venue "Cape Town International Convention Centre" / Duration "4 days" |
| Show band headline | `components/home/ShowBand.tsx:57-59` | HARDCODED | "The 19th South African National Orchid Show" |
| Show band countdown | `components/home/ShowBand.tsx:22-28` | SANITY (`nationalShow.countdownDate`, fetched via `nationalShowQuery` in `page.tsx:68`) — falls back to a hardcoded default date `2027-09-18T09:00:00+02:00` | — |
| Upcoming events | `components/home/EventsStrip.tsx:28-38` | SANITY (`societyEvent`) — falls back to `lib/data/events.ts` | — |
| Events section heading | `components/home/EventsStrip.tsx:47` | HARDCODED (low priority, section label) | "Upcoming society shows" |
| Yearbook meta (3) | `components/home/YearbookStrip.tsx:4-8` | HARDCODED — **no schema for a yearbook exists at all** | Editor "Lindiwe Khumalo" / Pages "184" / ISSN "1816-0336" |
| Yearbook headline | `components/home/YearbookStrip.tsx:19-21` | HARDCODED | "*Orchids South Africa* · 2025 yearbook" |
| Yearbook body | `components/home/YearbookStrip.tsx:22-25` | HARDCODED | "Our annual record of award-winning plants, hybridisation notes..." |
| Yearbook image | `components/home/YearbookStrip.tsx:57` | HARDCODED, static file path | `/images/orchid-purple.jpg` |
| Partners/sponsors | `components/home/PartnersSection.tsx:39-42` | SANITY (`sponsor` docs, `active == true`) — falls back to `STATIC_PARTNERS` (6 hardcoded orgs incl. a dead `wosa.org.za` link) | — |

**Whole component with zero Sanity backing:** `YearbookStrip` — not fetched, not wired, nothing
in scope to wire it to without a new schema.

---

## 2. About (`app/(marketing)/about/page.tsx`)

Fetches `aboutPage` (title, pillars, timelineNodes, boardIntroText) and `boardMember` docs.
`title` is fetched but never rendered anywhere on the page (`AboutPageData.title` unused) —
SCHEMA-EXISTS-BUT-UNUSED.

| Field | Location:Line | Status | Current copy |
|---|---|---|---|
| Page hero image/eyebrow/heading/lede | `about/page.tsx:66-71` | HARDCODED — no `aboutPage` field for any of these four | eyebrow "Our heritage", heading "A federated body of growers, since 1968.", lede "Four societies met in Bloemfontein on the 29th of July, 1968..." |
| `aboutPage.title` | `about/page.tsx:19-20, 34-44` | SCHEMA-EXISTS-BUT-UNUSED — fetched, never rendered | — |
| Pillars (mission body) | `about/page.tsx:79-88` | SANITY (`aboutPage.pillars`, portable text) — fallback text if empty | fallback: "SAOC has coordinated orchid cultivation across South Africa since 1968..." |
| Timeline / history | `about/page.tsx:96-104` | SANITY (`aboutPage.timelineNodes`, portable text) — fallback text if empty | fallback: "Founded in 1968, the Council has grown to coordinate orchid societies nationwide." |
| Board intro text | `about/page.tsx:112-116` | SANITY (`aboutPage.boardIntroText`) — no fallback, simply omitted if empty (good pattern) | — |
| Board members | `components/about/BoardGrid.tsx` + `about/page.tsx:46-62` | SANITY (`boardMember` docs) — falls back to `lib/data/board.ts` static list | — |
| WOSA partnership note | `about/page.tsx:120-135` | HARDCODED, static — links to `https://wosa.co.za` (a **third** distinct WOSA URL variant on the site — see cross-page note below) | "SAOC focuses on orchids in cultivation. For wild orchid identification..." |

---

## 3. Societies (`app/(marketing)/societies/page.tsx` + `SocietiesClient.tsx`)

No `societiesListPage` doc type exists — the list page itself has no CMS surface beyond the
`society` collection.

| Field | Location:Line | Status | Current copy |
|---|---|---|---|
| Page hero image/eyebrow/heading/lede | `societies/page.tsx:52-56` | HARDCODED, no schema | eyebrow "Affiliated societies", heading "Find an orchid society near you", lede "21 societies across South Africa — growing, showing, and judging together since 1968." |
| Society directory (name, province, region, founded, meets, venue, memberCount, description, logo, website, markBadge) | `societies/page.tsx:26-48`, `components/societies/SocietyCard.tsx` | SANITY (`society` docs) — full field set queried; falls back to `lib/data/societies.ts` when empty (fallback maps to a reduced field set — `description`, `logo`, `markBadge` always `null` in fallback) | — |
| Province filter chips | `SocietiesClient.tsx:61-78`, sourced from `lib/data/provinces.ts` | Reference data, not editorial content — out of scope for editability, flagging only for completeness | — |

*(`/societies/[slug]` detail pages and the individual society page are out of the 9-page scope
for this audit — not walked in depth, but the same `society` schema/query backs them.)*

---

## 4. Judging (`app/(marketing)/judging/page.tsx`)

The best-wired page in scope — most content sections have real schema fields with sensible
conditional fallbacks. Also serves the only "Becoming a Judge" content that might be what the
mission meant by "Judges Training" (see scope note above).

| Field | Location:Line | Status | Current copy |
|---|---|---|---|
| Page hero image/eyebrow | `judging/page.tsx:50-52` | HARDCODED, no schema field | eyebrow "SAOC judging system" |
| Page hero heading | `judging/page.tsx:53` | SANITY (`judgingPage.title`) — hardcoded fallback "Judging at SAOC" | — |
| Page hero lede | `judging/page.tsx:54` | HARDCODED — always this literal, no schema field, `data.title` doesn't cover it | "Accreditation, awards, and how plants are scored across South Africa." |
| Intro | `judging/page.tsx:63-72` | SANITY (`judgingPage.intro`, portable text) — fallback text if empty | fallback: "SAOC operates a national orchid judging system..." |
| How it works | `judging/page.tsx:80-89` | SANITY (`judgingPage.howItWorks`, portable text) — fallback text if empty | fallback: "Plants are assessed by accredited judging panels..." |
| Stats strip | `judging/page.tsx:93-104` | SANITY (`judgingPage.stats`, array of label/value) — content status unverified; section renders nothing if array is empty (no visible fallback, silently disappears) | — |
| Awards grid | `judging/page.tsx:107-112`, `AwardsGrid.tsx` | SANITY (`award` docs) — **no static fallback**; renders an empty grid if no `award` docs exist | — |
| Becoming a judge | `judging/page.tsx:119-128` | SANITY (`judgingPage.becomingAJudge`, portable text) — fallback text if empty | fallback: "Judging accreditation is earned through a structured training programme..." |
| Judges directory | `judging/page.tsx:45-46, 132-137`, `JudgesDirectory.tsx` | SANITY (`judge` docs referenced from `judgingPage.judges`) gated by `judgingPage.showPublicDirectory` boolean | — |
| Directory gated-off message | `JudgesDirectory.tsx:16-21` | HARDCODED, static, shown whenever directory is off or empty | "The full accredited judges directory is available to SAOC members." |

---

## 5. Events (`app/(marketing)/events/page.tsx`)

No `eventsPage` doc type — the calendar page itself has no CMS surface beyond the `societyEvent`
collection.

| Field | Location:Line | Status | Current copy |
|---|---|---|---|
| Page hero image/eyebrow/heading/lede | `events/page.tsx:77-81` | HARDCODED, no schema | eyebrow "SAOC calendar", heading "Events", lede "Shows, workshops, and council meetings across South Africa's affiliated orchid societies." |
| Event list (title, date, endDate, kind, description, venue, hostSociety, location, isFeatured) | `events/page.tsx:63-69`, `EventCard.tsx`, `MonthGroup.tsx` | SANITY (`societyEvent` docs) — full field set queried; falls back to `lib/data/events.ts` mapped via `getFallbackEvents()` (`events/page.tsx:42-61`) | — |
| "Featured events" / month-group labels | `events/page.tsx:88-90`, `MonthGroup.tsx:13` | HARDCODED section labels, computed month names — low priority chrome | — |

---

## 6. Sponsors (`app/(marketing)/sponsors/page.tsx`)

No `sponsorsPage` doc type — reuses the same `partnersQuery` as the home page's partners section
(`sponsor` docs where `active == true`).

| Field | Location:Line | Status | Current copy |
|---|---|---|---|
| Page hero image/eyebrow/heading/lede | `sponsors/page.tsx:28-32` | HARDCODED, no schema | eyebrow "Our sponsors", heading "The partners behind SAOC", lede "Organisations and businesses that support orchid growing, showing, and judging..." |
| Sponsor grid (name, tier, logo, website, description) | `sponsors/page.tsx:18-23`, `SponsorGrid.tsx` | SANITY (`sponsor` docs) — **no fallback**, renders `null` from `SponsorGrid` and shows the "Become our first sponsor" empty state instead when list is empty | — |
| "Become our first sponsor" empty-state (headline + body + CTA label) | `sponsors/page.tsx:40-52` | HARDCODED — only shown when sponsor list is empty | "Become our first sponsor" / "SAOC is building a community of partners..." |
| "Become a sponsor" CTA band (eyebrow + headline + body + link) | `sponsors/page.tsx:56-72` | HARDCODED — always shown regardless of sponsor list | "Support SAOC" / "Become a sponsor" / "Partner with the national body..." |

---

## 7. Contact (`app/(marketing)/contact/page.tsx`)

Fetches `contactPage` (title, directContacts). Note: **`formRecipients` is defined in the schema
(`sanity/schemas/documents/contactPage.ts:24-29`) but is not selected by `contactPageQuery`
(`sanity/queries.ts`) and is not read anywhere in `app/api/contact/`** — I did not read the
contact API route in full to confirm final delivery address, but the field is unambiguously dead
from the Studio's point of view: whatever a secretary types into "Form Recipients" today has no
code path to anywhere. SCHEMA-EXISTS-BUT-UNUSED, and worth flagging as possibly misleading in
Studio.

| Field | Location:Line | Status | Current copy |
|---|---|---|---|
| Page hero image/eyebrow | `contact/page.tsx:44-46` | HARDCODED, no schema field | eyebrow "Get in touch" |
| Page hero heading | `contact/page.tsx:47` | SANITY (`contactPage.title`) — hardcoded fallback "Contact SAOC" | — |
| Page hero lede | `contact/page.tsx:48` | HARDCODED — always this literal, no schema field | "Questions about societies, shows, judging, or membership? Reach the right person, or send us a message." |
| Direct contacts (name, role, email) | `contact/page.tsx:37-40, 56-76` | SANITY (`contactPage.directContacts` array) — fallback `FALLBACK_CONTACTS` (`contact/page.tsx:27-29`) if empty | fallback: "SAOC Secretariat / General enquiries / info@saoc.co.za" |
| `contactPage.formRecipients` | `sanity/schemas/documents/contactPage.ts:24-29` | SCHEMA-EXISTS-BUT-UNUSED — not queried, not consumed anywhere | — |
| "Direct contacts" / "Send a message" headings | `contact/page.tsx:54, 81` | HARDCODED section labels — low priority chrome | — |
| Contact form (labels, placeholders, success/error copy) | `components/contact/ContactForm.tsx` | HARDCODED throughout — functional form UI, not editorial content, out of scope for CMS wiring | — |

---

## 8. National Show landing (`app/(marketing)/national-show/page.tsx`)

By far the most content-dense page and the least backed by schema. `nationalShow` (the singleton)
has only 6 fields (`title`, `showDate`, `location`, `hero`, `countdownDate`, `exhibitorStages`),
but the rendered page has roughly ten distinct content sections. Notably **`sanityShow.showDate`
is fetched (`nationalShowQuery`) but never rendered anywhere on this page** —
SCHEMA-EXISTS-BUT-UNUSED — while the visible "Dates" field in the hero meta grid is a separate
hardcoded literal that doesn't read `showDate` at all.

| Field | Location:Line | Status | Current copy |
|---|---|---|---|
| Hero eyebrow | `national-show/page.tsx:159-161` | HARDCODED | "The Flagship" |
| Hero edition line | `national-show/page.tsx:92-103, 163-164` | HARDCODED — `toRomanOrdinal(19)` computed from a literal `19` passed at the call site; `nationalShow` schema has **no edition-number field** at all | "XIX · Nineteenth Edition" |
| Hero title | `national-show/page.tsx:112, 165-167` | SANITY (`nationalShow.title`) — hardcoded fallback "The South African National Orchid Show" | — |
| Hero meta: Dates | `national-show/page.tsx:172` | HARDCODED — does not read `nationalShow.showDate`, which is fetched but unused | "18–21 Sep 2027" |
| Hero meta: Host | `national-show/page.tsx:173` | HARDCODED | "Western Cape" |
| Hero meta: Venue | `national-show/page.tsx:113, 174` | SANITY (`nationalShow.location`) — hardcoded fallback "CTICC, Cape Town" | — |
| Hero meta: Cycle | `national-show/page.tsx:175` | HARDCODED | "Triennial" |
| Hero image | `national-show/page.tsx:114, 141` | SANITY (`nationalShow.hero`) — hardcoded fallback `/images/orchid-dark.jpg` | — |
| Countdown | `national-show/page.tsx:115, 192`, `ShowCountdown` component | SANITY (`nationalShow.countdownDate`) | — |
| "About the show" headline + 2 paragraphs | `national-show/page.tsx:220-237` | HARDCODED — no schema field of any kind covers this section | "Three years in the making, four days on the bench" + two body paragraphs |
| "About the show" 4-up stats (editions/cycle/classes/entries) | `national-show/page.tsx:242-256` | HARDCODED | "18 Editions held" / "3 yr Cycle" / "10 Judging classes" / "1,240 Entries — 2024" |
| Three-year cycle timeline (3 entries × year/edition/host/status) | `national-show/page.tsx:86-90, 260-330` | HARDCODED — entire `CYCLE_YEARS` array, no schema | 2024 KZN (past) / 2027 Western Cape (current) / 2030 TBC (future) |
| Three-year cycle footnote | `national-show/page.tsx:326-328` | HARDCODED | "Host province rotates among regional orchid societies nominated by the SAOC board." |
| "Ten judging groups" headline + intro paragraph | `national-show/page.tsx:334-343` | HARDCODED | "Ten judging groups" + "Every exhibit is entered in one of ten botanical classes..." |
| Show classes (code, name, description) | `national-show/page.tsx:107, 117-120, 345-362` | SANITY (`showClass` docs) — falls back to `lib/data/showClasses.ts`; note `group` field is always empty string from Sanity (schema has no `group` field), so the UI falls back to a computed "Group N" label at render time (`page.tsx:354`) | — |
| Exhibitor info headline | `national-show/page.tsx:371-373` | HARDCODED | "Exhibitor information" |
| Exhibitor stages (4 stages × stage/title/dates/description) | `national-show/page.tsx:55-84, 375-398` | SANITY (`nationalShow.exhibitorStages`, portable text) — fallback `EXHIBITOR_STAGES` array if empty (whole fallback is 4 fully-authored stage cards) | — |
| Past shows headline | `national-show/page.tsx:405-410` | HARDCODED | "Past editions" |
| Past shows (year, location, entries, exhibitors, awards) | `national-show/page.tsx:108, 122-135, 403-461` | SANITY (`show` docs, `status == "past"`) — falls back to `lib/data/shows.ts` (top 5 past); note fallback path always sets `edition: 0`, so the "Edition N" badge never shows for Sanity-sourced past shows either since `pastShowsQuery` doesn't select an edition field | — |
| Past show card image | `national-show/page.tsx:417` | HARDCODED static image for every card, ignores `show.heroImage` which exists in schema (`sanity/schemas/documents/show.ts:24-29`) but is never queried by `pastShowsQuery` | `/images/orchid-purple.jpg` |
| `show.summary`, `show.gallery`, `show.results` | `sanity/schemas/documents/show.ts:33-40` | SCHEMA-EXISTS-BUT-UNUSED on this page — not selected by `pastShowsQuery`; may be consumed by `/national-show/archive/[year]` which was not walked (out of scope) | — |
| CTA band headline + paragraph | `national-show/page.tsx:466-472` | HARDCODED | "Start planning your entry now." + "The 19th National Orchid Show opens in September 2027 in Cape Town..." |

---

## Cross-page defects worth flagging (found incidentally, not asked for but material to F3 planning)

- **Three different WOSA URLs across the codebase**: `PartnersSection.tsx:23` uses
  `https://wosa.org.za` (confirmed dead per mission notes — DNS failure), `about/page.tsx:126`
  uses `https://wosa.co.za`, and `Footer.tsx`/mission notes reference `wildorchids.co.za` as the
  real site. None of these three routes through a single source of truth — wiring any of them to
  Sanity should also fix the inconsistency rather than freeze it.
- The home hero's "19th National Show, 2027" CTA (`Hero.tsx:100`) and the nav-show-card's edition
  claim (`NavCards.tsx:27`) and the national-show page's `toRomanOrdinal(19)` (`page.tsx:163`) are
  three independent hardcoded "19" literals. If SAOC ever needs to correct the edition number,
  today that's three files, not one field.

---

## Summary — hardcoded field count per page, ordered by F3 work size

| Rank | Page | Hardcoded content fields (approx.) | Notes |
|---|---|---|---|
| 1 | **National Show landing** | ~28 fields across 8 sections, plus a 4-stage conditional fallback block (12 more if triggered) | Least-covered schema relative to page complexity — `nationalShow` has 6 fields for ~10 content sections. Biggest F3 job by far. |
| 2 | **Home** | ~24 fields across 5 of 7 sections | `YearbookStrip` component (5 fields) has zero Sanity backing of any kind — needs a new schema, not just wiring. `NavCards` (12 fields across 4 cards) also has no schema. |
| 3 | **Sponsors** | ~8 fields (3 hero + 2 empty-state + 3 CTA band) | Sponsor list itself is fully wired; only page chrome is hardcoded. |
| 4 | **About** | ~4 fields (3 hero + 1 WOSA note), plus 1 dead field (`aboutPage.title` fetched but unrendered) | Body content (pillars/timeline/board intro) is well wired. |
| 5 | **Societies** | ~3 fields (hero only) | Directory itself is the best-wired collection in the audit — full field parity between schema, query, and card component. |
| 6 | **Events** | ~3 fields (hero only) | Event list itself is fully wired. |
| 7 | **Contact** | ~3 fields (2 hero + fallback contacts), plus 1 dead field (`formRecipients`) | Best-wired page overall alongside Judging; the `formRecipients` gap is a config/trust risk worth flagging to Brad even though it's not "content." |
| 8 | **Judging** | ~2 fields (hero eyebrow + lede) | Best-wired page in scope — stats/intro/howItWorks/becomingAJudge/awards/judges all reach Sanity with sensible fallbacks. |

**"Judges Training" (9th scoped item) does not exist as a page** — no route, no component. Needs
a decision from Brad before F3 sizing: build it new, or treat `judgingPage.becomingAJudge` as the
answer to that scope item.

## Files read for this audit

- Pages: `app/(marketing)/page.tsx`, `about/page.tsx`, `societies/page.tsx`,
  `societies/SocietiesClient.tsx`, `judging/page.tsx`, `events/page.tsx`, `sponsors/page.tsx`,
  `contact/page.tsx`, `national-show/page.tsx`
- Components: `components/home/*.tsx`, `components/about/BoardGrid.tsx`,
  `components/societies/SocietyCard.tsx`, `components/judging/*.tsx`, `components/events/*.tsx`,
  `components/sponsors/SponsorGrid.tsx`, `components/contact/ContactForm.tsx`,
  `components/ui/PageHero.tsx`
- Schemas: `sanity/schemas/documents/{homePage,aboutPage,contactPage,judgingPage,nationalShow,
  society,sponsor,event,judge,boardMember,showClass,show,award}.ts`
- Queries: `sanity/queries.ts` (full file)
- Seed data: `scripts/seed-sanity.ts` (confirmed which doc types are seeded)
