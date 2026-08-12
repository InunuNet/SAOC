# Ticket page reachability

Contract: [`contracts/contract-ticket-reachability.yaml`](../contracts/contract-ticket-reachability.yaml)
(15/15 assertions green). Goldens: [`contracts/golden/ticket-reachability/`](../contracts/golden/ticket-reachability/).

## What this is

Brad reported "I didn't see any options for ticket purchasing" while
browsing the site. `/tickets` was fully working — five ticket types, a
PayFast-sandbox purchase form — but was linked from exactly one place in the
entire codebase: `app/(marketing)/national-show/what-to-expect/page.tsx:122`.
Not in the header, not on the home page, not on `/national-show`. The
revenue path returned HTTP 200 but was unreachable by clicking.

## Files changed

- `components/chrome/Header.tsx` — added a `Tickets` entry to the `NAV`
  array (line 19), which feeds both the desktop `<nav>` and the
  `MobileMenu` full-screen dialog.
- `app/(marketing)/national-show/page.tsx` — added "Book Tickets →" to the
  hero CTA row, alongside the existing "Register Interest →" / "Find Your
  Society" links.
- `components/home/ShowBand.tsx` — added "Book Tickets" to the ShowBand CTA
  row, alongside "Show details" / "Exhibitor info".

## The recurring defect class

A route returning 200 is not the same as a feature being reachable, and
nothing in the build catches the difference — `tsc` and `eslint` don't know
or care whether any page links to another page. `/national-show/archive`
had the identical problem and is already logged (see the comment at
`app/(marketing)/national-show/page.tsx:69` and
`contracts/golden/show-visitor-info/`). This is the same defect class
recurring, on the page that takes money instead of an archive page. That's
why every assertion in this contract fetches rendered HTML over real HTTP
from the running dev server rather than grepping `.tsx` source — a string
match in source proves the JSX exists, not that a user can click it.

## Why the mobile path needed its own assertion

The header collapses to a hamburger dialog (`MobileMenu.tsx`) below its
desktop breakpoint. A desktop-only link would pass a naive "grep the header
for /tickets" check while leaving mobile users with no route to tickets at
all. TKT-03 drives a real Playwright browser at a 375px viewport: opens the
hamburger, waits for the dialog, finds `a[href="/tickets"]` inside it,
asserts it's visible, clicks it, and asserts the browser lands on
`/tickets`. The negative control (pre-change) confirmed the dialog's link
set was `About, Societies, Judging & Awards, National Show, Events,
council@saoc.co.za` — no Tickets entry — so this is a genuine red-to-green
detector, not a regression guard.

This also drove the placement decision for the header fix: `Tickets` was
added to the shared `NAV` array (which both desktop nav and `MobileMenu`
consume) rather than as a second action-zone button next to the existing
`/contact` button. That button is `hidden sm:inline-block` — invisible below
640px, and `MobileMenu` doesn't render it at all — so copying that pattern
would have inherited a pre-existing mobile gap. (That gap on the Contact
button itself is out of scope here, left as-is.)

## Scope boundary — this does not add tiers

This makes the *existing* single-tier ticket flow findable. It does not
change ticket types, prices, or the purchase/checkout flow — no changes to
`app/api/tickets/itn/route.ts`, the PayFast integration, or Sanity content.
Per Brad's 2026-08-12 decision, ticketing holds at a single tier until the
sandbox flow is proven end to end, then expands. Making the page prominent
does not imply multi-tier is coming next — that's a separate backlog item,
not something this doc should suggest is imminent.

One consequence of raising the page's visibility: the prices shown on
`/tickets` are still invented placeholders labelled "Provisional price —
pending council confirmation." Making the page easier to find raises the
urgency of getting real council-confirmed prices before this goes live —
flagged here as a follow-up, not fixed as part of this change.

## What the gate proves

- Header link exists inside `<header>` and carries visible "Tickets" text,
  checked on `/about` (a non-home page) specifically to prove the header is
  genuinely global rather than coincidentally fixed only where the other
  CTAs also happen to be present (TKT-01/02).
- Mobile dialog contains a working, clickable link to `/tickets` at 375px
  (TKT-03).
- Home page and `/national-show` both contain an `<a href="/tickets">` with
  meaningful link text, not empty or "click here" (TKT-04–07).
- `/tickets` itself still returns 200 and still renders Adult/Child/Pensioner
  ticket types — regression guards proving the destination wasn't broken by
  this change, not proof the links are new (TKT-08–11, already green
  pre-change per the negative control).
- `Header.tsx`'s `NAV` array still contains all five pre-existing
  destinations — additive only, not a rewrite (TKT-12).
- No `outline-none` added without a replacement focus style on the touched
  files (TKT-13).
- `tsc --noEmit` and `eslint` pass on the touched files (TKT-GATE-01/02).

QA is reviewing in parallel per the team lead — this doc does not claim a
QA pass; only that the gate is 15/15 green, independently verified by the
orchestrator.
