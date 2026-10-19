# nos-critique-r18

Codi's FINAL rulings on the checkout step, checked live at `93940e04` at 390px and relayed by the lead (saoc-82) on 2026-10-19.
BASE `origin/main` `93940e04`. Every edit stays inside `docs/rules/no-invention.md` (no new copy, tokens or colours),
`design/design_handoff_saoc/` and `branding/National Show 2027/`.

## F1 - The checkout step: live Total, one heading, the hub breadcrumb

The checkout step is `/tickets/<slug>` (`app/(marketing)/tickets/[slug]/page.tsx`): the typographic `NosHero`, the summary
`TicketCard` and `TicketPurchaseForm`.

- **P2: the live region is the Total line alone (WCAG 4.1.3).** In `components/tickets/TicketPurchaseForm.tsx`,
  `aria-live="polite"` and `aria-atomic="true"` move off `div[data-catalogue-total]` onto the Total `<p>`.
  - A quantity or day change now announces the Total only, not "Total R120 Continue to payment".
  - The submit button stays a child of the div, outside the live region.
  - The div keeps `data-catalogue-total` and `nk-checkout-total`, so the layout is unchanged.
- **P3: one heading carries the product name (option (a)).** The summary card's name was an `h2` repeating the page h1. It
  is now a `<p>` with the same `nk-name` class, so it looks identical but leaves the heading outline.
  - In `components/tickets/keepsake/TicketCard.tsx`, `headingLevel` becomes `'h3' | 'p'`. `'h2'` had no other user, so it
    is removed rather than left dead.
  - The checkout page passes `headingLevel="p"`.
  - Option (b), `aria-labelledby`, would rename the card but keep the duplicate in heading navigation.
  - `TicketMini` already renders `<p className="nk-name">`.
- **P3: the hub's breadcrumb above the h1.**
  - `components/nos/NosHero.tsx` gains an optional `crumbs` slot, rendered as the first child of `.nos-hero-copy`, before
    the h1. The change is insertions only, so every other hero renders as before.
  - The checkout page passes the hub's own markup pattern from `TicketsMasthead`: `nav.nk-crumbs[aria-label=Breadcrumb]`
    with National Show → Tickets → the product name, `span.nk-sep` separators, and `aria-current="page"` on the product.
    "Tickets" is a link here, where it is the current item on the hub.
  - The pattern is reused, not extracted into a component.
  - **Amendment (Codi FINAL, 2026-10-19): a dash never ends a line.** Each separator is bound to the item after it in a
    `span.nk-crumb` unit: `span.nk-crumb > (span.nk-sep, item)`.
    - The unit is `display: inline-flex; align-items: center; gap: 10px`, the nav's own gap and alignment, and the separator
      gets `flex-shrink: 0`.
    - A wrapped trail therefore breaks only between whole "— Item" pairs. At 390px it reads "National Show — Tickets", then
      "— <product>" on the second line. At 1280px it is one line.
    - The separator stays a real element with its existing `.nk-crumbs .nk-sep` rule, outside the link, so a link's
      underline never runs under the dash.
    - The hub's `TicketsMasthead` takes the same unit for its separator and "Tickets", and renders as before.
  - **The current crumb is not a link** (Codi): the product name is `span[aria-current=page]`, as "Tickets" is on the hub.
  - The `nk-crumbs` colours apply unchanged on the hero's dark ground.
- **BreadcrumbList.** The `/tickets` layout mounts no breadcrumb JSON-LD, so the checkout page emits one server-side with the
  existing `JsonLd` and `breadcrumbJsonLd`. It has the hub's two items (National Show `https://saoc.co.za/national-show`,
  Tickets `https://saoc.co.za/national-show/tickets`), then the product at `https://saoc.co.za/tickets/<slug>`, the page's
  canonical URL. The slug is percent-encoded with `encodeURIComponent`, so reserved or non-ASCII characters still give a
  valid URL.
- **Wrapping at 390px (architect decision).** `.nos-theme .nk-crumbs` in `app/(marketing)/national-show/nos-structure.css`
  gains `flex-wrap: wrap`.
  - Without it, the five-item trail squeezes "National Show" onto two lines and shrinks the separators at 390px.
  - With it, the current item takes the next line whole.
  - The hub's two-item trail fits on one line at every width, so it renders as before.
  - This is a layout property, not a token. Codi may rule otherwise, for example hiding the middle item on small screens.
- **No new copy, tokens or colours.** "National Show" and "Tickets" are the hub's own strings, and the product name is
  `ticketType.name`, already the h1.
- **Known dependency.** The rendered checks need a product on sale and not sold out. If sales close, they report INFRA, not a
  regression.
