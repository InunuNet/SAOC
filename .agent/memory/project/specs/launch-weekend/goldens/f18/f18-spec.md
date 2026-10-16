# F18 spec: long-form template, public holding state, ledes, FAQ, exhibitors (F18a) and the v13 keepsake ticket system (F18b)

Base: main 76ad8b98 (F18a) with spec/lw-f18 merged in. Architect: Sonnet 5.5. Skills the dev MUST load and apply (name them in the critique log): `impeccable` (craft-floor, polish, critique), `frontend-design`, `web-design-guidelines`, `accessibility`. No new brand asset, colour, font, shadow, animation or emoji beyond what the approved v13 golden itself carries; no invented copy (section 7).

Dropped from this contract (Brad pivot, 2026-10-17): hub mobile hero image-first (R80), NOS-scoped not-found (R63), vendor apply form polish (R82). The old F16 dual-price catalogue rows, the F17 captions and the old "Estimated total" bar are REPLACED by the v13 keepsake tickets.

## 1. Split (recommended, stated not asked)

| | scope | contract assertions |
|---|---|---|
| F18a | long-form template, holding state, ledes, FAQ, exhibitors, sponsors guard, archive card, Explore index off the hub | A1-A7, A10-A13, A20 |
| F18b | v13 keepsake tickets on the hub, programme and workshop sessions: view-model data layer, cards, pool banner, hero fan, hub page body, conferences and workshops pages, the single-ticket checkout screen, NOS chrome on `/tickets/*`, the retired bare `/tickets` | A14, A21-A24, A27-A30 |

F18b is large. If the lead wants a smaller first pass, cut it as F18b (data layer A27, cards A28, hub passes + fan + pool + checkout and chrome A21-A24, A29, A30) and F18c (the `#programme` brochure tiles, presenters and the workshop sessions list on `/national-show/conferences` and `/national-show/workshops`). The checks already separate these: A28 renders all four components, A29 measures the hub only. One contract, sequential, F18a first (it owns the shared hub page file).

## 2. Mode switch (one rule, no second switch)

Everything "beta-only" is gated on `!withholdPlaceholderProse()` from `lib/data/show-pages.ts`. Public = `SITE_PUBLIC_LAUNCH=true`, or no beta wall, or no `SHOW_PLACEHOLDER_PREVIEW=true`. ISR pages bake the build env, so runtime checks run against a PUBLIC build only (port 3672); beta behaviour is proved at render level (A4, A5, A24, A28). Do not add a prop that reads `process.env` inside a client component.

## 3. F18a items (unchanged from the approved spec; hooks the checks read)

### 3.1 Shared long-form template (R75): /about, /what-to-expect, /vendors, /sa-exhibitors
New server component (suggest `components/show/nos/LongFormPage.tsx`). Copy per route is `goldens/f18/longform-copy.json`, verbatim (typographic quotes and whitespace compare equal). DOM: head (`[data-nos-longform-head]` = section h2 + `[data-nos-longform-lede]`, first paragraph 20px / 1.5), aside (`[data-nos-longform-aside]`), body (`[data-nos-longform-body]`).
- >= 900px: two columns 4fr / 7fr, 64px gap, aside sticky, body paragraphs 16px / 1.55 at <= 60ch. < 900px: one column, aside stacks, not sticky.
- Aside: facts `[data-nos-facts]` (Dates / Host / Venue / Cycle, equal to the hub hero facts), pull quote `[data-nos-pullquote]` where the golden names one, CTA pair `[data-nos-longform-cta]` (Tickets primary + Plan your visit ghost) on about, what-to-expect, sa-exhibitors. /vendors keeps its royal CtaBand to `/national-show/vendors/apply`.
- One image break `[data-nos-image-break]` after `breakAfter` paragraphs: 21:9, `alt=""`, photo from `break-photo-map.json`. The "Explore the show" index stays last.
- Vendors and sa-exhibitors carry the same Lee-Ann copy; do not merge or dedupe (For Lee-Ann).

### 3.2 Public holding state (R76)
`ShowContentState` renders `[data-nos-holding]` in PUBLIC mode when no real prose remains: facts `[data-nos-facts]`, sibling cards `[data-nos-holding-cards]` > `[data-nos-holding-card]` (the OTHER leaves of the route's nav-config group, label + descriptor), the "Be the first to know" band `[data-nos-holding-cta]`. Props the checks drive: `holding?: { facts, statement? }`, `listingEmpty?: boolean`, `hideContentGap` kept. Definite holds: programme, international-guests, wosa-conference (keeps the WOSA link-out as `afterProse`); conditional: archive, faq; never: `mustNotHold` in `holding-audit.json`. Public mode renders no `[data-nos-content-gap]`, no TBC label, no placeholder notice, no purpose line, no `RealEmptyListing` schema preview (`showSchemaPreview?: boolean`, default `!withholdPlaceholderProse()`). Beta mode renders exactly what it renders today. Fallback pages keep `data-nos-content-state="fallback-unpublished"`.

The `/national-show/programme` ROUTE holds in public mode today. The v13 `#programme` section on the HUB is separate from that route and does not change its holding state.

### 3.3 Builder-brief ledes (R76b): `publicHeroLede(summary)` in `lib/data/show-page-presentation.ts`, drops every `drop` in `lede-verdicts.json`, keeps the four public summaries, applied in public mode only; the symposium theme line is untouched.

### 3.4 /faq (R77 #2): `ShowFaqList` `hideUnanswered?: boolean`; hooks `data-faq-summary`, `data-faq-icon`, `data-faq-question`; row >= 44px, icon 20px centred, chip inline <= 12px, native `<details>/<summary>` kept.

### 3.5 Exhibitors TBC duplicates (R77 #3): export `restatesPending(note, status)` using `goldens/f18/exhibitors-tbc.json`; a pending key-date row drops a restating `dateNote`; chips stay.

### 3.6 Sponsors (R77 #6) and archive (R78): the sponsors TBC marker is beta-only (F17-A6 amended); the beta TBC card on `archive/page.tsx` spans the column (no `max-w-*`).

### 3.7 Hub drops the Explore index (R74 #2): remove `NosShowIndex` from `app/(marketing)/national-show/page.tsx` only; the 16 inner routes keep it, last.

## 4. F18b: the v13 keepsake ticket system

Golden: `goldens/f18b/v13-tickets.html` (the approved mock, 2054 lines, measure against it), `goldens/f18b/HANDOFF.md` (the build handoff: sections 1 tokens, 2 LOCKED data interface, 3 components, 4 responsive, 5 accessibility, 6 motion; section 7 is NOT built), and the extracted machine goldens `v13-tokens.json`, `v13-copy.json`, `v13-photo-map.json`, `v13-viewmodel-fixtures.json`. Implement the PAGE BODY only; the existing NOS chrome (`header#nh`, `footer#nf`) is kept, the mock's own header is not built. The dev implements against the goldens, never against its own tests.

### 4.1 Hard rules
- **R7, no invented numbers.** The early-bird pool total and remaining, per-day remaining, and every "N of M" come from real stock (`ticketType.capacity` / `releasedQuantity` from Sanity, sold counts from Firestore). Where no real source exists the number and its sentence are NOT rendered (card has no scarcity line; the pool banner is absent; a day cell shows no count). The mock's sample numbers (`v13-tokens.json` `sampleNumbersBanned`, "Places left are sample numbers for this design.", "Proposed", "Join the waitlist") never appear in HTML or DOM (A29).
- **Photos.** Only the five production photos, mapped in `v13-photo-map.json` (VIP orchid-dark, Sunset orchid-yellow, Weekend orchid-purple, Day orchid-pink, Workshops orchid-violet; Symposium and WOSA none, field colour). No new binary asset anywhere (A10). An `<img>` inside `[data-ticket-stub]` is a THIRD image role beside the hero photo and the long-form break; allowed only on the ticket routes (hub, conferences, workshops, `/tickets/<slug>`), alt empty. `check-f3-imagery` excludes `[data-ticket-stub]` (amended in this spec branch, `supersession.json`); A29 owns the stub rule.
- **Checkout stays identical.** `useTicketCart`, the `/api/tickets/checkout` payload (`items[].ticketTypeId`, `items[].quantity`, chosenDay), reservation and ITN are untouched (A10 forbids `app/api/`, gateway and order libraries). e2e ticket journeys stay green (A14).
- **R81 carried over.** SA-English dates ("Thu 23 Sept 2027", `formatShowDay`, ISO only in `<time datetime>`), zero-cent prices (`R150`, `R250.50`), NOS chrome on `/tickets/*` and the return pages.
- **Vote 2 (checkout screen).** On a `/tickets/*` checkout screen that can reach quantity 0 the Buy button is ENABLED; pressing it shows the inline hint `Choose at least one ticket` (`[data-buy-hint]`, tied by `aria-describedby`) and moves focus to the first quantity field. The old disabled-with-reason pattern is removed (`supersession.json` amends F7 `check-d-ticket-form`).
- **Vote 3.** The card CTA reads `Buy ticket` (sentence case) on EVERY paid product including SAOC Symposium, WOSA Conference and workshop session cards. Never "Register" or "Add to booking". The Workshops product card says `Choose a session` and links `#sessions`.

### 4.2 Data layer (pure, A27; live loader, A21)
`lib/data/ticket-card-view-models.ts` exports the pure `buildTicketCardViewModels(input)` returning `{ cards, pool }`, shapes locked by HANDOFF section 2 and the ten cases of `v13-viewmodel-fixtures.json`. Precedence `pricePending > soldOut > earlyBirdSoldOut > low > available`; `low` at <= 10% remaining; one early-bird pool shared by `weekend-pass-early-bird` and `early-bird` (total = smallest effective capacity of its members, sold = sum of member sold x headcountPerUnit); the early-bird SKU shows while the pool lasts and the regular SKU takes the slot at 0 (banner "Early bird sold out"); `regularPrice` only on early-bird SKUs; `scarcity` null without a real capacity; per-day remaining from real sold-by-day counts or null; never a negative remaining; a product whose type does not exist yields no card.
`lib/data/admission-availability.ts` keeps `planPooledCapacity` / `over-capacity` and its error handling, and gains `loadTicketCardViewModels()`: it reads the real Firestore sold counts and Sanity capacity and calls the pure builder. The three ticket pages (`national-show/tickets`, `national-show/conferences`, `national-show/workshops`) call it; no other file under `app/` or `components/` carries pooled-capacity logic (A21). DECISION NEEDED, recommendation first: the loader inherits the helper's tolerant failure semantics (logs by error name, yields no stock numbers, so no scarcity is shown and nothing sells wrongly; checkout re-checks capacity authoritatively). The alternative, rethrowing, would blank the hub on a Firestore blip.

### 4.3 Components (A28): `components/tickets/keepsake/` with an index exporting `TicketCard`, `SessionTicketCard`, `PoolBanner`, `TicketFan` (plus the brochure tile and presenter card as the dev needs them).
Hooks the checks read (names are the contract): card `data-ticket-card` (`article`, `id="ticket-<productId>"`, `aria-label` = name), `data-ticket-state` (`available|low|soldOut|pricePending|earlyBirdSoldOut`), `data-ticket-session` on session cards, `data-ticket-stub` (aria-hidden, 168px, 150px on sessions, 50px band when stacked, stub on the right and >= 300px wide when the CARD is >= 470px, 11px notches, 10px radius), `data-ticket-body`, `data-ticket-numeral` (Fraunces 300 58px), `data-ticket-name` (29px), `data-ticket-price` (46px, integer rand), `data-ticket-count` (scarcity line), `data-ticket-cta` (50px), `data-ticket-stepper` (44px buttons, group labelled "<name> quantity", buttons "One fewer" disabled at 1 and "One more", output aria-live polite, min 1, max `min(10, remaining)`), `data-ticket-day` (Day Pass: fieldset legend "Choose a day", one native radio per `days[]` entry, per-day states, no count when remaining is null). Not-on-sale states (soldOut, pricePending, earlyBirdSoldOut) render NO stepper and NO CTA. Strings are `v13-copy.json` only. The CTA is a client button that navigates to `/tickets/<slug>?quantity=N[&day=<iso>]` (the existing checkout screen, which prefills and keeps the payload identical); an invalid or out-of-range `quantity` falls back to the default.
`PoolBanner`: `data-pool-banner` role group, numeral + "of <total>", "Early-bird tickets left"; out state "Early bird sold out"; a null pool renders nothing; `data-pool-bracket` from 960px up only.
`TicketFan`: `data-nos-ticket-fan` (kept for F3 compatibility) with four `data-fan-link` anchors `#ticket-vip`, `#ticket-sunset`, `#ticket-weekend`, `#ticket-day`, labelled "<name>, R<price>" / ", price to follow" / ", sold out"; one arc from 701px up; a 2x2 deck below 700px whose cells keep their reserved height (no CLS); a click scrolls to the card and focuses its name.

### 4.4 Hub page (`/national-show/tickets`, A29)
Sections `#thursday`, `#passes`, `#programme`, `#sessions` in that order with the h2 texts of `v13-copy.json` (a section whose products are absent from the CMS is skipped, not faked), the early-bird pool banner above Show passes when real, the "Before you visit" nav (4 links in `v13-tokens.json`) replacing the F16 audience index and Visit rows. The existing `#exhibit` and `#trade` OptionCards stay at the foot of the hub. DECISION NEEDED, recommendation first: keep them (they are the only route from the ticket hub to vendor and exhibitor applications); the alternative is to drop them with the v13 mock, which strands those two audiences. `/national-show/conferences` and `/national-show/workshops` keep answering 200 and adopt the v13 programme tiles and sessions list. The conferences "pending" note stays public (lead call, unchanged).

### 4.5 Retired URL (A30)
Only the bare `/tickets` listing is retired. `app/(marketing)/tickets/page.tsx` becomes `permanentRedirect('/national-show/tickets')` (308; no `next.config` edit, no data fetching). Repoint the links in `tickets/confirmation/page.tsx`, `tickets/cancelled/page.tsx`, `national-show/tickets/page.tsx`, `components/home/ShowBand.tsx` and `components/tickets/ConfirmationPoller.tsx`. `/tickets/<slug>`, `/tickets/cancelled` and `/tickets/confirmation` keep answering.

### 4.6 NOS chrome and the checkout screen (A22-A24)
`ChromeFrame` picks the NOS pair for the `tickets` segment; the `.nos-theme` scope wraps the `/tickets/*` pages (shared wrapper, do not duplicate font config); the typographic NOS inner hero, compact, no stock photo. Single-ticket buy screen: dates via `lib/show-day-format.ts` `formatShowDay` ("Thu 23 Sept 2027"; weekday from the calendar date in UTC; `tokens.json` `tickets.dayFormat` has the cases); one `Total R...` in `[data-catalogue-total]`, `aria-live="polite"`, holding the Buy button, no "estimate"; "Provisional pricing" at most once; "Tickets per day" label 14px sentence case; every R price through `formatRand`; first stepper above `tickets.stepperMaxTop`; day rows `data-day-row`.

## 5. Check inventory (`contracts/checks/launch-weekend/f18/`)

| id | file | proves | needs |
|---|---|---|---|
| A1 | check-a-longform.mjs | 3.1 | public build, 3672 |
| A2 | check-b-imagery.mjs | break-photo rule + R29 hero rule | public build |
| A3 | check-c-holding.mjs | 3.2 live | public build |
| A4 | check-d-holding-render.mts | 3.2 + 3.3 render level | tsx |
| A5 | check-e-faq.mts | 3.4 | public build + tsx |
| A6 | check-f-exhibitors.mts | 3.5 | public build + tsx |
| A7 | check-g-ledes.mjs | 3.3 live | public build |
| A10 | check-j-archive-scope.mjs | allowlist, no invention, no new binary image, archive card | `F18_BASE_REF` |
| A11 | check-k-critique-artefacts.mjs | impeccable evidence: page routes at 390 and 1280, ticket routes at 390, 701, 960, 1280, 1920 | `capture-shots.mjs` |
| A12 | regression chain | surviving F17, F12, F3 checks | public build |
| A13 | check-l-supersession.mjs | hygiene recorded and applied | none |
| A20 | F17 check-m-index.mjs (amended) | 3.7 | public build |
| A21 | check-m-availability.mjs | one stock owner, bare /tickets redirects | none |
| A22 | check-n-ticket-chrome.mjs | 4.6 NOS chrome on /tickets/* | public build |
| A23 | check-o-ticket-buy.mjs | 4.6 + vote 2 live | public build, sales open (skips otherwise, says so) |
| A24 | check-p-tickets-render.mts | 4.6 + vote 2 render level, two TZ | tsx |
| A27 | check-q-viewmodels.mts | 4.2 builder against the fixtures | tsx |
| A28 | check-s-cards-render.mts | 4.3 components in every state | tsx |
| A29 | check-t-hub-live.mjs | 4.3 and 4.4 live at 390, 701, 960, 1280, 1920 | public build |
| A30 | check-u-redirects.mjs | 4.5 | public build |

Build and serve: `SITE_PUBLIC_LAUNCH=true pnpm run build && SITE_PUBLIC_LAUNCH=true pnpm exec next start -p 3672` (never raw `next build`). Ports 3670-3679 only; stop by exact PID. Runtime checks read the CMS read-only. Live content decides which sections exist, so the render-level checks (A4, A5, A24, A27, A28) are the deterministic proof; the live checks prove the build and skip, loudly, a section the CMS lacks.

## 6. Rulings and decisions needing the lead

1. R29 and the image break (F18a): a break photo is allowed only inside `[data-nos-image-break]` on the four long-form routes; `check-f3-imagery` excludes that selector.
2. Stub photos (F18b): `[data-ticket-stub]` is a third image role, ticket routes only, the five production photos only. `check-f3-imagery` excludes `[data-ticket-stub]` too. F16 `check-f-cards` is retired: it pinned the old card photo rule and the F16 rows.
3. DECISION NEEDED (4.4): keep `#exhibit` / `#trade` OptionCards at the foot of the hub. Recommendation: keep.
4. DECISION NEEDED (4.2): helper failure semantics stay tolerant. Recommendation: keep.
5. The vendors pending chip and the sponsors marker are beta-only; reversal is a one-line golden edit.
6. F12/F16/F17 checks that survive were measured green on 76ad8b98 but could not be run against an F18 build in this branch. If the dev finds one red because of an intended F18 change, stop and report it to the lead as an amendment candidate; do not edit checks.

## 7. No invention

Copy comes only from `longform-copy.json`, `v13-copy.json`, existing strings (`strings-allowed.json`, the base tree), nav-config descriptors and CMS values. A10 fails any new 4-word user-visible sentence not found in the base tree or those goldens. Tokens: `nos-theme.css` variables; new CSS goes in `nos-structure.css` under an `F18` comment (pure addition) or inside the new keepsake components. Fonts are the existing Fraunces / Karla variables.

## 8. For Lee-Ann (never resolved by the dev)

- Nine summaries dropped from public heroes as builder briefs: pages 01, 02, 05, 06, 07, 11, 12, 13, 15. Page 07 has no source in her Drive.
- /vendors and /sa-exhibitors carry the same copy (4 vs 3 paragraphs); confirm or supply distinct text.
- The conferences page lede and metadata say "SAOC Symposium"; confirm the product naming.
- The WOSA conference metadata "held alongside" is unsourced.
- Ticket facts with no source, therefore NOT shown: the early-bird pool ceiling, the Weekend Pass ceiling, the per-day ceiling, workshop places, symposium and WOSA places. They appear only when the real stored capacity exists.

## 8b. For Brad (microcopy and calls)

- Microcopy with no source: `Choose at least one ticket` (the checkout inline hint; it replaces the existing `Please select at least one ticket.` per vote 2). All other new strings are the v13 golden's own (`v13-copy.json`).
- Product names on the cards follow the HANDOFF section 2 table (for example "VIP Opening"); the CMS ticket-type names are not renamed.
- The 300 / 500 / 1000 ceilings in the mock are sample numbers: they appear only from real stock, otherwise nothing shows.
- Waitlist is "Proposed" in the mock and is not built.
- Calls recorded: /tickets/* uses the typographic NOS hero; the bare `/tickets` listing is retired with a permanent redirect.

## 9. Source gaps and risks

- `[data-nos-ticket-fan]`: `check-f3-tickets` (A12) pins the OLD hero fan. If it measures the old fan geometry it may go red on the v13 fan: report to the lead as an amendment candidate (the hook is kept for compatibility, the geometry is not).
- Stub photos reuse the five production photos that are also route heroes (orchid-pink is the Day Pass stub and a hero on another route). The roles are separate (hero, break, stub) and each is measured; the critique loop must confirm no page shows the same photo twice above the fold.
- Container queries decide the stub side per CARD, so card measurements are per card (A29), never per viewport.
- `/tickets/confirmation` needs an order and is not probed live; the segment rule covers it.
- Moving `/tickets/*` onto NOS chrome changes the header and footer on payment pages; the checkout redirect, ITN and confirmation email are untouched, but the e2e ticket journeys (untracked in the main checkout) must be run by @qa where available.
- Dev worktrees lack `.env.local`; the build needs Sanity read access (copy it in, delete it at the end).
