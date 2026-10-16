# F16 design spec: tickets hub R31-A2 (audience index, typographic rows and cards, admin-only test-mode strip)

Base: origin/main ef040964. Authority: `docs/rules/no-invention.md`. Visuals: the NOS token layer (`app/(marketing)/national-show/nos-theme.css`), the shared NOS components (`components/nos/*`), the approved v4 mock (`goldens/f2/mock-index.html` of nos-own-brand-chrome), the SAOC handoff `design/design_handoff_saoc/` where NOS inherits it, and `branding/` (read-only). Copy: Lee-Ann's Drive, existing page data, CMS data, or Brad's/the lead's explicit words. Machine-readable targets: `tokens.json`, `copy.json`, `rows-fixtures.json` (the checks read them).

## 0. Brief the dev must follow (mandatory reading, in this order)

Read these before writing code. The skills are untracked in the main tree: read them at `/Users/vetus/ai/SAOC/.claude/skills/<name>/` (copy into your worktree's `.claude/skills/` if you want them local; never commit them).
1. `impeccable` : `SKILL.md`, then `reference/craft-floor.md`, `reference/polish.md`, `reference/critique.md`, `reference/audit.md`. The launcher is unavailable: use its fallback, i.e. read the reference files directly (F14 did the same).
2. `frontend-design` (craft and quality bar; on SAOC brand choices come from approved handoffs only).
3. `web-design-guidelines` (Vercel interface guidelines, terse file:line findings).
4. `accessibility` (WCAG 2.2: focus, target size, forms, ARIA).
Then this spec, `goldens/f16/*`, and `docs/rules/no-invention.md`. Do not touch the header axis tokens (F12/R71 runs in parallel on `spec/lw-f12`): `nos-theme.css`, `NosHeader`, `components/nos-chrome/*` are out of bounds.

## 1. Findings on origin/main (measured on a production build, live Sanity, 1280 and 390)

1. The first screen is a typographic hero, then a 31px-tall strip of text clipped at x=-7 (`w-screen` includes the scrollbar, `relative left-1/2 -translate-x-1/2`), then one big Card. No index exists; the four other audiences sit below 1,000px.
2. The visitor card holds a **button wall**: five product-name buttons wrapping onto three lines (one filled, four outlined, all uppercase), beside an orphan **"FROM R120"** block that prices one SKU and repeats its name. Two buttons are the same product at two prices ("Weekend Pass" and "Weekend Pass (Early Bird)"), with no price on any button.
3. The public sees "TEST MODE - Ozow charges R0.01 instead of the displayed price" (live flag `adminSettings/ozowSandboxTestMode` is on; beta host is the prod backend).
4. Shared `TicketTypeCard` carries a stock photograph with a product-named alt (R53 #2): 728px per card on /conferences.
5. Copy defects: standfirst says "2027 SAOC National Show"; conference card promises "the combined Joint track" (retired: `RETIRED_CONFERENCE_SLUGS`).
6. Data shape that the brief did not mention: the early-bird tiers are **separate SKUs** (`early-bird` R120 beside `day-visitor` R150; `weekend-pass-early-bird` R360 beside `weekend-pass` R380; `vip` R300), paired by `REGULAR_PRICE_SIBLING_SLUG` in the ticket-page view-model, all `earlyBirdCutoff: null`. "Dual prices from resolveEffectivePrice" therefore means one row per product family with each SKU priced by `resolveEffectivePrice`, plus the single-SKU cutoff-and-regularPrice form for when the date mechanism returns. Both are specified and fixture-tested.

## 2. Rulings (architect decisions for the lead to confirm)

| # | Ruling | Why / cite |
|---|---|---|
| R1 | Index label 4 is **"Conference & Workshops"**, not "Conference + Workshops". | The `+` appears in no source; `&` is the house connector (nav-config "Exhibit & Trade", the card CTA "Workshops & Field Trips tickets"). One-line flip in `tokens.json`. |
| R2 | Row title = the standard SKU's CMS name ("Day Visitor Ticket", "Weekend Pass", "VIP Ticket"). Tier captions = the CMS SKU names. **No "Standard" or "Early-bird" word is invented**; the standard tier's caption is visually hidden (it is the row title) and kept for assistive tech. | no-invention. If the lead wants literal "Early-bird" / "Standard" captions that is new copy, a Brad call. |
| R3 | Row action label = the `ticketsPage` singleton's `buyButtonLabel`, fallback "Buy Ticket", plus a visually hidden " - {row name}" suffix. Variant `primary`, identical on every row. | The label already exists (CMS and `CategoryTicketsPage`); label-in-name satisfied. Equal weight per row is the F3 "equal-weight" principle, so a column of identical actions reads as a table, not a wall. |
| R4 | Primary action target per row = the early-bird SKU while it is a tier, else the standard SKU. | One action per row, the cheaper product first. |
| R5 | The hub does **not** read Firestore sold counts. A sold-out early-bird pool is not reflected on the hub (the destination page shows it). | Scope: the hub stays Sanity-only; adding counts is a separable follow-on. Flagged as risk 1. |
| R6 | The strip is gated server-side by `viewerIsVerifiedAdmin()` (a fail-closed wrapper over `getAdminSession()`), so the hub becomes `force-dynamic` (it reads the session cookie). `TicketPurchaseForm` takes `showTestModeBanner` (default false) from `CategoryTicketsPage` and `/tickets/[slug]`. The vendor form is untouched. | Lead: existing helper, no new auth path. The alternative (a client island calling a new admin route) keeps ISR but adds a route; rejected. |
| R7 | The banner box becomes `block w-full border-y ...` inside its container; the `w-screen / left-1/2 / -translate-x-1/2` break-out is removed (shared component, so the vendor form's clipped strip is fixed too). | The x=-7 clip. Container-bound. |
| R8 | Photos are removed from `TicketTypeCard` in both modes; `lib/tickets-orchid-image.ts` is deleted (orphaned). Price figure reuses the hub price clamp, name is the R35 card-title role, description 16px (R65). | R53 #2; F3 re-pin note; R65. |
| R9 | The metadata description restates the standfirst (the file's own comment says so), so it carries the same wording change. | Consistency; the lead said "the standfirst" only. Strike if unwanted. |

## 3. Page anatomy (`/national-show/tickets`)

1. `NosHero` unchanged but the standfirst (`copy.json` `lede`). H1 unchanged.
2. `TicketAudienceIndex`: `<nav data-ticket-index aria-label="What are you here for?">` > `[data-nos-wrap]` > `ul` of four anchors. Directly after the hero (0-8px), exempt from the section rhythm like the R27 sub-nav (a `<nav>`), not from the wrap rule. Chips: Karla 700 14.5px royal, 1px primary border, radius 2px, min-height 44px, padding 10/18 (22 inline from 640), hover `primary` at 5% (150ms ease-nos), focus is the global NOS ring. Below 640px a 2-column grid with 12px gaps (equal cells; a wrapped label may make its row taller); from 640px a wrapping flex row at 12px gaps. At 390x844 the four chips end above y=844.
3. `#visit` group: `NosSection id="visit" data-nos-group aria-labelledby`. Badge "Visitor admission", h2 "I'm coming to visit", the existing sentence, then `AdmissionRows` (or, with no products, the existing single "Get visitor tickets" button). Admin-only strip first inside the wrap (R6). Sales closed: the rows list names and day notes only, then one `SalesClosedNotice` in `[data-ticket-closed]`. Sales open: one italic "Provisional pricing - subject to change." line after the list when any row is provisional (once, not per row).
4. Second `NosSection`: `#exhibit` and `#trade` are the existing exhibitor and vendor cards (the id on the Card itself); `#conference-workshops` is a `role="group" aria-label="Conference & Workshops"` wrapper holding the existing conference and workshops cards (a 2-col grid row). Copy and CTAs unchanged except the conference body (`copy.json`). Group targets carry `scroll-margin-top: 112px`.

## 4. Rows (`components/tickets/AdmissionRows.tsx`, `lib/admission-rows.ts`)

`buildAdmissionRows(types, { now })` is pure; the interface is pinned by `check-d-render.mts`: `AdmissionRow { key, name, tiers[{kind:'earlyBird'|'standard', slug, name, price}], actionSlug, requiresDaySelection, provisional, earlyBirdEnds }`. Rules, each covered by a fixture in `rows-fixtures.json`: an early-bird SKU whose sibling (`lib/admission-siblings.ts`, extracted from `load-ticket-card.ts`, one source of truth) is listed folds into the sibling's row; every price is `resolveEffectivePrice`; a null price (closed early bird with no regular price, which checkout refuses with 409) contributes no tier and a row with no tier is dropped; a single SKU with `earlyBirdCutoff` inside its window and a distinct `regularPrice` yields two tiers and `earlyBirdEnds`; after the cutoff one standard tier at `regularPrice`; tiers sort early-bird first; `actionSlug` is the first tier's slug.

Row markup: `li[data-ticket-row]` > `h3[data-ticket-row-name]`, `p[data-ticket-day-note]` ("You must choose a day when you book." on day-selection rows, existing copy), optional "Early-bird pricing ends {d month}." (existing copy, only while open), `dl[data-ticket-prices]` of `div[data-ticket-tier]` (`dt` caption, `dd[data-ticket-price]`, `data-placeholder="true"` when provisional), then ONE `a[data-ticket-row-action]` (NOS `Button as={Link} variant="primary"`). Prices and the action render only when `salesOpen`.

Geometry and type (all tokens, no new colour, font or duration): list `border-top: 1px solid --rule`; row `border-bottom` the same, padding-block 28px (the F14 ruled-list grammar, src `.event-row`); from 1024px `grid 1.2fr 1fr auto`, gap 40px, action min 180px; below it a single column, gap 16px, full-width action (min 50px from `Button`). Name Fraunces 400 22/1.25 (R35 card-title role). Dominant price (first tier) `clamp(34px, 4.4vw, 48px)` Fraunces tabular, ink; second price 22px muted; caption 12px / 600 / .14em uppercase muted (the old "From" label style); day note Karla 500 13px ink. Dominant and secondary prices sit on one baseline with the caption after the dominant price.

## 5. Test-mode strip

`lib/admin-viewer.ts` `viewerIsVerifiedAdmin(resolveSession = getAdminSession)` returns true only for `{ ok: true }`; a throw logs `{operation, errorType}` and returns false. It adds no cookie parsing, token verification or allowlist read (`check-e` greps for them). The hub renders `{isAdmin ? <OzowSandboxTestModeBanner /> : null}` inside `#visit`'s wrap; `TicketPurchaseForm` renders it only when `showTestModeBanner`. The status route and the flag are unchanged (Brad flips the flag at launch). The vendor stand form still shows the strip to its public (it belongs to the vendor-flow lane; see risk 3).

## 6. Typographic cards (`TicketTypeCard.tsx`)

Remove the media block and its imports in both modes; name Fraunces 400 22/1.25 (NOS routes; the SAOC `/tickets/<slug>` page keeps its own serif), price figure `clamp(34px,4.4vw,48px)` tabular, description Karla 16/1.55 muted, provisional and sold-out lines unchanged. Flip `goldens/f3/hero-photo-map.json` `ticketCardPhotos.exempt` to false (done in this spec branch) so `check-f3-imagery` enforces it.

## 7. Files the dev may touch

`app/(marketing)/national-show/tickets/page.tsx`; `components/tickets/{AdmissionRows,TicketAudienceIndex,TicketTypeCard,TicketPurchaseForm,CategoryTicketsPage,OzowSandboxTestModeBanner}.tsx` and `index.ts`; `app/(marketing)/tickets/[slug]/page.tsx` (one prop); `lib/{admission-rows,admission-siblings,admin-viewer}.ts`; `lib/view-models/load-ticket-card.ts` (import the extracted map); delete `lib/tickets-orchid-image.ts`; `app/(marketing)/national-show/nos-structure.css` by pure addition under an `F16` comment. Not: the header, `nos-theme.css`, vendors, `conferences/page.tsx`, SEO JSON-LD, the label "Conferences tickets" (report-only).

## 8. Test hooks (markup only)

`data-ticket-index`; `data-ticket-rows`, `-row`, `-row-name`, `-prices`, `-tier="earlyBird|standard"`, `-price`, `-row-action`, `-day-note`, `-closed`; group ids `visit`, `exhibit`, `trade`, `conference-workshops`; `data-nos-group` on each target.

## 9. Self-critique loop (required; Brad's bar "beautiful and worthy of the orchid council")

1. Implement. 2. `SITE_PUBLIC_LAUNCH=true pnpm build && pnpm exec next start -p 3620`; `OUT=.tmp/sandbox/lw-f16/after node --import tsx/esm contracts/checks/launch-weekend/f16/capture-shots.mjs` (hub at 390/1280/1920, 390 index, chip and row-action hover and focus at 1280, /conferences at 390 and 1280). 3. Read every PNG and run an impeccable critique: `critique.md` heuristics (10 x 0-4 = /40), `craft-floor.md`, `audit.md`, `polish.md`, plus frontend-design, web-design-guidelines and accessibility. Judge composition, hierarchy, the left axis, rhythm (the prototype leaves a large gap under the rows: that is a finding to fix inside the NOS section rhythm), the wrapped 390 chip, type, state quality, and whether it reads as a botanical society's ticket office, not a SaaS pricing table. 4. Fix every P0, P1, P2 in one batch, re-shoot, critique again until a pass has none; only values from the NOS tokens and rulings may be used; a finding that cannot be fixed inside them is a P3 with the reason, reported to the lead. 5. Write `.agent/memory/project/specs/launch-weekend/f16-critique-log.md`: `## Pass N` blocks with `P0: n`, `P1: n`, `P2: n`, `Score: NN/40`, mentioning 390, 1280, 1920, hover, focus and reduced motion; the final pass `P0: 0, P1: 0, P2: 0`, Score at least 36/40. A9 enforces freshness and shape; @qa re-runs the critique.

## 10. Risks and gaps (no source / needs a call)

1. A sold-out early-bird pool is still advertised on the hub (R5); the destination shows "Sold out". Adding counts is one follow-on.
2. Tier captions are CMS SKU names; "Standard" and "Early-bird" as words have no source (R2).
3. `VendorStandPaymentForm` still shows the public strip to vendors (vendor-flow lane). Brad flips the flag at launch; decide whether vendors should see it before that.
4. The admin-positive render cannot be driven without a real admin session; it is proven by the DI test, the static wiring and one QA look on beta.
5. The hub moves from ISR to per-request render (R6); Sanity reads stay cached.
6. Live data oddity for Brad: VIP is R300 in Sanity, below Weekend Pass R380; the memory notes say R625/R500. Not touched.
7. "Conferences tickets" label and the retired Joint clause on `/conferences` (conferences/page.tsx:17,32) stay (R54, separate).

## 11. Pitfalls found while proving the spec

- A text node ` - {name}` split by React into two nodes broke the copy delta; render the hidden suffix as one template string.
- `check-f3-tickets` asserted the strip full-width for anyone; it is re-pinned to "public never sees it".
- tsx resolves the `@/` alias from the cwd: gate commands run from the worktree root.
- `/tickets/<slug>` is an SAOC-chrome page with its own hero photo and serif; only its card is judged.
