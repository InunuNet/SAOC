# F18 spec: long-form template, public holding state, ledes, FAQ, exhibitors (F18a) and the v13 keepsake ticket system (F18b)

Base: main 63f3e74d (F18a; was 76ad8b98, which fails A10 on main's own vendor-component and Karla changes) with spec/lw-f18 merged in. Architect: Sonnet 5.5. Skills the dev MUST load and apply (name them in the critique log): `impeccable` (craft-floor, polish, critique), `frontend-design`, `web-design-guidelines`, `accessibility`. No new brand asset, colour, font, shadow, animation or emoji beyond what the approved v13 golden itself carries; no invented copy (section 7).

design-cb is the design lead and its rulings are final (Brad): implement v13 one-to-one; any deviation needs design-cb's yes first. The critique bar for F18b is P0/P1/P2 = 0, impeccable >= 39/40 and design-cb's audit PASS against `goldens/f18b/F18B-AUDIT-CHECKLIST.md`; iteration is uncapped. site-77 owns `components/chrome/UtilityBar.tsx` and the NOS header components (R74 #7): never edit them (A10).

Dropped from this contract (Brad pivot, 2026-10-17): hub mobile hero image-first (R80), NOS-scoped not-found (R63), vendor apply form polish (R82). The old F16 dual-price catalogue rows, the F17 captions and the old "Estimated total" bar are REPLACED by the v13 keepsake tickets.

## 1. Split (design-cb ruling 6)

| | scope | contract assertions |
|---|---|---|
| F18a | long-form template, holding state, ledes, FAQ, exhibitors, sponsors guard, archive card, Explore index off the hub (on main at 47cf7f1b) | A1-A7, A10-A13, A20 |
| F18b | goes to beta first: view-model data layer, TicketCard / PoolBanner / TicketFan, hub sections (#thursday, #passes, #programme as the 3 v13 ticket cards Symposium, WOSA, Workshops with "Choose a session"), section sub-ledes, "Day Pass from" line and ticket close band (R30), the compact #exhibit / #trade row, conferences page with keepsake cards and the R54 links, the R59 WOSA Buy link, checkout screen, NOS chrome on `/tickets/*`, retired bare `/tickets`, R84 motion | A14, A21-A24, A27-A32 |
| F18c | after F18b's audit passes: brochure tiles, presenters, the `#sessions` section and session cards, the `/national-show/workshops` page on the session cards (the F16 rows retire there) | A33, A34 (marked [F18c] in the contract) |

F18b leaves `/national-show/workshops` exactly as it is today; F18c replaces it. One contract, sequential, F18a on main, F18b then F18c.

## 2. Mode switch (one rule, no second switch)

Everything "beta-only" is gated on `!withholdPlaceholderProse()` from `lib/data/show-pages.ts`. Public = `SITE_PUBLIC_LAUNCH=true`, or no beta wall, or no `SHOW_PLACEHOLDER_PREVIEW=true`. ISR pages bake the build env, so runtime checks run against a PUBLIC build only (port 3672); beta behaviour is proved at render level (A4, A5, A24, A28). Do not add a prop that reads `process.env` inside a client component.

## 3. F18a items (unchanged from the approved spec; hooks the checks read)

### 3.1 Shared long-form template (R75): /about, /what-to-expect, /vendors, /sa-exhibitors
New server component (suggest `components/show/nos/LongFormPage.tsx`). Copy per route is `goldens/f18/longform-copy.json`, verbatim (typographic quotes and whitespace compare equal). DOM: head (`[data-nos-longform-head]` = section h2 + `[data-nos-longform-lede]`, first paragraph 20px / 1.5), aside (`[data-nos-longform-aside]`), body (`[data-nos-longform-body]`).
- >= 900px: two columns 4fr / 7fr, 64px gap, aside sticky, body paragraphs 16px / 1.55 at <= 60ch. < 900px: one column, aside stacks, not sticky.
- Aside: facts `[data-nos-facts]` (Dates / Host / Venue / Cycle, equal to the hub hero facts), pull quote `[data-nos-pullquote]` where the golden names one, CTA pair `[data-nos-longform-cta]` (Tickets primary + Plan your visit ghost) on about, what-to-expect, sa-exhibitors. /vendors keeps its royal CtaBand to `/national-show/vendors/apply`.
- No image break (F18a amendment, design-cb audit, R16 one photo per route): `long-form-breaks.ts` is deleted, `breakAfter` is gone from `longform-copy.json`, and A1/A2 assert exactly 0 `[data-nos-image-break]`. /sa-exhibitors has no template h2 and no h2 on the four routes equals the h1. /about has no hero lede (design-cb ruling). The "Explore the show" index stays last.
- Vendors and sa-exhibitors carry the same Lee-Ann copy; do not merge or dedupe (For Lee-Ann).

### 3.2 Public holding state (R76)
`ShowContentState` renders `[data-nos-holding]` in PUBLIC mode when no real prose remains: facts `[data-nos-facts]`, NO related-page cards (section 8: the full Explore index is the one list; the earlier `[data-nos-holding-cards]` mini list is retired), the holding sentence, the "Be the first to know" band `[data-nos-holding-cta]`. Props the checks drive: `holding?: { facts, statement? }`, `listingEmpty?: boolean`, `hideContentGap` kept. Definite holds: programme, international-guests, wosa-conference (keeps the WOSA link-out as `afterProse`); conditional: archive, faq; never: `mustNotHold` in `holding-audit.json`. Public mode renders no `[data-nos-content-gap]`, no TBC label, no placeholder notice, no purpose line, no `RealEmptyListing` schema preview (`showSchemaPreview?: boolean`, default `!withholdPlaceholderProse()`). Beta mode renders exactly what it renders today. Fallback pages keep `data-nos-content-state="fallback-unpublished"`.

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
- **Photos.** Stub photo reuse is allowed as a DISTINCT role (design-cb ruling 3: the 168/150 crop, aria-hidden, ticket routes only); within the ticket routes one photo per product, shared by the fan mini and the section card of that product (A29); Symposium and WOSA use the field colour. Only the five production photos, mapped in `v13-photo-map.json` (VIP orchid-dark, Sunset orchid-yellow, Weekend orchid-purple, Day orchid-pink, Workshops orchid-violet; Symposium and WOSA none, field colour). No new binary asset anywhere (A10). An `<img>` inside `[data-ticket-stub]` is a THIRD image role beside the hero photo and the long-form break; allowed only on the ticket routes (hub, conferences, workshops, `/tickets/<slug>`), alt empty. `check-f3-imagery` excludes `[data-ticket-stub]` (amended in this spec branch, `supersession.json`); A29 owns the stub rule.
- **Checkout stays identical.** `useTicketCart`, the `/api/tickets/checkout` payload (`items[].ticketTypeId`, `items[].quantity`, chosenDay), reservation and ITN are untouched (A10 forbids `app/api/`, gateway and order libraries). e2e ticket journeys stay green (A14).
- **R81 carried over.** SA-English dates ("Thu 23 Sept 2027", `formatShowDay`, ISO only in `<time datetime>`), zero-cent prices (`R150`, `R250.50`), NOS chrome on `/tickets/*` and the return pages.
- **Vote 2 (checkout screen).** On a `/tickets/*` checkout screen that can reach quantity 0 the Buy button is ENABLED; pressing it shows exactly `Choose at least one ticket` (design-cb final ruling: no "Please"; `v13-copy.json` `strings.buyHint`) inline in `[data-buy-hint]`, tied by `aria-describedby`, and moves focus to the first quantity field. The old disabled-with-reason pattern is removed (`supersession.json` amends F7 `check-d-ticket-form`).
- **Sales closed (design-cb ruling, replaces the stand-in-place posture).** While `nationalShow.salesOpen` is false the v13 cards STILL render (fan, sections, stubs, names, sub-ledes, day and session descriptions). Each is masked like `pricePending`: no price, no stepper, no CTA, no input or form (builder state `salesClosed`, outranking every other state; `price`, `regularPrice` and `scarcity` null; `pool` and `dayPassFrom` null). One page-level R11 status line `[data-sales-status]` (`role="status"`) sits after the hero and before the first card, reading the existing "Sales closed" string with a "Be the first to know" link; no new sentence. The pool banner is hidden and the fan labels end ", sales closed". The runbook guarantee holds: no price, form or quantity control. Asserted in both modes: A27 (builder `salesOpen` true and false), A28 (`salesClosed` card render), A35 (live, `NOS_SALES_CLOSED=1` or `0`) and the re-pinned F3-T 1a check in A12.
- **No waitlist (design-cb ruling 5).** soldOut shows the stamp and `This ticket has sold out.`, no CTA, no waitlist wording or link (A28, A29).
- **One name end to end (design-cb ruling 4).** Card, fan, checkout, confirmation and email show the same string, the CMS ticketType name of the SKU rendered (`data-ticket-slug`); the HANDOFF section 2 name never wins. A29 asserts card, fan label and the `/tickets/<slug>` page against the CMS. HANDOFF-vs-CMS differences are listed in 4.10.
- **Vote 3.** The card CTA reads `Buy ticket` (sentence case) on EVERY paid product including the National Orchid Show Symposium, WOSA Conference and workshop session cards. Never "Register" or "Add to booking". The Workshops product card says `Choose a session` and links `#sessions`.

### 4.2 Data layer (pure, A27; live loader, A21)
`lib/data/ticket-card-view-models.ts` exports the pure `buildTicketCardViewModels(input)` returning `{ cards, pool }`, shapes locked by HANDOFF section 2 and the ten cases of `v13-viewmodel-fixtures.json`. Precedence `pricePending > soldOut > earlyBirdSoldOut > low > available`; `low` at <= 10% remaining; one early-bird pool shared by `weekend-pass-early-bird` and `early-bird` (total = smallest effective capacity of its members, sold = sum of member sold x headcountPerUnit); the early-bird SKU shows while the pool lasts and the regular SKU takes the slot at 0 (banner "Early bird sold out"); `regularPrice` only on early-bird SKUs; `scarcity` null without a real capacity; per-day remaining from real sold-by-day counts or null; never a negative remaining; a product whose type does not exist yields no card.
`lib/data/admission-availability.ts` keeps `planPooledCapacity` / `over-capacity` and its error handling, and gains `loadTicketCardViewModels()`: it reads the real Firestore sold counts and Sanity capacity and calls the pure builder. The three ticket pages (`national-show/tickets`, `national-show/conferences`, `national-show/workshops`) call it; no other file under `app/` or `components/` carries pooled-capacity logic (A21). DECISION NEEDED, recommendation first: the loader inherits the helper's tolerant failure semantics (logs by error name, yields no stock numbers, so no scarcity is shown and nothing sells wrongly; checkout re-checks capacity authoritatively). The alternative, rethrowing, would blank the hub on a Firestore blip.

### 4.3 Components (A28): `components/tickets/keepsake/` with an index exporting `TicketCard`, `SessionTicketCard`, `PoolBanner`, `TicketFan` (plus the brochure tile and presenter card as the dev needs them).
Hooks the checks read (names are the contract): card `data-ticket-card` (`article`, `id="ticket-<productId>"`, `aria-label` = name), `data-ticket-state` (`available|low|soldOut|pricePending|earlyBirdSoldOut`), `data-ticket-session` on session cards, `data-ticket-stub` (aria-hidden, 168px, 150px on sessions, 50px band when stacked, stub on the right and >= 300px wide when the CARD is >= 470px, 11px notches, 10px radius), `data-ticket-body`, `data-ticket-numeral` (Fraunces 300 58px), `data-ticket-name` (29px), `data-ticket-price` (46px, integer rand), `data-ticket-count` (scarcity line), `data-ticket-cta` (50px), `data-ticket-stepper` (44px buttons, group labelled "<name> quantity", buttons "One fewer" disabled at 1 and "One more", output aria-live polite, min 1, max `min(10, remaining)`), `data-ticket-day` (Day Pass: fieldset legend "Choose a day", one native radio per `days[]` entry, per-day states, no count when remaining is null). Not-on-sale states (soldOut, pricePending, earlyBirdSoldOut) render NO stepper and NO CTA. Props: `TicketCard({ productId, vm, name, partnerName?, regularName? })` where `name` is the CMS name of the rendered SKU, `partnerName` the partner card's CMS name ("Shared with the <partnerName>") and `regularName` the regular SKU's CMS name ("The <regularName> is now R380."); `TicketFan({ cards, names })`. The article also carries `data-ticket-slug="<sku slug>"`. Strings are `v13-copy.json` only. The CTA is a client button that navigates to `/tickets/<slug>?quantity=N[&day=<iso>]` (the existing checkout screen, which prefills and keeps the payload identical); an invalid or out-of-range `quantity` falls back to the default.
`PoolBanner`: `data-pool-banner` role group, numeral + "of <total>", "Early-bird tickets left"; out state "Early bird sold out"; a null pool renders nothing; `data-pool-bracket` from 960px up only.
`TicketFan`: `data-nos-ticket-fan` (kept for F3 compatibility) with four `data-fan-link` anchors `#ticket-vip`, `#ticket-sunset`, `#ticket-weekend`, `#ticket-day`, labelled "<name>, R<price>" / ", price to follow" / ", sold out"; one arc from 701px up; a 2x2 deck below 700px whose cells keep their reserved height (no CLS); a click scrolls to the card and focuses its name.

### 4.4 Hub page (`/national-show/tickets`, A29, A31)
Sections `#thursday`, `#passes`, `#programme` in that order with the h2 texts of `v13-copy.json` and the sub-ledes of 4.9 (a section whose products are absent from the CMS is skipped, not faked), the early-bird pool banner above Show passes when real, the "Before you visit" nav (4 links in `v13-tokens.json`) replacing the F16 audience index and Visit rows. `#programme` holds exactly the Symposium, WOSA and Workshops ticket cards in that order (Workshops: CTA `Choose a session`, href `/national-show/workshops#sessions`). After the programme (and `#sessions` once F18c ships) comes the compact `#exhibit` / `#trade` row (design-cb ruling 1: two cards side by side from 701, each a name, one existing line, an arrow link >= 44px, the v13 card radius 10px and a drop-shadow, NO stub or ticket card), then the closing ticket band `[data-nos-ticket-close]` (4.7), then the footer. `/national-show/conferences` renders the keepsake cards for the Symposium and WOSA with the R54 links; `/national-show/workshops` is unchanged in F18b. The conferences "pending" note stays public (lead call, unchanged).

### 4.5 Retired URL (A30)
Only the bare `/tickets` listing is retired. `app/(marketing)/tickets/page.tsx` becomes `permanentRedirect('/national-show/tickets')` (308; no `next.config` edit, no data fetching). Repoint the links in `tickets/confirmation/page.tsx`, `tickets/cancelled/page.tsx`, `national-show/tickets/page.tsx`, `components/home/ShowBand.tsx` and `components/tickets/ConfirmationPoller.tsx`. `/tickets/<slug>`, `/tickets/cancelled` and `/tickets/confirmation` keep answering.

### 4.6 NOS chrome and the checkout screen (A22-A24)
`ChromeFrame` picks the NOS pair for the `tickets` segment; the `.nos-theme` scope wraps the `/tickets/*` pages (shared wrapper, do not duplicate font config); the typographic NOS inner hero, compact, no stock photo. Single-ticket buy screen: dates via `lib/show-day-format.ts` `formatShowDay` ("Thu 23 Sept 2027"; weekday from the calendar date in UTC; `tokens.json` `tickets.dayFormat` has the cases); one `Total R...` in `[data-catalogue-total]`, `aria-live="polite"`, holding the Buy button, no "estimate"; "Provisional pricing" at most once; "Tickets per day" label 14px sentence case; every R price through `formatRand`; first stepper above `tickets.stepperMaxTop`; day rows `data-day-row`.

### 4.7 R30, R54, R59 (A31)
- **R30 (1).** `[data-day-pass-from]` under the hub hero CTAs reads `Day Pass from R<amount>` (`v13-copy.json` `dayPassFrom` + the price in zero-cent form). The amount is the builder's top-level `dayPassFrom` (A27): the effective price of the Day Pass card (the early-bird SKU while the pool lasts, never an expired early bird; `resolveEffectivePrice`), `null` when there is no price, in which case the line is NOT rendered (R7).
- **R30 (2).** The hub's closing band is a ticket close: the existing `CtaBand` wrapped in `[data-nos-ticket-close]`, a Tickets link to `#passes` labelled with the nav-config "Tickets" label, no new sentence; nothing renders after it but the footer.
- **R54.** On `/national-show/conferences` the Symposium and WOSA cards link to `/national-show/symposium` and `/national-show/wosa-conference`. The "SAOC/WOSA Joint" clause (`conferences/page.tsx:21,35`) goes where the v13 brochure supersedes the page copy: gone, or the original lede sentence kept verbatim (on Lee-Ann's list).
- **R59.** `/national-show/wosa-conference` carries a link `Buy ticket` to `/national-show/tickets#ticket-wosa` (or `/national-show/conferences#ticket-wosa`), present whether the page holds or not (suggest alongside the WOSA link-out in `afterProse`).

### 4.8 R84 motion, line map, design-cb checklist
- **R84 (A32), the single motion exception to R28.** Three motions only, every one inside `@media (prefers-reduced-motion: no-preference)` (or a `motion-safe:` class): the hero fan-out once on load (`@keyframes fan-out` for the arc, `fan-up` for the 2x2 deck, 1.1s, `cubic-bezier(0.16, 1, 0.3, 1)`), the ticket hover lift (`translateY(-5px)`, 360ms), the button press (`scale(0.98)`). Reduced motion shows the final fanned state. No other `@keyframes` or animation on NOS. A32 checks the CSS statically (names, guard) and the hub at runtime in both motion modes; A10 exempts ONLY `components/tickets/keepsake/**` and the block of `nos-structure.css` between the marker comments `F18-KEEPSAKE-START` and `F18-KEEPSAKE-END`: there `@keyframes` / `animation` are allowed only inside the no-preference media query, durations only from {120, 150, 200, 300, 360, 1100}ms (the fan hover filter 300ms, control transitions 120 / 200ms), `drop-shadow` filters and `color-mix()` of existing tokens; everywhere else no animation and only 150ms. A10 carries negative probes (`motion-rules.mjs`): a keyframe outside the media query fails, a 500ms duration fails, the same motion outside the keepsake paths fails.
- **Colour.** Hex stays OUT of components and CSS (A10): the seven stub field colours (`v13-tokens.json` `palette`) live in a `lib/data/*.ts` constant and reach the components as inline style vars, as the golden does; A10 allows only those seven hex values in `lib/`. rgba only on `drop-shadow(`, `--t-rule`, `--t-edge` or `color-mix()` inside the keepsake paths; elevation is `filter: drop-shadow`, never `box-shadow`.
- **Line map (design-cb, binding).** Against `goldens/f18b/v13-tickets.html`: tokens and field colours l.47-91; buttons l.295 (R17); masthead, countdown, facts and Before-you-visit CSS l.312-361; hero fan CSS l.362-437 (four cards VIP, Sunset, Weekend, Day on one arc pivoting 205px down, cards 326px tall, names and prices legible at >=701, hero stacked below 1240 and side by side with a hard gutter at >=1240, 2x2 deck with reserved cells at <=700, each card one link, hover or focus to the front), markup l.997-1001; sections CSS l.438-461, `#thursday` l.1015 (2 col), `#passes` l.1029 (pool banner l.1035-1040, bracket >=960, 2 col), `#programme` l.1049 (3 col), `#sessions` l.1151; ticket anatomy CSS l.462-545, stub right at container >=470 l.553-566, states l.567-577 (build the states, not the specimen section); view models l.1317-1370 (LOCKED), render l.1371 on, day selector `fieldset.days` legend "Choose a day" l.1394, stepper `role=group` "<name> quantity" l.1441, `article.ticket[data-state]` l.1462; responsive l.728 on. EXCLUDE the review drawer (l.673-727) and the mock SAOC header and footer (l.92-233, l.628-672): the live chrome is used. The same map is in `v13-tokens.json` `lineMap`.
- **design-cb checklist -> assertions** (`goldens/f18b/F18B-AUDIT-CHECKLIST.md`, also an input for @qa and the Codex review A19):

| checklist group | assertion |
|---|---|
| Structure: masthead, fan order and one link per card, <1240 stacked, >=1240 side by side, <=700 2x2 deck and CLS 0, section order, no F16 rows or F17 captions, old URLs redirect | A29, A30, A21 |
| TicketCard: aria-label, h3 under group h2, aria-hidden stub, photo alt, notches, drop-shadow, stub side by container, states and no CTA when not on sale, words not colour alone | A28, A29 |
| Field colours and approved photos only | A29 (photo map), A10 (palette) |
| Controls: Day selector (fieldset, radios, 58px, disabled keep size), stepper (44px, min 1, max min(10, remaining)), CTA 50px, vote 2B on checkout, focus ring | A28, A29, A23, A24 |
| Data R7: no sample numbers, struck regular price, pool 0 swap, scarcity polite | A27, A28, A29 |
| Motion R84 | A32 |
| Layout: 390 no horizontal scroll, 16px gutters, fan tickets 196px | A29 |
| Contrast spot checks (HANDOFF 5), focus colours, greyscale | A11 critique (impeccable + design-cb audit PASS); not mechanically asserted |

### 4.9 Section sub-ledes (design-cb: part of v13)
The one-line scope under each h2 in `#thursday`, `#passes` and `#programme`: `[data-section-lede]`, Karla 16px / 1.55, ink-700, <= 60ch, 8px under the h2. Mock wording verbatim, facts sourced (`v13-copy.json` `sectionLedes`); dates are NEVER typed in, they are interpolated from the Sanity `nationalShow` singleton (R24). Pure builder `buildSectionLedes({ showDate, showEndDate, has, names })` in `lib/data/ticket-section-ledes.ts` (A27, 7 cases):

| lede | wording | source of each fact | omitted when |
|---|---|---|---|
| thursday | `Two evening events on Thursday 23 September.` | day and month: `nationalShow.showDate` (must be a Thursday); "Two": the VIP and Sunset cards both present | no showDate, not a Thursday, or either card absent |
| passes | `Friday 24 to Sunday 26 September.` | start = showDate + 1 day, end = `nationalShow.showEndDate`; weekday and day from the calendar dates | either date missing, or the range crosses a month or year |
| programme | `The National Orchid Show Symposium, the WOSA Conference and workshops.` | CMS ticketType names of the Symposium and WOSA cards, the Workshops card name lower-cased | any of the three cards absent |
| sessions (F18c) | mock: "Workshop titles, times and presenters are still to be confirmed. These cards show each field, and each missing field, with sample counts." | none: design-mock commentary about sample counts | always omitted |

An omitted lede leaves no empty node and no spacer in the head (A29: the h2 is the only child). No date literal in `lib/data/ticket-section-ledes.ts` or the hub page source (A27 static scan). Recommendation: card date lines (the stub numerals and "Thursday 23 September" style lines) derive from the same show dates; not mechanically asserted except through A29's no-sample-number rule.

### 4.10 Product names: HANDOFF vs CMS (for Lee-Ann; the CMS name wins, design-cb ruling 4)
| product | HANDOFF section 2 | CMS ticketType name(s) |
|---|---|---|
| VIP | VIP Opening | VIP Ticket |
| Sunset | Sunset Cocktails | Sunset Cocktails (Single) (the CMS also has a Couple type with no v13 card) |
| Weekend | Weekend Pass | Weekend Pass (Early Bird) while the pool lasts, then Weekend Pass |
| Day | Day Pass | Early-Bird Exhibition Ticket while the pool lasts, then Day Visitor Ticket |
| Symposium | SAOC Symposium | National Orchid Show Symposium, renamed in Sanity on 2026-10-17 by design-cb (its Early-Bird, the WOSA Early-Bird and the SAOC/WOSA Joint types have no v13 card) |
| WOSA | WOSA Conference | WOSA Conference |
| Workshops | Workshops | none: a link card to the sessions, not a purchasable type |
The partner wording ("Shared with the Day Pass") and "The Weekend Pass is now R380." therefore read the partner's and the regular SKU's CMS names too. Lee-Ann may want renamed CMS entries (for example Day Pass) so the pass names read well; that is a CMS edit, not code.

### 4.11 Design pack, rail ids, typographic quotes
- **NOS chrome v4 pack** (Brad approved 2026-10-15; `goldens/nos-v4/`: DESIGN-PACK.md, handoff/HANDOFF.md + chrome.css with 13 decisions and acceptance checks, index, plan-your-visit, symposium and tickets mocks). Rulings after 2026-10-15 override v4 where they conflict: the hub h1, the CTAs, Members hidden, 16/1.55 and no hub index. `tickets.html` there is pre-v13; v13 supersedes it.
- **Mega-menu rail.** The v4 rail's "Day Visitor" and "Weekend Pass" text links land on the ticket cards: F18b only provides the stable ids `#ticket-day` and `#ticket-weekend` on the v13 Day and Weekend cards (A29 asserts the ids exist). site-77 owns the nav-config href change; F18b does not edit nav-config or NosHeader.
- **Typographic quotes (standing design-cb ruling, both F18 commits).** Rendering straight quotes and apostrophes as typographic ones is typography, not new copy: A10 normalises the curly quotes to straight before its copy diff, with probes (a typographic form of an existing sentence passes, a genuinely new word still fails).

## 5. Check inventory (`contracts/checks/launch-weekend/f18/`)

| id | file | proves | needs |
|---|---|---|---|
| A1 | check-a-longform.mjs | 3.1 | public build, 3672 |
| A2 | check-b-imagery.mjs | zero image breaks (R16) + R29 hero rule | public build |
| A3 | check-c-holding.mjs | 3.2 live | public build |
| A4 | check-d-holding-render.mts | 3.2 + 3.3 render level | tsx |
| A5 | check-e-faq.mts | 3.4 | public build + tsx |
| A6 | check-f-exhibitors.mts | 3.5 | public build + tsx |
| A7 | check-g-ledes.mjs | 3.3 live | public build |
| A10 | check-j-archive-scope.mjs | allowlist, no invention, no new binary image, archive card; R84 motion, hex and shadow rules with negative probes (motion-rules.mjs) | `F18_BASE_REF` |
| A11 | check-k-critique-artefacts.mjs | impeccable evidence (score >= 36/40 gate floor, aim 39; design-cb audit PASS line): page routes at 390 and 1280, ticket routes at 390, 701, 960, 1280, 1920 | `capture-shots.mjs` |
| A12 | regression chain | surviving F17, F12, F3 checks | public build |
| A13 | check-l-supersession.mjs | hygiene recorded and applied | none |
| A20 | F17 check-m-index.mjs (amended) | 3.7 | public build |
| A21 | check-m-availability.mjs | one stock display owner (app/api/ exempt, negative probes), bare /tickets redirects | none |
| A22 | check-n-ticket-chrome.mjs | 4.6 NOS chrome on /tickets/* | public build |
| A23 | check-o-ticket-buy.mjs | 4.6 + vote 2 live | public build, sales open (skips otherwise, says so) |
| A24 | check-p-tickets-render.mts | 4.6 + vote 2 render level, two TZ | tsx |
| A27 | check-q-viewmodels.mts | 4.2 builder against the fixtures, dayPassFrom, 4.9 sub-ledes (7 cases) and the no-date-literal scan | tsx |
| A28 | check-s-cards-render.mts | 4.3 components in every state | tsx |
| A29 | check-t-hub-live.mjs | 4.3 and 4.4 live at 390, 701, 960, 1280, 1920 | public build |
| A30 | check-u-redirects.mjs | 4.5 | public build |
| A31 | check-v-links-from.mjs | 4.7 R30 line and close band, R54 links, R59 Buy link | public build |
| A33 | check-s-cards-render.mts (F18_PART=c) | [F18c] SessionTicketCard null cases, session CTA | tsx |
| A34 | check-x-sessions-live.mjs + A21 with F18_PART=c | [F18c] #sessions, session cards, workshops page on them | public build |
| A32 | check-w-motion.mjs | 4.8 R84 static guard and runtime in both motion modes | public build, `F18_BASE_REF` |

Build and serve: `SITE_PUBLIC_LAUNCH=true pnpm run build && SITE_PUBLIC_LAUNCH=true pnpm exec next start -p 3672` (never raw `next build`). Ports 3670-3679 only; stop by exact PID. Runtime checks read the CMS read-only. Live content decides which sections exist, so the render-level checks (A4, A5, A24, A27, A28) are the deterministic proof; the live checks prove the build and skip, loudly, a section the CMS lacks.

## 6. Rulings and decisions needing the lead

1. R29 and the image break (F18a): RETIRED by the amendment. One photo per route; A2 asserts 0 breaks. `check-f3-imagery` keeps an inert exclusion only for A13.
2. Stub photos (F18b): `[data-ticket-stub]` is a third image role, ticket routes only, the five production photos only. `check-f3-imagery` excludes `[data-ticket-stub]` too. F16 `check-f-cards` is retired: it pinned the old card photo rule and the F16 rows.
3. RESOLVED (design-cb ruling 1): `#exhibit` / `#trade` stay at the foot of the hub as the compact 2-card row (4.4).
4. DECISION NEEDED (4.2): helper failure semantics stay tolerant. Recommendation: keep.
5. CLOSED (4.1 sales closed): design-cb ruled that the v13 cards stay, masked, with one page-level status line (section 7).
6. The vendors pending chip and the sponsors marker are beta-only; reversal is a one-line golden edit.
7. F12/F17/F3 checks that survive were measured green on 76ad8b98 but could not be run against an F18 build in this branch. If the dev finds one red because of an intended F18 change, stop and report it to the lead as an amendment candidate; do not edit checks.

## 7. No invention

Copy comes only from `longform-copy.json`, `v13-copy.json`, existing strings (`strings-allowed.json`, the base tree), nav-config descriptors and CMS values. A10 fails any new 4-word user-visible sentence not found in the base tree or those goldens. Tokens: `nos-theme.css` variables; new CSS goes in `nos-structure.css` under an `F18` comment (pure addition) or inside the new keepsake components. Fonts are the existing Fraunces / Karla variables.

## 8. For Lee-Ann (never resolved by the dev)

- Nine summaries dropped from public heroes as builder briefs: pages 01, 02, 05, 06, 07, 11, 12, 13, 15. Page 07 has no source in her Drive.
- /vendors and /sa-exhibitors carry the same copy (4 vs 3 paragraphs); confirm or supply distinct text.
- The Symposium is now "National Orchid Show Symposium" end to end (design-cb, Sanity renamed 2026-10-17; section 7). The WOSA Conference and "SAOC/WOSA Joint" names are unruled and stay as the CMS has them; the three remaining HANDOFF-vs-CMS name differences (4.10) go to Lee-Ann, and the CMS names render until she answers.
- The WOSA conference metadata "held alongside" is unsourced.
- Ticket facts with no source, therefore NOT shown: the early-bird pool ceiling, the Weekend Pass ceiling, the per-day ceiling, workshop places, symposium and WOSA places. They appear only when the real stored capacity exists.

## 8b. For Brad (microcopy and calls)

- Microcopy: the checkout hint is exactly `Choose at least one ticket` (design-cb ruling, in `v13-copy.json`). New strings are the v13 golden's own plus `Day Pass from` (R30, with the live price) and the three section sub-ledes (4.9).
- Product names on the cards are the CMS ticketType names (design-cb ruling 4); the HANDOFF names are not used (table in 4.10).
- The 300 / 500 / 1000 ceilings in the mock are sample numbers: they appear only from real stock, otherwise nothing shows.
- No waitlist: sold-out shows the stamp and "This ticket has sold out." only.
- Calls recorded: /tickets/* uses the typographic NOS hero; the bare `/tickets` listing is retired with a permanent redirect.

## 9. Source gaps and risks

- `[data-nos-ticket-fan]`: `check-f3-tickets` (A12) pins the OLD hero fan. If it measures the old fan geometry it may go red on the v13 fan: report to the lead as an amendment candidate (the hook is kept for compatibility, the geometry is not).
- Stub photos reuse the five production photos that are also route heroes (orchid-pink is the Day Pass stub and a hero on another route). The roles are separate (hero, break, stub) and each is measured; the critique loop must confirm no page shows the same photo twice above the fold.
- Container queries decide the stub side per CARD, so card measurements are per card (A29), never per viewport.
- `/tickets/confirmation` needs an order and is not probed live; the segment rule covers it.
- Moving `/tickets/*` onto NOS chrome changes the header and footer on payment pages; the checkout redirect, ITN and confirmation email are untouched, but the e2e ticket journeys (untracked in the main checkout) must be run by @qa where available.
- Dev worktrees lack `.env.local`; the build needs Sanity read access (copy it in, delete it at the end).

## 6. F18a amendment (design-cb audit and Athanor review, 2026-10-17)

- Archive, public, no past show: the page is the hero, then ONE card carrying the existing string "Show history awaiting committee records", then the Explore index. No facts rail, no related-page mini list, no planning band, no `[data-nos-holding]` section. Archive leaves `holdingConditional` in `holding-audit.json` and has its own `archiveHolding` shape asserted in A3. Beta and with-editions branches are unchanged.
- Unsourced hub facts (Athanor 1), checked 2026-10-17 against `content/drive-source/`, `content/show-pages/` and live Sanity (26yfbug4/production):
  - Sourced and kept: "19th show" (Sanity `nationalShow.edition` = 19, ordinal derived); "ten classes" (Sanity holds exactly 10 `showClass` docs, count derived); triennial / 3 yr cycle (Drive 2.1 About v1.0, paragraph 1, "premier triennial event").
  - Unsourced, withheld in public through `withholdPlaceholderProse()` and marked on beta: "18 shows hosted" (inference from edition minus one, Sanity has 0 `pastShow`), "100-point scale", "Grand Champion", the judging-criteria line (cultural quality, presentation, species accuracy; /judging says form, colour, size, cultural condition), and "nine provinces" (page and og descriptions).
  - A3 asserts the public `/national-show` HTML contains none (the SAOC home `/` is F19's: its "nine provinces" is in `components/home/NavCards.tsx`) of the unsourced strings (`holding-audit.json` `hubFacts.unsourced`).
- /national-show/wosa-conference (Athanor 2): public mode shows the F18a holding state (existing strings, R11) and keeps the "Buy ticket" link to `#ticket-wosa` that A31 requires. A3 asserts both.
- Heading order (Athanor 3): A3 asserts the first heading is h1 and levels never skip on /national-show/about and /national-show/workshops.
- `check-f3-imagery.mjs` line 9 no longer describes the break rule.

## 7. F18b follow-up (design-cb rulings, 2026-10-17)

- Stable ids (A29). `#ticket-day` and `#ticket-weekend` each exist exactly once on the hub, on the Day card (early-bird or day-visitor SKU) and the Weekend card (weekend-pass-early-bird or weekend-pass SKU), and as a document id. site-77's mega-menu rail links depend on them. F18b does not edit nav-config or NosHeader.
- Sales closed (A27, A28, A35, F3-T 1a re-pin). See the 4.1 bullet above. New hook `[data-sales-status]` in `v13-tokens.json`; `salesCases` in `v13-viewmodel-fixtures.json`; the existing strings "Sales closed" (`components/tickets/SalesClosedNotice.tsx`) and "Be the first to know" (`HoldingState`) are the only copy. `check-f3-tickets.mjs` is re-pinned: while closed the cards still render with no CTA, stepper or button and exactly one status line on `/tickets`.
- Symposium naming sweep (A36). The product is "National Orchid Show Symposium" in the card, fan, sub-lede, checkout and receipt, because the CMS name wins (ruling 4) and Sanity was renamed. Code that hardcodes "SAOC Symposium" desyncs from the CMS. The dev changes only that phrase, in code (comments excluded): `lib/ticket-taxonomy.ts` (`symposium`), `lib/provisional-figures.ts` (the fallback name and description), the conferences, programme and symposium pages (the symposium h1 stays Brad's "National Orchid Show Symposium"), `lib/data/builder-brief-summaries.ts`, and any other hit the A36 scan prints. Two hits are site-77's (`components/chrome/nav-config.ts`, `components/show/ShowSectionNav.tsx`) and print as notes. The programme sub-lede interpolates the CMS name (`The {symposium}, the {wosa} and workshops.`) and must not type "SAOC" before it (A36 scans `lib/data/ticket-section-ledes.ts`). A10 treats "National Orchid Show Symposium" and "SAOC Symposium" as the same phrase when diffing copy, with probes. "SAOC/WOSA Joint" is untouched. The fixtures in `v13-viewmodel-fixtures.json` and `v13-copy.json` carry the new name.
- Typographic quotes: already exempt in A10 (c325df87).

## 8. F18b commit 4 (design-cb rotation rulings, 2026-10-17)

1. /national-show/conferences hero lede is "Register for the National Orchid Show Symposium or the WOSA Conference." It is the old sentence minus the non-existent "combined SAOC/WOSA Joint track", with Brad's name. It supersedes F18's verbatim hold because the old copy states something false (`supersession.json`). The meta description follows ("Register for the National Orchid Show Symposium or the WOSA Conference at the South African National Orchid Show.", `v13-copy.json`). For Lee-Ann: confirm there is no combined Joint track at the 2027 show.
2. Conferences R11 card. A card holding only a "To be confirmed" chip leaves about 120px of empty surface. It gets the R11 anatomy (chip, surface and an existing sentence), or it is dropped when no existing sentence fits. A37 asserts no `.nos-surface` in main holds only a chip (fewer than four words of sentence once the chip text is removed). The dev must not invent the sentence: it comes from the base tree or `strings-allowed.json`, or the card goes.
3. Conferences ticket cards move to v13 in F18b. If they are the F18c SessionTicketCard in the split, only these fixes move: whole rand with no decimals ("R2000"), the v13 card shadow and no 1px olive border (R17), Buy enabled at quantity 0 with the inline "Choose at least one ticket" hint (vote 2B), and the total reading "Estimated total" exactly once with no "(ESTIMATE)" suffix and no "R0.00". A37 asserts each where the element renders. A23's "Total R..." (R62) stays for `/tickets/<slug>`; the two surfaces are separate.
4. Template rule. When the full Explore index renders, the mini "Explore the show" list (the holding state's related-page cards and their eyebrow) does not. A3 asserts it on every route in the audit (international-guests, archive, every holding route and the long-form pages), A4 at render level, and both keep the holding sentence and the "Be the first to know" band. The holding state keeps its facts list.

## 9. Preview-mode hub facts and the WOSA anchor (design-cb, 2026-10-17)

- Preview half of the hub-facts rule (A3). On a `SHOW_PLACEHOLDER_PREVIEW=true` build each unsourced fact group (`holding-audit.json` `hubFacts.previewGroups`: "18 shows", "100-point" or "100 point", "Grand Champion", "nine provinces", "cultural quality", "species accuracy") is PRESENT on `/national-show` and sits inside a `[data-placeholder]` or "To be confirmed" marker. Withholding must not make a fact vanish on preview. The public half stays at 0 hits. The preview base URL is `PREVIEW_URL` (falling back to `BASE_URL`); the public build is `NOS_BASE`. A missing preview URL is a note, or a failure when `F18_REQUIRE_PREVIEW=1`.
- WOSA anchor (A29, A31). The "Buy ticket" link on `/national-show/wosa-conference` points at `#ticket-wosa`. A29 asserts the id exists on the hub exactly once, on a ticket card, and A31 fails (it was a note) when the destination has no `id="ticket-wosa"`.

- Chip count (design-cb pass condition for F18a): on the preview `/national-show`, the number of `[data-placeholder]` blocks equals the number of those blocks containing a visible R11 chip (non-zero size, not `display:none` or `visibility:hidden`, not under `aria-hidden`). A marked block without a chip fails; a probe proves it.

## 10. Check-versus-golden rulings (lead, 2026-10-17)

1. A29 horizontal stub. In `v13-tickets.html` and `v13-tokens.json` the horizontal stub is `--stub` WIDE (168px, 150 on session cards) with `min-height: 300px`. A29 now asserts width equal to `--stub` and height at least 300px (non-session cards). The token `horizontalStubMinPx` is the MIN HEIGHT; it was wrongly compared with the width.
2. A37 card shadow. The v13 shadow is `filter: drop-shadow(...)`, never `box-shadow` (A10 forbids it). A37 accepts a drop-shadow filter on the card or inside it, and fails when there is none.
3. A35 closed mode. Checks never mutate Sanity and the live dataset has sales open, so `NOS_SALES_CLOSED=1` cannot make it closed. The closed branch is covered at render level: A27 (builder `salesOpen` false), A28 (the `salesClosed` card and a new `SalesStatusLine` component export from `components/tickets/keepsake`, rendering the `[data-sales-status]` role=status line with the existing "Sales closed" string and a "Be the first to know" link, no price, button or input). A35 measures the live closed branch only when the dataset is closed (`NOS_SALES_CLOSED_STRICT=1` then fails an open page); otherwise `NOS_SALES_CLOSED=1` on an open page is a recorded skip with that reason. The A35 gate command no longer sets `NOS_SALES_CLOSED=1`.
4. A20 versus A31 order. Confirmed: on the inner ticket routes the order is hero, sections, the closing band, then the Explore index (a navigation landmark, last in main), then the footer. A20 requires the index after every content section, the closing band included, and A31 requires no section after the band; the index is a `nav`, not a section, so both hold with the band before `NosShowIndex`.
5. `#trade` copy. Confirmed: each compact-row card's one line is the matching nav-config descriptor verbatim, so `#trade` reads "Trade vendor showcase, application and gated registration." (`nav-config.ts:260`) and `#exhibit` reads its own descriptor. A29's banned "Register" is case-sensitive and does not match "registration", and a string already in the base tree needs no `strings-allowed.json` entry.

## 11. A4 versus A36, and the workshops note (lead, 2026-10-17)

1. A36 wins over A4. The naming sweep changed the 06-saoc-symposium builder-brief summary in `lib/data/builder-brief-summaries.ts` to "Programme and registration hub for the National Orchid Show Symposium.", and A36 forbids the old name in `lib/`. `lede-verdicts.json` carries the swept string in `summary` (the A4 input), so `publicHeroLede` still drops it exactly as before (the verdict stays `drop`; the route shows the theme line). `v3Purpose` keeps the source document's wording.
2. Workshops disclosure. F18b leaves `/national-show/workshops` as it is today (section 1); the page is replaced only in F18c. Deleting `CategoryTicketsPage` must not drop the existing disclosure, or the page implies per-session bookings are on sale. Until `#sessions` exists the page keeps the existing `SESSIONS_NOTE` string (main 3f45db11) verbatim, once, in a `role="note"` Card after the hero and before the first ticket card, and offers no per-session Buy CTA. When F18c ships `#sessions` the note goes (session cards carry their own "Booking for this session is not open yet."). A38 asserts both states; the string is in `v13-copy.json` (`workshopsNote`).

## 12. Closing band removed, fan face name (design-cb final rulings, 2026-10-17)

- P1-2: no closing band on `/national-show/tickets`. v13 runs masthead, thursday, passes, programme, sessions and the band linked the page to itself. R30 (2) is retired. A31 asserts `[data-nos-ticket-close]` is absent and that nothing but the Explore index follows the last ticket section; the Day Pass line (R30 (1)) is unchanged. A29's compact `#exhibit` / `#trade` row no longer measures itself against a band. No other route in the spec carries a ticket close band, so no other band assertion changes (the holding state's "Be the first to know" band, A3, is a different band).
- P1-1: the fan FACE drops a trailing parenthetical from the CMS name ("Sunset Cocktails (Single)" shows "Sunset Cocktails"). The full name stays in the fan link's `aria-label` and on the card, so ruling 4 (one name end to end) holds for the accessible name and the card. A29 asserts the face shows the name minus the parenthetical and does not show the parenthetical, and still requires the aria-label to start with the card's full name.

## 13. A31 last-section order and one name per product (lead and design-cb, 2026-10-17)

- A31's "last ticket section" is the last of `#exhibit`, `#trade`, `#sessions`, `#programme` in DOM order, not array order, so the compact `#exhibit` / `#trade` row that follows `#programme` is not mistaken for a band. The row stays a `<section>` (F3-C2 rhythm). The `[data-nos-ticket-close]`-absent assertion is unchanged.
- P2-1, one name per product. The hub masthead line reads the same CMS name field as the product's card: "<card CMS name, trailing parenthetical dropped> from R<amount>", for example "Early-Bird Exhibition Ticket from R120" while the early-bird pool lasts, "Day Visitor Ticket from R150" after. The literal "Day Pass from" is retired; `v13-copy.json` `dayPassFrom` is now just "from". A31 asserts the line equals the #ticket-day card's `[data-ticket-name]` (faceName rule) plus " from " plus the card price. The line is still absent when the Day card has no price (R7).
- P2-3 (design-cb FINAL), provisional stock counts. A count shows only when its total comes from Sanity (`capacity` / `releasedQuantity`). A total from `lib/provisional-figures.ts` is flagged by the builder (`capacitySource: "provisional"` on the type gives `scarcity.provisional`, `days[].provisional` and `pool.provisional`, true when any pool member is provisional; the builder hides nothing) and the components decide by mode, through the prop `showProvisional` (the page passes `!withholdPlaceholderProse()`; default false):
  - Public: no card count line (`[data-ticket-count]` absent, stepper max stays 10), day cells show the day only (no "N of M"), the pool banner has no numeral, its heading is "Early-bird tickets" and its sentence is "One pool of early-bird tickets is shared by the {Weekend} and the {Day}. The early bird ends when the pool sells out." with the CMS names (faceName rule, P2-1; `v13-copy.json` `poolTextProvisional`). State words ("Few left", "Sold out", "Early bird sold out") still show.
  - Beta: the same counts render inside `[data-placeholder]` with the "Not yet confirmed" marker (`notYetConfirmed`).
  - The old "Early-bird tickets left" heading and "One pool of 500 early-bird tickets..." sentence apply only when the pool total comes from Sanity.
  - Asserted by A27 (flags), A28 (both modes, card, day cells, pool banner, session card) and A29 (live public: for every type without Sanity capacity, no count line, no "of N" in the day cells, no placeholder marker, and the provisional pool banner text; the Sanity capacity set comes from the read-only `loadCmsNames`).
