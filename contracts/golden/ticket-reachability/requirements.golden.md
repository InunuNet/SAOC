# Ticket reachability — requirements & placement decisions

## The defect

`/tickets` renders correctly (five ticket types, provisional prices, working
PayFast-sandbox purchase form) but was linked from exactly one place in the
whole site: `app/(marketing)/national-show/what-to-expect/page.tsx:122`. Not
in the header, not on the home page, not on the `/national-show` landing
page. The revenue path was unreachable by clicking — the same defect class
already recorded against `/national-show/archive`, but on the page that
takes money.

## Placement decisions (architect)

Three entry points, chosen from what each surface already contains — not a
fourth new pattern:

### 1. Header — `components/chrome/Header.tsx`, `NAV` array (line 19)

**Decision: add a `Tickets` entry to the `NAV` array itself** (not a second
action-zone button next to `Contact`), because:

- `NAV` is passed to both the desktop `<nav>` (visible ≥1180px) **and**
  `MobileMenu` (`components/chrome/MobileMenu.tsx:16`), which renders it
  full-screen at any viewport. One array edit gets both desktop and mobile
  for free.
- The existing `/contact` action-zone button (line 148) is styled
  `hidden sm:inline-block` — invisible below the 640px `sm` breakpoint. At
  375px it does not render at all, and `MobileMenu` never renders it either
  (`MobileMenu` only receives `nav`, not the action-zone JSX) — Contact is
  itself unreachable at 375px today. A ticket link placed the same way would
  inherit that same mobile gap. This is a pre-existing gap, out of scope to
  fix here, but it rules out copying that exact pattern for a link that must
  work at 375px.
- Recommended label: **`Tickets`** — short, matching the existing single/two
  -word nav idiom (`About`, `Societies`, `Judging & Awards`, `Events`), not
  `Book Tickets` (that phrasing is reserved for the page-level CTA buttons
  below, which have room for a verb).
- Visual treatment (plain nav item vs. accent-styled) is dev's call; the
  contract only requires the link to exist, be inside `<header>`, and carry
  visible text containing "Tickets".

### 2. `/national-show` landing page — Hero CTA row

`app/(marketing)/national-show/page.tsx`, the hero CTA row (`mt-10 flex
flex-wrap gap-4`, currently `Register Interest →` + `Find Your Society`).

**Decision: add a third CTA here**, not inside the `VISITOR_CARDS` grid
lower down. The hero is the first thing anyone visiting the Show's landing
page sees, and it already establishes the CTA-row pattern for this exact
kind of action. Recommended label: **`Book Tickets`** (or `Book Tickets →`
to match the sibling CTA's arrow convention).

### 3. Home page — `components/home/ShowBand.tsx` CTA row

Lines 135–148, currently `Show details` (primary, `/national-show`) +
`Exhibitor info` (`/national-show/exhibitors`). ShowBand is the flagship-Show
summary block on the home page — venue, dates, countdown — making it the
highest-intent surface on the home page for a ticket CTA.

**Decision: add a third CTA here**, recommended label **`Book Tickets`**
(consistent with the national-show hero CTA, since both are top-of-funnel
entry points to the same destination). Not the `NavCards` or `EventsStrip`
sections — those are navigational/informational, not action-oriented.

## Constraints respected

- No new colours/fonts/brand assets — existing `app/globals.css` tokens only.
- No header, home page, or national-show restructuring — only additive link
  insertion at the three points above.
- No changes to `app/api/tickets/itn/route.ts`, ticket prices, the purchase
  form, or Sanity content.
- Mobile-first: the header fix must work at 375px (see NAV-array reasoning
  above); the home/national-show CTA buttons are ordinary flex-wrap buttons
  already responsive by the surrounding layout.

## Post-implementation regression: desktop nav wrap (found by @qa)

After F1 added `Tickets` as the 7th entry in `NAV` (`components/chrome/Header.tsx:19`),
@qa causally proved (removing `nav a[href="/tickets"]` in-browser via
`page.evaluate()`, no source edit, and re-measuring the same page/viewport)
that the 7th item makes the desktop `<nav>` wrap to two lines across
approximately **1180px–1210px**. That band sits exactly on the
`min-[1180px]` breakpoint where the hamburger disappears and the desktop
nav becomes the only nav-reachable path — and iPad Pro 11" landscape
(1194px) sits inside it. See `negative-control.golden.md` for the measured
per-width evidence and `check-nav-no-wrap.mjs` for the sweep.

**Acceptance criterion (mechanism left to dev):** across the swept widths
(1180, 1194, 1200, 1220, 1260, 1280 — and any new value the fix moves the
breakpoint to, see below), the desktop nav must never wrap to a second
line, AND at no width may *neither* the desktop nav *nor* the hamburger be
visible (a "dead band" would be worse than wrapping — it would make every
NAV destination, not just Tickets, briefly unreachable).

Two mechanisms QA suggested, either acceptable, dev's choice:
- Tighten nav item spacing/font-size so 7 items fit under 1180px, or
- Nudge the breakpoint up (e.g. `min-[1180px]` → `min-[1240px]`, mirrored in
  `MobileMenu`'s corresponding hamburger-visibility class) so the desktop
  nav never renders until there's room for 7 items.

**If the fix moves the breakpoint**, TKT-14's width sweep in
`contract-ticket-reachability.yaml` must be updated to straddle the *new*
boundary (the sweep is a parameter to the check script, not hardcoded in
it) — a fix that moves the boundary without an updated sweep would leave
the new boundary unverified.

**Broader recommendation (out of scope here, noted for the record):** the
wrap-and-dead-band pattern this check guards against is a property of the
Header/MobileMenu breakpoint handoff generally, not specific to ticket
reachability — any future NAV addition could reintroduce it. Worth a
standing structural assertion outside this feature's contract; not built
here per explicit scope instruction to keep this to an assertion or two.

## What "reachable" means for the assertions

Per the dispatch: a grep proving a string exists in a `.tsx` source file does
NOT prove a user can click it. Every assertion in
`contracts/contract-ticket-reachability.yaml` therefore:

1. Fetches the **rendered HTML** over real HTTP from the running dev server
   (port 3333) — never greps source.
2. For the header, isolates the `<header>...</header>` element before
   grepping (`extract-header-html.mjs`, same pattern as
   `contracts/checks/partners-cards/extract-footer-html.mjs`), and does so
   on `/about` — a non-home page — to prove the header is genuinely global,
   not local to whichever page carries the fix.
3. Proves the mobile path with a real Playwright browser at a 375px
   viewport: open the hamburger, wait for the `MobileMenu` dialog, find
   `a[href="/tickets"]` inside it, assert it's visible, click it, and assert
   the browser actually lands on `/tickets`
   (`check-mobile-tickets-link.mjs`). A desktop-only link cannot pass this.
4. Proves link text is meaningful, not just present, via
   `extract-anchor-text.mjs`, which returns the flattened inner text of the
   first anchor matching a given `href` — so a hidden/empty/decorative
   anchor can't satisfy the check.
5. Proves the destination works end-to-end: `/tickets` returns HTTP 200 and
   the rendered body contains the three real ticket type names (`Adult`,
   `Child`, `Pensioner`) that already render there today — a link to a
   broken page is not reachability.
