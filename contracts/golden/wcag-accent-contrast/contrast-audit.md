# WCAG AA contrast audit — `--accent` token family

Verified independently 2026-08-16. The prior session's report ("text-accent fails
WCAG AA contrast at 2.94:1 on ContactForm and TicketPurchaseForm, both public-facing")
**is real and correctly measured** — but the true blast radius is far larger than the
two named components. `--accent` (`#9e8c6b`) is used as *text* color (foreground) in
27 places across the public site, and as a *button fill* (background, with `text-ivory`
on top) in 8 more. All light-surface and button-fill usages fail AA; some dark-surface
usages already pass.

## Method
WCAG 2.1 relative-luminance contrast, computed from the actual hex values in
`app/globals.css` (see `check_contrast.py`). Threshold: 4.5:1 for normal text and for
any text/UI-fill under 18.66px bold / 24px — which is every usage found below (largest
is 15px). No usage here qualifies for the 3:1 large-text exception.

## Token baseline (current values)
| Token | Hex | vs `--parchment` #f4f3ec | vs `--bone` #e8e6dc | vs `--primary` #384138 | vs `--primary-800` #22281f |
|---|---|---|---|---|---|
| `--accent` | `#9e8c6b` | 2.94:1 FAIL | 2.62:1 FAIL | 3.24:1 FAIL | 4.61:1 PASS |
| `--accent-soft` | `#c2b393` | n/a (never used on light bg) | n/a | 5.13:1 PASS | 7.30:1 PASS |

Key finding: `--accent` cannot be darkened enough to pass on light surfaces (needs
≥4.53:1 on bone) without *also* dropping its already-thin PASS on `--primary-800`
(4.61:1 → would fall below 3:1). A single token-value change cannot fix both the
light-surface and dark-surface usages — see `remedy.md`.

## Every public-facing text usage of `text-accent` / `text-[var(--accent)]`

| # | File:line | Surface | Size/weight | Ratio | Required | Verdict |
|---|---|---|---|---|---|---|
| 1 | `components/contact/ContactForm.tsx:166` | parchment | 14px normal | 2.94:1 | 4.5:1 | **FAIL — originally reported** |
| 2 | `components/tickets/TicketFormField.tsx:38` | parchment | 13px normal | 2.94:1 | 4.5:1 | **FAIL — originally reported** |
| 3 | `components/tickets/TicketPurchaseForm.tsx:117` | parchment | 13px normal | 2.94:1 | 4.5:1 | **FAIL — originally reported** |
| 4 | `components/tickets/TicketPurchaseForm.tsx:141` | parchment | 14px normal (`role="alert"`) | 2.94:1 | 4.5:1 | **FAIL — originally reported** |
| 5 | `app/not-found.tsx:21` | bg-primary | 11px mono | 3.24:1 | 4.5:1 | FAIL — new (dark surface) |
| 6 | `app/(marketing)/national-show/archive/page.tsx:83` | bg-primary-800 | 11px mono | 4.61:1 | 4.5:1 | PASS today, but fragile (0.11 margin) — new |
| 7 | `app/(marketing)/national-show/archive/[year]/page.tsx:137` | bg-primary-800 | 11px mono | 4.61:1 | 4.5:1 | PASS today, fragile — new |
| 8 | `app/(marketing)/national-show/archive/[year]/page.tsx:184` | bg-bone | 11px mono | 2.62:1 | 4.5:1 | FAIL — new |
| 9 | `app/(marketing)/national-show/page.tsx:245` | bg-primary-800 | 11px mono | 4.61:1 | 4.5:1 | PASS today, fragile — new |
| 10 | `app/(marketing)/national-show/page.tsx:320` | parchment | 11px mono | 2.94:1 | 4.5:1 | FAIL — new |
| 11 | `app/(marketing)/national-show/page.tsx:365` | parchment | 11px mono | 2.94:1 | 4.5:1 | FAIL — new |
| 12 | `app/(marketing)/national-show/page.tsx:399` | bg-bone | 11px mono | 2.62:1 | 4.5:1 | FAIL — new |
| 13 | `app/(marketing)/national-show/page.tsx:470` | parchment | 11px mono | 2.94:1 | 4.5:1 | FAIL — new |
| 14 | `app/(marketing)/national-show/page.tsx:504` | bg-primary | 11px mono | 3.24:1 | 4.5:1 | FAIL — new |
| 15 | `app/(marketing)/national-show/page.tsx:522` | bg-primary (+6% white overlay) | 10px mono | ≈3.3:1 | 4.5:1 | FAIL — new |
| 16 | `app/(marketing)/national-show/page.tsx:556` | parchment | 11px mono | 2.94:1 | 4.5:1 | FAIL — new |
| 17 | `app/(marketing)/national-show/plan-your-visit/page.tsx:130` | parchment (hover state) | 13px normal | 2.94:1 | 4.5:1 | FAIL — new |
| 18 | `app/(marketing)/national-show/plan-your-visit/page.tsx:169` | parchment (hover state) | underline text | 2.94:1 | 4.5:1 | FAIL — new |
| 19 | `components/home/EventsStrip.tsx:53` | parchment | 11px mono | 2.94:1 | 4.5:1 | FAIL — new |
| 20 | `components/tickets/TicketTypeCard.tsx:52` | parchment/bone | 10px mono | 2.62–2.94:1 | 4.5:1 | FAIL — new |
| 21 | `components/show/AccommodationList.tsx:70` | parchment (hover state) | 13px normal | 2.94:1 | 4.5:1 | FAIL — new |
| 22 | `components/show/ShowFaqList.tsx:60` | parchment/bone (light) | 11px mono | 2.62–2.94:1 | 4.5:1 | FAIL — new |
| 23 | `components/show/ShowSectionNav.tsx:39` | bg-bone | 11px mono | 2.62:1 | 4.5:1 | FAIL — new |
| 24 | `components/show/VenueCard.tsx:60` | parchment (hover state) | underline text | 2.94:1 | 4.5:1 | FAIL — new |
| 25 | `components/show/VenueCard.tsx:90` | parchment (hover state) | 11px mono | 2.94:1 | 4.5:1 | FAIL — new |
| 26 | `app/(marketing)/contact/page.tsx:87` | parchment (hover state) | 14px normal | 2.94:1 | 4.5:1 | FAIL — new (this IS the public contact page, note ContactForm itself is components/contact/ContactForm.tsx row #1) |
| 27 | `app/(marketing)/contact/page.tsx:107` | parchment (hover state) | underline text | 2.94:1 | 4.5:1 | FAIL — new |
| 28 | `app/(marketing)/tickets/confirmation/page.tsx:147` | parchment (hover state) | 14px normal | 2.94:1 | 4.5:1 | FAIL — new |
| 29 | `app/(marketing)/events/[slug]/page.tsx:103` | bone (inline style) | tag/badge text | 2.62:1 | 4.5:1 | FAIL — new |
| 30 | `components/events/EventCard.tsx:45` | bone (inline style) | tag/badge text | 2.62:1 | 4.5:1 | FAIL — new |

## `bg-accent` fill + `text-ivory` (button case) — same root pairing, reversed roles
Ratio identical to accent-vs-parchment: **2.94:1 FAIL** (needs 4.5:1; 14px/13px
medium weight, not large text). Affected: `app/not-found.tsx:34`,
`app/(marketing)/tickets/cancelled/page.tsx:50`, `app/(marketing)/national-show/page.tsx:297`
(and the 10px "Next" badge at line 423), `components/home/ShowBand.tsx:138`,
`components/tickets/TicketPurchaseForm.tsx:149` (**public — ticket checkout submit
button**), `components/contact/ContactForm.tsx:174` (**public — contact submit
button**).

## One usage the token fix makes WORSE, requiring a separate component change
`components/chrome/UtilityBar.tsx:68` pairs `text-primary` on `bg-accent` (13px
normal). Today: 3.24:1 (already FAIL). After darkening `--accent` per the remedy
below, `--primary` (#384138) and the new darker accent (#74654c) sit close in
luminance — contrast **drops to 1.87:1**, worse than before. This pairing is not
fixable by the token change; it needs its own text-color swap (see `remedy.md`).

## Out of scope — decorative/graphical, not held to 4.5:1
`--accent` used as a plain fill/border with no text role: `components/home/Hero.tsx:122`
(carousel dot), `components/ui/EventRow.tsx:24` (border-left accent stripe),
`app/(marketing)/national-show/page.tsx:431-432` (cycle-rail dot). These are
UI-component graphical boundaries (WCAG 1.4.11, 3:1 threshold), not text, and were not
individually re-measured here — flagging so nobody mistakes their absence from the
table above for an oversight.
