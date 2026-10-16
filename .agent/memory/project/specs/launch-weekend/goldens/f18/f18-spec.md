# F18 spec: long-form template, public holding state, ledes, FAQ, exhibitors, catalogue rows (R75, R76, R76b, R77 #3-#6, R78)

Base: main 76ad8b98. Architect: Sonnet 5.5. Skills the dev MUST load and apply (name them in the critique log): `impeccable` (craft-floor, polish, critique), `frontend-design`, `web-design-guidelines`, `accessibility`. No new brand asset, colour, font, shadow, animation or emoji; no invented copy (see section 7).

## 1. Split (recommended, stated not asked)

| | scope | contract assertions |
|---|---|---|
| F18a | items 1-5, 7, 8: long-form template, holding state, ledes, FAQ, exhibitors, sponsors guard, archive card | A1-A7, A10-A13 |
| F18b | item 6: catalogue rows (workshops, conferences) | A8, A9 (and A10 to A13 again) |

Sequential, one dev, one QA each, F18a first (it owns the shared files). One contract; F18b starts after A1-A7 are green. If the lead prefers one dev pass, F18b is simply the second half of the same pass.

## 2. Mode switch (one rule, no second switch)

Everything "beta-only" below is gated on `!withholdPlaceholderProse()` from `lib/data/show-pages.ts`. Public = `SITE_PUBLIC_LAUNCH=true`, or no beta wall, or no `SHOW_PLACEHOLDER_PREVIEW=true`. Beta = `SHOW_PLACEHOLDER_PREVIEW=true` + both `BETA_BASIC_AUTH_*` + no `SITE_PUBLIC_LAUNCH`. ISR pages bake the build env, so the runtime checks run against a PUBLIC build only (port 3672); beta behaviour is proved at render level (A4, A5, A9) with the env or props injected. Do not add a prop that reads `process.env` inside a client component.

## 3. Items, with the hooks the checks read

### 3.1 Shared long-form template (R75, P1): /about, /what-to-expect, /vendors, /sa-exhibitors
New component (suggest `components/show/nos/LongFormPage.tsx`, server). Copy per route is in `goldens/f18/longform-copy.json`, verbatim, no word added or removed (typographic quotes and whitespace compare equal). DOM order: head (`[data-nos-longform-head]` = the section h2 + `[data-nos-longform-lede]`, the first paragraph at 20px / 1.5), aside (`[data-nos-longform-aside]`), body (`[data-nos-longform-body]`).
- >= 900px: two columns 4fr / 7fr, 64px gap, aside sticky (top 62-120px), body paragraphs 16px / 1.55 at <= 60ch. < 900px: one column, aside stacks, not sticky.
- Aside: the facts `[data-nos-facts]` Dates / Host / Venue / Cycle, equal to the hub's hero facts (`.nos-hero-facts`), the pull quote `[data-nos-pullquote]` where the golden names one (about: "From Wild Origins to Cultivated Excellence: The Future of Orchids"), and the CTA pair `[data-nos-longform-cta]`: Tickets (primary) + Plan your visit (ghost) on about, what-to-expect, sa-exhibitors. /vendors keeps its existing royal CtaBand to `/national-show/vendors/apply` (no pair).
- One image break `[data-nos-image-break]` in the body column after `breakAfter` paragraphs: 21:9, `alt=""`, photo from `break-photo-map.json` (existing rights-cleared files only).
- The "Explore the show" index (`nav[aria-label="Explore the show pages"]`) stays last on every page (F17-A19 re-asserted by A1).
- Vendors and sa-exhibitors carry the same Lee-Ann copy (4 vs 3 paragraphs); do not merge or dedupe (For Lee-Ann, section 8).

### 3.2 Public holding state (R76, P1)
`ShowContentState` renders a holding state in PUBLIC mode when no real prose remains. Props the checks drive (names are the contract): `holding?: { facts, statement? }`, `listingEmpty?: boolean`, plus `hideContentGap` (F17) kept. Markup: `[data-nos-holding]` containing facts `[data-nos-facts]`, `[data-nos-holding-cards]` of `[data-nos-holding-card]` (the OTHER leaves of the route's nav-config group, label + `descriptor`, never the route itself), and `[data-nos-holding-cta]` reusing the existing "Be the first to know" band (eyebrow "Stay informed", no lede, action "Ask the council" to `/contact`).
- Holding (definite): programme, international-guests (statement: the golden absence sentence), wosa-conference (keeps the WOSA link-out to https://wildorchids.co.za as `afterProse`). Conditional: archive (no `[data-nos-edition-card]`), faq (no answered question after hiding). Never holding: the `mustNotHold` list in `holding-audit.json`.
- In public mode the page renders NO `[data-nos-content-gap]`, no "To be confirmed by the show committee" label, no gap sentence, no "Placeholder copy" notice, no manifest purpose line, no `RealEmptyListing` "Each entry will show" schema preview. Fallback pages (`isFallback`) keep `data-nos-content-state="fallback-unpublished"` on the holding section.
- Beta mode renders exactly what it renders today (labelled placeholders, notices, gap blocks, schema preview), never a holding state. `RealEmptyListing` gets `showSchemaPreview?: boolean`, default `!withholdPlaceholderProse()`.
- TBC chips/notes everywhere are beta-only in this scope: vendors pending chip, sponsors marker, the sa-exhibitors gap (`sa-exhibitors` passes `hideContentGap`: it has real overview prose).

### 3.3 Builder-brief ledes (R76b, P2)
Export `publicHeroLede(summary)` from `lib/data/show-page-presentation.ts`: returns `undefined` for every `drop` summary in `lede-verdicts.json`, the text itself for every `keep` (03, 04, 16, 17), `undefined` for null. `hydratePage()` (or the route) applies it in public mode only; beta still shows the summary. The symposium theme line (R70, `ledeKind="theme"`) is unchanged. A4 proves the function, A7 proves no dropped brief is in any public HTML (hero, meta, og, JSON-LD).

### 3.4 /faq (R77 #2, P2)
`ShowFaqList`: `hideUnanswered?: boolean` (route passes `withholdPlaceholderProse()`): a question with no answer renders no row in public mode. Hooks: `data-faq-summary` on each `<summary>`, `data-faq-icon` on the icon, `data-faq-question` on the question text block. Row is the whole button: >= 44px high, spans the list, any click toggles. Icon 20px (+-0.5) square, vertically centred on the row (+-2px), never wraps. The chip stays inline in the question block after the text, <= 12px. Keep native `<details>/<summary>` and the answer in the DOM while collapsed.

### 3.5 Exhibitors TBC duplicates (R77 #3, P2)
Export `restatesPending(note, status)` (any module under lib/ or components/; the checks find it by `grep 'export.*restatesPending'`) using `goldens/f18/exhibitors-tbc.json` `pattern`/`flags`. A pending key-date row drops its `dateNote` when the predicate is true; chips stay; research and question rows are untouched; an empty note returns false.

### 3.6 Catalogue rows (R77 #4, P1, F18b)
`TicketPurchaseForm` (used by `CategoryTicketsPage` for /workshops and /conferences) renders the F16 row vocabulary: `[data-catalogue-rows]` > `[data-catalogue-row]` with `[data-ticket-row-name]`, `[data-ticket-price]`, description, stepper (aria-labels `Increase quantity of <name>` / `Decrease quantity of <name>`, exactly as today), "Sold out" with a disabled + for a sold-out type. Price via `formatRand` ("R200", "R2000", "R250.50": no ".00", no space). `[data-catalogue-total]` is the sticky bar (position sticky or fixed, <= 96px high, inside the viewport once a quantity is chosen): "Estimated total R..." and the submit button (buy label from CMS) inside it; the old "(estimate)" paragraph is removed. A single `requiresDaySelection` type still hides the row stepper (`useDayQuantityPicker`). `useTicketCart` and the `/api/tickets/checkout` payload (`items[].ticketTypeId`, `items[].quantity`) are unchanged. The admission-transfer sentence (CMS `termsNote`, starts "Admission tickets may be transferred") stops rendering in `CategoryTicketsPage` for the catalogue categories and stays on /national-show/tickets. Sales-closed and empty-category branches unchanged.

### 3.7 Sponsors (R77 #6, P2): already one panel (F17-B2/A6); F18 only keeps it that way and makes the "To be confirmed" marker beta-only. F17 check-f-sponsors is amended accordingly (supersession.json).

### 3.8 Archive (R78, P3): the beta TBC card (`app/(marketing)/national-show/archive/page.tsx:128`, `nos-surface max-w-[720px]`) spans the column: remove the width cap on the card and its wrapper.

### 3.9 Hub drops the Explore index (R74 #2, P2, lead addition)
Remove `NosShowIndex` (import and element) from `app/(marketing)/national-show/page.tsx` only. The 16 inner routes keep it, last, unchanged; `NosShowIndex.tsx` itself is not touched. The mega-menu description copy ("The SAOC Symposium - ...") stays as it is. A20 asserts hub absent (DOM and server HTML) and the 16 inner present. Check amendments (spec branch, `supersession.json`): F17 check-m-index and check-d-hub, F12 check-a-static; F12 check-c-hub-index retired.

### 3.10 One sold-out helper (F17 leftover, with item 6)
`app/(marketing)/tickets/page.tsx` (~line 144) and `CategoryTicketsPage` (~line 190) each re-run `planPooledCapacity`; both move to `getAdmissionSoldOutBySlug` from `lib/data/admission-availability.ts` (already used by the tickets hub). Same verdicts expected. DECISION NEEDED, recommendation first: accept the helper's failure semantics (it catches, logs by error name and yields no sold-out flags; checkout re-checks capacity authoritatively). The alternative is to rethrow in the helper, which would change the hub's tolerant behaviour. The dev reports any /tickets or catalogue difference in the critique log. A21 is static; the e2e sold-out spec (A14) and A8/A9 prove behaviour.

### 3.11 Conferences lede (F17 leftover)
The lede in `conferences/page.tsx` ("Register for the SAOC Symposium, the WOSA Conference, or the combined SAOC/WOSA Joint track at the National Show.") is a code literal naming the products for the visitor, not a builder brief, so it does NOT drop (R76b judges `summary` fields only). It is left verbatim and goes on the For-Lee-Ann list: confirm whether product names read "SAOC Symposium" or "Symposium" now that the event is the "National Orchid Show" (F17 swapped the event name only). Same for the metadata description in that file. The conferences `note` chip (pending ConfirmationBadge) is shown to the public today; "TBC notes beta-only" would hide it: flagged, not in the checks (lead call).

## 4. Check inventory (all in `contracts/checks/launch-weekend/f18/`)

| id | file | proves | needs |
|---|---|---|---|
| A1 | check-a-longform.mjs | 3.1 copy, grid, sticky, typography, facts, pull quote, break, CTA, index last | public build, 3672 |
| A2 | check-b-imagery.mjs | break-photo rule + R29 hero rule on all NOS routes | public build |
| A3 | check-c-holding.mjs | 3.2 live public render | public build |
| A4 | check-d-holding-render.mts | 3.2 + 3.3 render level, both modes, fallback, listing, RealEmptyListing, publicHeroLede | tsx only |
| A5 | check-e-faq.mts | 3.4 | public build + tsx |
| A6 | check-f-exhibitors.mts | 3.5 | public build + tsx |
| A7 | check-g-ledes.mjs | 3.3 live: no dropped brief in public HTML | public build |
| A8 | check-h-catalogue.mjs | 3.6 live (skips a route with no rows or closed sales, says so) | public build |
| A9 | check-i-catalogue-render.mts | 3.6 render level, fixtures | tsx only |
| A10 | check-j-archive-scope.mjs | allowlist, no invention, no new sentence, archive card | `F18_BASE_REF` |
| A11 | check-k-critique-artefacts.mjs | impeccable critique evidence | `capture-shots.mjs` |
| A12 | regression chain | F17-A4/A5/A6/A7/A8/A17/A19/A20, F12, F3 imagery/tickets/rhythm | public build |
| A13 | check-l-supersession.mjs | hygiene recorded and applied (check-labels-static rebased) | none |
| A20 | F17 check-m-index.mjs (amended) | 3.9 hub index absent, 16 inner present | public build |
| A21 | check-m-availability.mjs | 3.10 one sold-out helper | none |

Build and serve: `SITE_PUBLIC_LAUNCH=true pnpm run build && SITE_PUBLIC_LAUNCH=true pnpm exec next start -p 3672` (never raw `next build`: image variants). Ports 3670-3679 only; stop by exact PID. Runtime checks read the CMS read-only and never mutate it. Because the live CMS content decides which routes hold (e.g. FAQ answers), the render-level checks (A4, A5, A9) are the deterministic proof, the runtime checks (A1-A3, A6-A8) prove the build.

## 5. Findings (measured at 76ad8b98)

- The admission-transfer note is the CMS `ticketsPage.termsNote`; `CategoryTicketsPage` renders it on every category page and /tickets already does, so F18b stops rendering it for the catalogue categories rather than moving text.
- Item 7 (sponsors card-in-card) was closed by F17-B2/A6; no new work beyond the beta-only marker.
- NosShowIndex was missing on inner pages after F3 retired ShowSectionNav; F17-G1 fixed it, A1 and A12 re-assert it.
- `e2e/journeys/` is untracked in the main checkout, so it is absent from dev worktrees; its j11 depends on `/increase quantity/i`, which the aria-labels preserve. The contract runs the tracked `e2e/sold-out-and-empty-states.spec.ts` only.
- check-labels-static was red on every tree since F8 (diffed against the ancient d2071be5); it is rebased to a structural check in this spec branch (`supersession.json`).

## 6. Rulings and decisions needing the lead

1. R29 vs the image break. R29 gives each rights-cleared photo exactly one route (its hero). The break needs a second role. Ruling taken: a break photo is allowed only inside `[data-nos-image-break]` on the four long-form routes, at the mapping in `break-photo-map.json`; `check-f3-imagery` excludes that selector and A2 owns the new rule. DECISION NEEDED if Brad wants the break photos to be new rights-cleared files instead; recommendation: keep the ruling, no new assets exist.
2. The vendors pending chip becomes beta-only (consistency with "TBC notes beta-only"). Reversal is a one-line golden edit.
3. The exhibitors predicate is a regex over the unset phrasings measured in live rows. A future dateNote that restates unset-ness in other words survives; that is the safe direction.
4. The sponsors marker is beta-only; F17-A6 is amended (see `supersession.json`).
5. F12/F16/F17 checks were measured green on 76ad8b98 but could not be run against an F18 build in this branch. If the dev finds one red because of an intended F18 change, stop and report it to the lead as an amendment candidate; do not edit checks.

## 7. No invention

Copy comes only from `longform-copy.json`, existing strings (`strings-allowed.json`, the base tree), nav-config descriptors and CMS values. A10 fails any new 4-word user-visible sentence not found in the base tree or the allowed list. Tokens: use `nos-theme.css` variables; new CSS goes in `nos-structure.css` under an `F18` comment (pure addition, or the marked `nos-ticket-row` block).

## 8. For Lee-Ann (never resolved by the dev)

- Nine summaries dropped from public heroes as builder briefs: pages 01, 02, 05, 06, 07, 11, 12, 13, 15. Page 07 has no source in her Drive (unsourced). She may supply public ledes.
- /vendors and /sa-exhibitors carry the same copy (4 vs 3 paragraphs). Confirm each should keep it, or supply distinct text.
- The /sa-exhibitors section heading "South African Exhibitors" equals the hero h1.
- Legal naming mixes forms in places (F17 left her legal sentences untouched).
- The WOSA conference metadata "held alongside" is unsourced.
- The conferences page lede and metadata still say "SAOC Symposium" (F17 kept her product naming); confirm the form.

## 9. Source gaps and risks

- Break-photo choice per route is the architect's mapping; no Lee-Ann source names imagery.
- The holding cards depend on nav-config descriptors being present on every leaf; A3 and A4 fail loudly if one is missing.
- Sticky aside plus sticky catalogue total at 390px: A1/A8 measure; the critique loop must look.
- The runtime catalogue check cannot exercise checkout where attendee-name fields are required (it notes this; A9 and the e2e carry it).
- Dev worktrees lack `.env.local`; the build needs Sanity read access (copy it in, delete it at the end).
