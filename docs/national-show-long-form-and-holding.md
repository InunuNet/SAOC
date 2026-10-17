# National Show long-form template and public holding state

Mission launch-weekend, feature F18a (R75, R76, R77). F18b (catalogue rows) is separate.

## One switch

`withholdPlaceholderProse()` (`lib/data/show-pages.ts`) is the only mode switch. A public build
(`SITE_PUBLIC_LAUNCH=true`) returns true; beta returns false. Every F18 behaviour below that is
"public only" reads that function; beta renders as it did before F18.

## Long-form template (R75)

`components/nos/LongFormPage.tsx` lays out a page as head (h2 and lede), aside (the show facts and
a pull quote), body (the remaining paragraphs) and a Tickets / Plan your
visit pair. Routes: `/about`, `/what-to-expect`, `/vendors` (own `cta={false}`, keeps its CtaBand)
and `/sa-exhibitors` (through `ShowContentState longform`). The template carries no image break: each approved stock photo already heads one route (R16),
so none was free. A heading that only repeats the page h1 (case and spacing aside) is not rendered.

Copy is Lee-Ann's, verbatim, from `goldens/f18/longform-copy.json`. The facts (Dates, Host, Venue,
Cycle) come from `lib/data/show-facts.ts`, which the hub hero also uses, so the two never differ.

## Holding state (R76)

`components/show/nos/HoldingState.tsx` replaces a gap block when a public page has no real prose:
facts, sibling cards from `nav-config`, and a "Be the first to know" band. Used by programme,
wosa-conference, international-guests and the FAQ. The archive shows only the committee-records
card in public. It never hides real prose and a
fallback page keeps its `data-nos-content-state` marker on the holding section.

Public mode also drops:
- builder-brief hero ledes (`publicHeroLede`, the nine texts in `lib/data/builder-brief-summaries.ts`;
  kept out of `show-page-presentation.ts` because the F12 static check pins literals there);
- the "Each entry will show" schema preview (`RealEmptyListing.showSchemaPreview`);
- every "To be confirmed by the show committee" chip (FAQ rows, presenter section, vendors,
  sponsors) and the FAQ intro that describes those marks.

## FAQ and exhibitors (R77)

`ShowFaqList hideUnanswered` hides unanswered questions in public; with none left the page holds.
Rows are a full-width summary with a 20px plus/minus icon centred on the row, and the chip sits
inline after the question. These rules are not scoped under `.nos-theme`, because the A5 check
injects the markup into `main`, outside that scope.
`ExhibitorKeyDates` drops a `dateNote` that only restates a pending chip
(`lib/data/exhibitor-keydates-note.ts`).

## Hub

`/national-show` no longer renders `NosShowIndex`; its 16 inner routes keep it. This is the
intended cause of the F17-A4, F17-A19 and F12-A1 hub reds and of the F18-A10 hub allowlist line,
which need spec-branch amendments (reported to the lead, no check edited).

## Keepsake tickets (F18b, v13)

The tickets hub, `/national-show/conferences`, `/national-show/workshops` and the checkout screen
`/tickets/[slug]` render the v13 keepsake ticket.

- One stock owner. `loadTicketCardViewModels` in `lib/data/admission-availability.ts` reads the
  ticket types, the real sold counts and the show days, keeps the pooled over-capacity verdict
  (`getAdmissionSoldOutBySlug`), and hands them to the pure builder
  `lib/data/ticket-card-view-models.ts`. The builder holds the state precedence, the shared
  early-bird pool (counted once) and the Day Pass per-day remaining. A count with no real source
  is `null` and renders nothing (R7: no sample numbers). A loader failure logs the error name
  only and renders cards with no stock figures.
- Static presentation. `lib/data/ticket-presentation.ts` holds the product table, the fixed
  strings, the theme variables (hex lives here, applied as inline custom properties) and the
  SKU pairing. CMS `ticketType` names win over the handoff names.
- Components. `components/tickets/keepsake/` (TicketCard, SessionTicketCard, BuyBlock, PoolBanner,
  TicketFan, TicketsMasthead, TicketSection). Geometry is the `nk-` block in
  `app/(marketing)/national-show/nos-structure.css`: container queries pick the stub side, and the
  hero fan-out is a `@starting-style` transition inside `prefers-reduced-motion: no-preference`
  (a phone deck does not fan out). The masthead carries `data-nos-hero="inner"` with
  `data-nos-hero-variant="fan"`.
- Hub links. A paid card's "Buy ticket" goes to `/tickets/<slug>?quantity=N` (and `&day=<iso>` for
  the Day Pass); the Workshops product card goes to `#sessions`, which has no target until F18c.
- Checkout screen. NOS chrome via `app/(marketing)/tickets/layout.tsx` and `NosThemeScope`. The
  hero is compact (`nk-hero-compact`). Buy stays enabled at quantity 0; a click there fills
  `[data-buy-hint]` and focuses the first quantity field. The total is one `aria-live` region
  holding the Buy button. `?quantity` (1..`CART_MAX_LINE_ITEMS`) and `?day` (a show day) prefill the
  cart through `useTicketCart`; anything else falls back to an empty cart. Every product category
  buys here; the checkout API has no category check.
- Bare `/tickets` is `permanentRedirect`; the route-level `loading.tsx` moved into `[slug]/` so the
  redirect is a real 308 (a Suspense boundary above the page flushes a 200 with a meta refresh).
- Removed: `AdmissionRows`, `TicketAudienceIndex`, `CategoryTicketsPage`, `AdmissionTicketsList`,
  `lib/admission-rows.ts` and the F16 audience-index CSS.

Open items for the spec branch: the Field Trip card has no v13 design and is not rendered; A21
scans `app/api/tickets/checkout/route.ts`, which A10 forbids editing; A29 reads the stub width where
the golden fixes the stub height, and its banned word "Register" matches mega-menu and hub-foot
copy outside F18b; `check-f3-tickets.mjs` flags the golden sunset field colour.

## Verification

Checks live in `contracts/checks/launch-weekend/f18/`. A1 to A3, A5 to A7 need the public build on
port 3672. Critique evidence is `f18-critique-log.md` and the 24 shots in `.tmp/sandbox/lw-f18/after`.
