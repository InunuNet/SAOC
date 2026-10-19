# nos-critique-r18 F1 — the checkout step: live Total, one heading, the hub breadcrumb

BASE: `origin/main` `93940e04` (r17 merged). Branch `fix/nos-critique-r18`, worktree `.tmp/sandbox/critique-r18`.
Rulings: Codi, FINAL, checked live at 93940e04 at 390px, relayed by the lead (saoc-82) on 2026-10-19 (P2 live region, P3 duplicate
heading, P3 breadcrumb). Single feature: the three fixes touch one page and are verified together (`contract-f1.yaml`).
Goldens: `f1-edits.json`, `f1-footprint.json`, `f1-baseline.json` (BASE captures), `nonreg-baseline.json`.
Sources: `docs/rules/no-invention.md` (no new copy, tokens or colours); `design/design_handoff_saoc/`; `branding/National Show 2027/`.

The checkout step is `/tickets/<slug>` (`app/(marketing)/tickets/[slug]/page.tsx`), not a route under /national-show. It renders
`NosHero` (typographic, `nk-hero-compact`), the summary `TicketCard` (`variant="summary"`) and `TicketPurchaseForm` while sales are open
and the product is not sold out. On BASE all six hub products (vip, sunset-cocktails-single, weekend-pass-early-bird, early-bird,
saoc-symposium, wosa-conference) render the form in both builds; the checks use `early-bird` (Codi's case) and `saoc-symposium`.

## 1. P2 — the live region is the Total line alone (WCAG 4.1.3)

BASE `components/tickets/TicketPurchaseForm.tsx:185-209`: `div[data-catalogue-total]` carries `aria-live="polite" aria-atomic="true"` and
wraps both the Total `<p>` and the submit button, so every quantity or day change announces "Total R120 Continue to payment".

Target (exact, `f1-edits.json` `form`): the div keeps `data-catalogue-total` and `className="nk-checkout-total"` (one line, prettier
printWidth 100); `aria-live="polite" aria-atomic="true"` move onto the `<p>`. The button stays a child of the div, outside the region.
Layout is unchanged: the div is still the flex/grid container of the same two children.

## 2. P3 — one heading carries the product name: option (a)

BASE: the summary card renders its name as `<h2 data-ticket-name class="nk-name">` (`headingLevel="h2"`), so the outline reads h1
"Early-Bird Exhibition Ticket", h2 "Early-Bird Exhibition Ticket".

**Decision: option (a), the card name becomes a `<p>` with the same class.** Why:
- It removes the duplicate from the outline outright. Option (b), `aria-labelledby` on the card, renames the card but leaves the h2 in
  the heading list, so heading navigation still lists the title twice.
- Styling is identical by construction: every visual property comes from `.nos-theme .nk-name` (margin, family, weight, size, line-height,
  colour, opsz, tracking, balance). The only `p` rule in scope, `.nos-theme p { max-width: 60ch }`, is wider than the card at every width.
  `f1-rendered.mjs` R2 pins the computed type and the box against the BASE h2.
- There is precedent: `TicketMini` already renders `<p className="nk-name">`.
- The lead prefers (a).

Exact edits (`f1-edits.json` `card`, `page`): `TicketCard`'s `headingLevel?: 'h2' | 'h3'` becomes `'h3' | 'p'`. The checkout page was the
only `h2` user, so `h2` is removed rather than left dead, and the doc comment follows. The checkout page passes `headingLevel="p"`.
The card keeps `aria-label={name}` on the article.

## 3. P3 — the hub's breadcrumb above the h1

The hub's breadcrumb is not a component. It is inline markup in `components/tickets/keepsake/TicketsMasthead.tsx`:
`nav.nk-crumbs[aria-label=Breadcrumb]` > `a[href=/national-show]` "National Show", `span.nk-sep[aria-hidden=true]`,
`span[aria-current=page]` "Tickets". It is styled by `.nos-theme .nk-crumbs` (nos-structure.css:1501) on the masthead's dark ground.

**Decision: reuse the markup pattern, not a new shared component.** `NosHero` gains an optional `crumbs?: ReactNode` prop, rendered as the
first child of `.nos-hero-copy`, before the h1. Insertions only, so every other hero is unchanged. The checkout page passes:

    nav.nk-crumbs[aria-label="Breadcrumb"]
      a[href="/national-show"]          National Show      (hub item 1, verbatim)
      span.nk-sep[aria-hidden="true"]                      (hub separator, verbatim)
      a[href="/national-show/tickets"]  Tickets            (the hub's current item, now a link, styled as item 1)
      span.nk-sep[aria-hidden="true"]
      span[aria-current="page"]         {ticketType.name}  (the h1 source)

Why not extract a component: `TicketsMasthead` would have to change too, which widens the footprint onto the hub for no behavioural gain.
`nonreg.mjs` keeps the hub pixel-identical. The pattern is three elements and the strings already exist. If a third consumer appears,
extracting the component is the follow-up.

The NosHero type hero is a dark ground (#0B0A14, `nos-on-dark`), like the masthead. The `nk-crumbs` colours (`--rule-soft`, hover
`--ivory` with an `--olive` underline, `--olive` separator) apply unchanged, and the hero copy's grid gap (22px) spaces it from the h1.
No new token or colour is introduced. The labels "National Show" and "Tickets" are the hub's own strings, and the product name is
`ticketType.name`, already the h1.

**JSON-LD: mirrored.** The hub emits a BreadcrumbList (National Show `https://saoc.co.za/national-show`, Tickets
`https://saoc.co.za/national-show/tickets`) from `NosBreadcrumbJsonLd`, mounted by the national-show layout. The `/tickets` layout
mounts none, so the checkout page emits one server-side with the existing `JsonLd` + `breadcrumbJsonLd` (`components/seo/JsonLd.tsx`).
It has the same two items, then `{ position: 3, name: ticketType.name, item: https://saoc.co.za/tickets/<slug> }`, which is the page's
canonical path from `buildPageMetadata`. R4 compares it to the hub's list in the same build.

## 4. Breadcrumb wrapping at 390px (architect decision)

With the trail injected into BASE at 390px, the five-item non-wrapping flex row squeezes: "National Show" breaks onto two lines and the
separators shrink to 16-20px. Adding `flex-wrap: wrap` to `.nos-theme .nk-crumbs` (`f1-edits.json` `css`) keeps every item on one line,
with the current item taking the second line whole. Measured: nav 77px at 390, 43px at 1280, no overflow. The hub's two-item trail fits
on one line at every width, so it renders as at BASE; nonreg.mjs holds `/national-show/tickets`. This is a layout property, not a token.
Codi may rule otherwise, for example hiding the middle item on small screens; it is recorded here so the choice is visible.

## 5. Footprint

`f1-footprint.json`: `TicketPurchaseForm.tsx`, `keepsake/TicketCard.tsx`, `tickets/[slug]/page.tsx`, `nos/NosHero.tsx`,
`national-show/nos-structure.css`. Also `docs/nos-critique-r18.md`, with a `## F1` section covering the three fixes and the decisions above.

## 6. Known dependency

The rendered checks read live CMS state: a product must be on sale and not sold out. If sales close, R1-R5 report INFRA, not a
regression; choose another purchasable slug and re-capture `f1-baseline.json` on BASE.

## 7. Amendment (Codi FINAL, relayed by the lead 2026-10-19; folded in before merge)

Codi agreed with the NosHero `crumbs` slot and with `flex-wrap`, and added two requirements.

**1. A dash never ends a line.** Each separator is bound to the item after it as one unit, so a wrapped trail breaks only between
whole "— Item" pairs.

**Decision:** use a real element unit, not `::before`. Wrap the separator and the item in `span.nk-crumb`
(`display: inline-flex; align-items: center; gap: 10px`), and give the separator `flex-shrink: 0`.
- The separator keeps its element and its rule (`.nk-crumbs .nk-sep`, 24 × 1.5px olive), so the glyph is the same node.
- The unit reuses the nav's 10px gap and centre alignment, so the hub renders pixel-identically.
- R6 can measure the separator's own rect. A pseudo-element has no rect to read.
- A link's underline does not run under the dash, because the dash sits outside the `<a>`.
- Markup is `f1-edits.json` `crumbMarkup`:
  `a` "National Show", then `span.nk-crumb > (span.nk-sep, a "Tickets")`, then `span.nk-crumb > (span.nk-sep, span[aria-current=page] name)`.
- The hub's `TicketsMasthead` takes the same unit for its current item (`f1-edits.json` `masthead`) and joins the footprint.
- The CSS goes in its own block after `.nk-crumbs .nk-sep` (`f1-edits.json` `css`, second edit).

Measured result: at 390 the trail sits on two lines, "National Show — Tickets" and "— <product>". At 1280 it is one line.

The ruling has a consequence worth stating: when the trail wraps, the dash starts the second line. That is the "— Item" unit, by
design. It never ends the first line.

**2. The current crumb is not a link.** The last crumb carries aria-current=page and is not a link, as on the hub. The pushed build
already does this; R3 now asserts it on both pages.

**Checks**
- **S2c:** exact masthead edits.
- **S3:** both separators open an `nk-crumb` unit.
- **R3 (rewritten):** the child structure and computed styles match the hub, unit by unit.
- **R6 (new, the hub included):**
  - every separator's vertical centre lies inside the first text line of the item after it, and the separator sits left of that item;
  - the trail's text sits on at most 2 distinct lines at 390 and on 1 line at 1280;
  - it runs on /tickets/early-bird and /tickets/saoc-symposium. "National Orchid Show Symposium" is the longest product name on sale.
