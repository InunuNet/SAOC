# ticketing-complete M3/F6 — design record

Site-wide primary navigation rebuild. The one feature in this mission Brad asked for in his
own words ("a proper beautiful menu system so it's easy to navigate through all the
different sections") — everything else tonight is infrastructure he'll appreciate but
didn't request.

## 1. Files this feature creates/extends

- `components/chrome/nav-config.ts` — RESTRUCTURED. `NAV` reshapes into the negotiated
  groups (see §3) plus the National Show mega item's five newly wired hrefs (see §4).
- `components/chrome/Footer.tsx` — FIXED. `min-w-0` (or equivalent) added to the "Stay in
  touch" email input (see §5 for the root cause).
- `components/chrome/MegaMenu.tsx` / `MobileMenu.tsx` — EXTENDED to render the new group
  structure, reusing the existing `aria-haspopup`/`aria-expanded`/`role="menu"` disclosure
  pattern already present (not a second pattern invented alongside it).
- `e2e/mobile-nav-reaches-every-section.spec.ts`, `e2e/nav-keyboard-operable.spec.ts` — NEW
  Playwright specs (F7's harness already exists by the time F6 lands).
- `contracts/checks/ticketing-complete-f6/check-style-freeze.mjs` — NEW. Follows the
  existing `contracts/checks/vendor-f3-showcase-page/check-untouched-scope.mjs` convention
  exactly: sha256-compares a fixed file list against
  `goldens/fixtures/f6-style-freeze-baseline.json`.
- `contract-f7.yaml`'s own A8 — FLIPPED (not this feature's file, but this feature's
  required action — see §6).

## 2. Lee-Ann's folder numbering is document order, not information architecture

Her Drive folder ("Docs for Brad") lists SAOC's sections in the order she wrote them up —
Home, About, Societies, Calendar of events, Members Portal, Judging. That sequence answers
"in what order did Lee-Ann document these," not "how should a visitor navigate between
them." F6 does not rebuild the nav from her numbering. It groups by visitor intent
(negotiated with the NOS session for the National Show side, and by conventional site-nav
practice for the SAOC side) and separately guarantees (A3) that all six of her destinations
remain reachable regardless of where they land in that grouping.

## 3. The negotiated group structure

- **Visit** — About, What to expect, Plan your visit, FAQ
- **Programme** — Programme of events, Workshops & field trips, SAOC Symposium, WOSA
  Conference
- **Exhibit & trade** — South African exhibitors, International exhibitors, Vendors
- **Tickets** — standalone, outside every group. It's the conversion path; it doesn't get
  buried two clicks deep inside a dropdown.
- **Past editions** — last, and deliberately quieter than the other groups (lower visual
  weight, not a fifth equally-prominent nav item).

This is the NOS session's own proposed grouping for the National-Show-scoped items, accepted
because it's better organized than an SAOC-side-only redesign would have produced alone.
The SAOC-side sections (Home, About, Societies, Judging, Events, Members Portal) sit
alongside these per §2 — A3 checks all six are reachable; it does not mandate they sit in
any particular one of these five groups, since they aren't National Show content.

## 4. National Show dropdown — five committed paths, three (of five) not yet built

Negotiated and final on both sides: `/national-show/about`,
`/national-show/exhibitors/international`, `/national-show/symposium`,
`/national-show/wosa-conference`, `/national-show/programme`. Confirmed by direct filesystem
check (2026-09-08): none of the five exists as a real route yet — the NOS session is
building them. F6 wires nav entries to all five anyway; that's the agreed contract between
sessions, not premature scaffolding. **Pending-route handling**: every one of the five is
enumerated in `goldens/fixtures/f6-pending-nos-routes.json`, and F7's
`nav-links-200.spec.ts` reads that exact file to decide which hrefs to exempt from its
200-status check — never a hardcoded skip-list of its own that could silently drift from
nav-config.ts's real pending set. A nav item pointing at a dead route is worse than no nav
item; an untracked exemption is just as bad, because nobody can tell a real regression from
an expected gap. When the NOS session lands one of these for real, its entry comes OUT of
the pending list — leaving it in after the route exists would silently stop testing it.

## 5. Footer overflow bug — root cause and fix

`components/chrome/Footer.tsx`'s "Stay in touch" column wraps the email input and Subscribe
button in `<form className="flex gap-0">`: the input carries `flex-1`, the button carries
`shrink-0`. A flex item's default `min-width` is `auto`, which means "don't shrink below my
own intrinsic content width" — NOT `0`. At the `lg` breakpoint (1024px), the footer's
4-column grid (`lg:grid-cols-4`) narrows this column enough that the input's intrinsic width
plus the button's fixed width together exceed the column's available space, and because
neither has `min-w-0`, the browser doesn't shrink either — it overflows the row, and
therefore the page, horizontally. This reproduces exactly in the 1024–1050px band because
that's the range where the column is narrow enough to trigger it but the viewport hasn't yet
grown enough to give the column room. Fix: `min-w-0` on the input, so it can shrink below its
placeholder's intrinsic width when the column is tight.

## 6. Flipping F7's inverted A8

F7's `contract-f7.yaml` A8 was deliberately written inverted — `! npx playwright test
e2e/no-horizontal-overflow.spec.ts --grep "1024|1050"` — so it reads GREEN exactly while the
live bug exists, proving the harness is actually looking at something real rather than going
green on first run against a known-broken page. Once §5's fix lands, that sub-test itself
starts passing, which means the INVERTED assertion would start reading FAIL — the intended
signal that F6 needs to flip it. This feature's own A12 mechanically checks that the leading
`!` is gone from F7's A8 command. Doing this any other way is a trap: deleting the assertion
loses the coverage permanently; fixing the bug without flipping the polarity leaves a
permanently-red assertion nobody trusts and someone eventually "fixes" by deleting it anyway,
for the wrong reason.

## 7. Style freeze — the one sanctioned exception, everything else provably untouched

Brad's standing rule: the SAOC site's style is dialled in; design work lands only on the
National Show section. Navigation is the SOLE exception for this mission. Rather than a
comment asking people to be careful, A8/A9 make it a real assertion: `sha256`-hash a fixed
set of representative files (`app/globals.css` plus Home/About/Societies/Judging/Events/
Members page components) captured the moment before any F6 code existed
(`goldens/fixtures/f6-style-freeze-baseline.json`, captured 2026-09-08). This mirrors the
existing `contracts/checks/vendor-f3-showcase-page/check-untouched-scope.mjs` pattern
deliberately — sha256 comparison, not a git diff, so it's unaffected by other in-flight
features (F1/F2/F7) editing unrelated files in the same working tree tonight. A9 additionally
pins `globals.css`'s custom-property count at 77 (the count at capture time) as a
specifically-named guard against the one shortcut most likely to be tempting ("just add one
token for the nav").

## 8. Accessibility — keyboard and visible focus, not hover-only

This repo's own `coding.md` rule is non-negotiable: every interactive element needs a label,
a role, and a keyboard handler. A dropdown that opens only on `:hover` fails keyboard and
touch users outright — it's not a degraded experience, it's an inoperable one for that user.
F6 keeps the existing `aria-haspopup`/`aria-expanded`/`role="menu"` disclosure pattern already
proven in `MegaMenu.tsx` (Escape-to-close, focus return to trigger) and extends it to the new
group triggers rather than inventing a second interaction pattern alongside it. A15/A16 prove
this at runtime — a real keyboard press opens the panel, and a real computed-style check
(never a class-name proxy) confirms a visible focus indicator, mirroring F7's A7's own
"real geometry, not a class-name standing in for verification" standard.

## 9. Mobile-first, not desktop-with-a-hamburger-bolted-on

A dropdown-heavy desktop menu is exactly the shape that degrades badly at small widths — this
repo's own rules state mobile-first as standing, not aspirational. A13/A14 require a real e2e
spec that opens `MobileMenu.tsx` at 390px and 320px and click-navigates through at least 5
distinct destinations (the six Lee-Ann sections plus Tickets), asserting real URL changes
(`toHaveURL`/`waitForURL`) — not merely that the destination's label text exists somewhere in
the DOM, which would pass even for a hidden, unreachable element.
