---
schema: athanor.mission/v1
slug: nos-design-system
goal: nos-design-system
created_at: '2026-09-06T21:02:15.256562+00:00'
started_at: '2026-09-06T21:02:15.256562+00:00'
last_active_at: '2026-09-06T22:31:31.784599+00:00'
status: in_progress
cost_estimate:
  features: 13
  milestones: 4
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F1
  ts: '2026-09-06T22:31:31.784599+00:00'
features:
- id: F1
  status: in_progress
  inline_brief: Scoped NOS token layer, fonts and logo assets. New app/(marketing)/national-show/layout.tsx
    introducing a nos-theme wrapper that redefines the NOS palette/type/spacing tokens
    locally. Cormorant Garamond + Jost via next/font. Emblem and Layout-B logo assets
    vendored from the Claude Design project. Zero edits to app/globals.css :root and
    zero edits to components/chrome/*.
  started_at: '2026-09-06T22:31:31.784397+00:00'
- id: F2
  status: pending
  inline_brief: 'NOS primitive components: Button, Badge, Card, SectionHeading, Logo
    (Layout B), EmblemBadge, Icon, plus the form primitives the vendor and ticket
    forms need. All render through the F1 scoped tokens.'
- id: F3
  status: pending
  inline_brief: 'NOS composite blocks: NosHero (full-bleed with purple scrim), programme/event
    card grid, visit and CTA bands, section nav, and the NOS footer brand band that
    sits above the inherited SAOC footer.'
- id: F4
  status: pending
  inline_brief: Restyle the /national-show landing page (642 lines, flagship) into
    the NOS system.
- id: F5
  status: pending
  inline_brief: Restyle /national-show/plan-your-visit and /national-show/what-to-expect.
- id: F6
  status: pending
  inline_brief: Restyle /national-show/faq, /national-show/archive and /national-show/archive/[year].
- id: F7
  status: pending
  inline_brief: Restyle /national-show/exhibitors.
- id: F8
  status: pending
  inline_brief: Restyle /national-show/tickets.
- id: F9
  status: pending
  inline_brief: Restyle /national-show/workshops and /national-show/conferences through
    NOS-scoped wrappers and props only. components/tickets/CategoryTicketsPage is
    owned by the sibling SAOC session and must not be edited.
- id: F10
  status: pending
  inline_brief: Restyle /national-show/vendors and /national-show/vendors/apply.
- id: F11
  status: pending
  inline_brief: Restyle /national-show/vendors/register and /national-show/vendors/payment.
- id: F12
  status: pending
  inline_brief: Capture "after" screenshots at 390 and 1280 for every route into .agent/evidence/nos-design/<route>/,
    run the route-200 sweep, and complete the a11y pass (visible focus, labelled controls,
    WCAG AA contrast against the NOS palette).
- id: F13
  status: pending
  inline_brief: Write docs/nos-design-system.md, get the contract gate green, and
    open the PR to main.
- id: F14
  status: pending
  inline_brief: Admin information architecture and navigation. Make role separation
    unmistakable — vendor vs exhibitor vs visitor — with scannable status, clear wayfinding,
    and a dashboard that answers "what needs me now". Structural information design,
    not a re-skin; admin is deliberately NOT show-branded.
- id: F15
  status: pending
  inline_brief: 'Admin vendor and exhibitor review surfaces: application queues, status
    transitions, payment and booth allocation, made legible at a glance.'
- id: F16
  status: pending
  inline_brief: 'Admin visitor and door surfaces: check-in scanner, ticket lookup,
    live show-day operational view.'
- id: F17
  status: pending
  inline_brief: Ticket purchase flow as a conversion surface end to end — product
    presentation, day selection, attendee naming, and a confirmation moment that feels
    like an event ticket rather than a receipt.
- id: F18
  status: pending
  inline_brief: 'SEO and discoverability: per-route metadata, Event/Organization structured
    data, Open Graph and Twitter cards with NOS-branded images, sitemap, canonical
    URLs.'
- id: F19
  status: pending
  inline_brief: Social and advertising kit built from the NOS tokens and emblem —
    fixed-ratio export-ready artboards for Instagram and Facebook.
milestones:
- id: M1
  status: pending
  features:
  - F1
  - F2
  - F3
- id: M2
  status: pending
  features:
  - F4
  - F5
  - F6
  - F7
- id: M3
  status: pending
  features:
  - F8
  - F9
  - F10
  - F11
- id: M4
  status: pending
  features:
  - F12
  - F13
- id: M5
  status: pending
  features:
  - F14
  - F15
  - F16
- id: M6
  status: pending
  features:
  - F17
  - F18
  - F19
---

# Mission: nos-design-system

## Context

Restyle every page under `/national-show` in the **National Orchid Show 2027** design
system, delivered as Claude Design project `262aba20-788b-4930-b724-255600ffd9d3`
("National Orchid Show 2027 — Design System") plus `branding/National Show 2027/` in
this repo. Endpoint set by Brad; this session (`saocnosdesign-ea`) owns
`app/(marketing)/national-show/**` plus new NOS branding components. The sibling SAOC
session in `~/ai/SAOC` owns everything else.

### Hard architectural rule

> NOS carries its own branding **below** the SAOC header, inherits the parent site
> chrome unmodified, and **never overrides SAOC styles globally.**

Implementation consequence: NOS pages already render inside `app/(marketing)/layout.tsx`'s
`<main>`, beneath `UtilityBar` + `Header`, above `Footer`. So the NOS token layer must be
**scoped to a wrapper element** introduced by a new
`app/(marketing)/national-show/layout.tsx` — never added to `:root` in `app/globals.css`,
and never applied to `components/chrome/*`.

### Design system facts (pulled from DesignSync, 2026-09-06)

- **Palette (committee-approved):** royal purple `#211A57` (primary ink), olive
  `#A7A841` / `#7F7D33`, pale gold `#F3F2D6` (ground). Support purple/lilac scale and
  violet accent `#7E3F97` are *sampled from the emblem*, not committee-ratified.
- **Type (confirmed):** **Cormorant Garamond** display/wordmark (400–500 only, never
  heavy; caps tracked ~0.16em) + **Jost** for UI/labels/body, lockup line at 0.30em
  tracking. **Montserrat is retired** — it belonged to the superseded badge logo.
- **Logo:** the circular badge lockup is **RETIRED**. Approved identity is **Layout B**
  — *Disa graminifolia* emblem above a single-line `NATIONAL ORCHID SHOW` wordmark in
  Cormorant, over a wide-tracked `WESTERN CAPE · 2027` line in Jost.
- **Surfaces:** flat fields only — pale gold / white / royal purple, or full-bleed
  studio orchid photography on near-black. **No gradients, no synthetic textures.**
- **Radii** 10/16/999px · **borders** 1.5px primary, 1px hairline · **shadows** soft, low,
  purple-tinted `rgba(33,26,87,…)`, never black · **motion** ease-out
  `cubic-bezier(0.16,1,0.3,1)`, 120–360ms, no bounce/spring/parallax.
- **Voice:** botanical, quietly authoritative, sentence-case Cormorant headlines,
  wide-tracked Jost eyebrows, no emoji, SA conventions (`R`, `9am–5pm`), species names
  italicised.

### Known constraints

1. **Photography rights.** The 13 Scott Ormerod studio orchid photos are his own work,
   watermarked, **not licensed stock**. The design system flags them reference/mood only.
   Do **not** ship them as page imagery without confirmed rights — use existing repo
   imagery or marked `data-placeholder` treatments instead.
2. **`workshops` + `conferences` 500 locally.** Both render the *shared*
   `components/tickets/CategoryTicketsPage`, which calls `getSoldCountsByTicketType()`
   (Firebase Admin SDK). `FIREBASE_ADMIN_*` are empty in this clone's `.env.local` and
   `.env.enc` will not decrypt (no age key present). Environmental, not a code defect.
   These two routes cannot be screenshot-verified locally until credentials arrive.
3. **Shared-component boundary.** `components/tickets/CategoryTicketsPage` is owned by
   the SAOC session. Restyle those two routes through NOS-scoped wrappers/props, **not**
   by editing the shared component.
4. `/national-show/upcoming` is an intentional **308 permanent redirect** to
   `/national-show` (F5, show-visitor-info). Passing Bar 1 means it keeps redirecting —
   it is not a page to restyle.
5. Where content is missing, write **credible filler marked `data-placeholder`**.

### Acceptance bars (Brad)

- **Bar 1:** build clean, every route 200 (`upcoming` = 308 by design).
- **Bar 2:** screenshots at 390 and 1280 of every page, **before and after**, in
  `.agent/evidence/nos-design/<route>/`; it must be beautiful and impressive.
- PR to `main` when green.

## Milestones

### M1 — NOS foundations
- **F1** — Scoped NOS token layer + fonts + logo assets. New
  `app/(marketing)/national-show/layout.tsx` wrapper; `nos-theme` scope; Cormorant
  Garamond + Jost via `next/font`; emblem/logo assets vendored from the design project.
  Zero changes to `app/globals.css` `:root` and zero changes to `components/chrome/*`.
- **F2** — NOS primitives: `Button`, `Badge`, `Card`, `SectionHeading`, `Logo`,
  `EmblemBadge`, `Icon`, plus form primitives where the vendor/ticket forms need them.
- **F3** — NOS composite blocks: `NosHero`, `NosEventCard`/programme grid, visit/CTA
  band, section nav, footer brand band.

### M2 — Landing + informational routes
- **F4** — `/national-show` landing (642 lines, the flagship page).
- **F5** — `plan-your-visit`, `what-to-expect`.
- **F6** — `faq`, `archive`, `archive/[year]`.
- **F7** — `exhibitors`.

### M3 — Commerce + vendor routes
- **F8** — `tickets`.
- **F9** — `workshops`, `conferences` (via NOS-scoped wrapper; shared component untouched).
- **F10** — `vendors`, `vendors/apply`.
- **F11** — `vendors/register`, `vendors/payment`.

### M4 — Evidence + ship
- **F12** — "after" screenshots at 390/1280 for every route, route-200 sweep, a11y pass
  (focus visibility, labels, contrast against the NOS palette).
- **F13** — `docs/nos-design-system.md`, contract gate green, PR to `main`.

## Design grammar — mandatory reading before any visual work

Supplied by the designer session (`saoc-nos-design-54`) on 2026-09-06 after Brad rejected
a first attempt as "AI slop that missed the point". Each bullet below is a **real
rejection**, not a preference.

- **Read the grammar, not just the vocabulary.** `readme.md` + the ten `guidelines/`
  pages are the grammar; `tokens/` is only the vocabulary. The rejected attempt was built
  from the five token files alone.
- **Photography is the brand's signature device.** Full-bleed studio orchid photography
  on pure black under a royal-purple scrim — single specimen, soft side light, shallow
  depth of field, generous margin. A NOS page with no photography fails on that alone.
- **Headlines:** Cormorant Garamond 400–500, **sentence case**. The serif carries the
  elegance; it does not need caps. Wide-tracked caps belong only to the wordmark and to
  Jost eyebrows/labels. Tracking caps everywhere was rejected.
- **Radii:** soft and generous — 10px cards, 16px large surfaces, 999px pills. 2px radii
  read cold and were rejected.
- **Cards:** white surface + 1px warm hairline (`--line`) + soft purple-tinted
  `--shadow-md`. Never harsh black shadows, never a coloured left-border accent stripe.
  Bare rules on a flat ground read generic and were rejected.
- **Borders** 1.5px primary / 1px hairline. **Motion** ease-out 120–360ms, no bounce, no
  spring, no parallax. No gradients, no synthetic textures — the emblem is the only
  illustration.
- **No duotone on photography.** `brand-photography.html`: "No filters, vignettes, or
  duotones — the flower supplies the colour." Duotone applies only to the *mark's*
  single-ink reproduction treatments. Three sessions propagated this error tonight.
- **No Cormorant-vs-Montserrat conflict exists.** Cormorant Garamond is the
  committee-selected pairing; Montserrat is retired with the superseded badge logo. Any
  claimed conflict came from a stale `_ds/` snapshot in a different project.
- **Do NOT invent copy.** These pages already carry real copy — "The Flagship",
  "Edition XIX", "Three years in the making, four days on the bench", ten named judging
  groups, a four-stage exhibitor path, past editions to 2012. We restyle, not rewrite.
  Treat existing copy as user-written content and preserve it verbatim. Brad's "credible
  filler marked `data-placeholder`" applies **only** where content is genuinely absent.

### Photography availability — corrected

A claim circulated that neither repo has photography. **False for this repo.**
`public/images/` holds five dark-ground studio orchid photographs already in production
use on these pages (`vendors/register/page.tsx:56` feeds `/images/orchid-yellow.jpg` to
`PageHero`; the current landing hero is one of them):

| File | Pixels |
|---|---|
| `orchid-dark.jpg` | 5184×3456 |
| `orchid-pink.jpg` | 3456×5184 |
| `orchid-purple.jpg` | 5308×4160 |
| `orchid-violet.jpg` | 7327×4885 |
| `orchid-yellow.jpg` | 3100×2325 |

All are ample for full-bleed heroes. These five are the cleared, in-use photography —
build the scrim treatment on them. Scott Ormerod's 13 remain **uncleared**.

### Cross-session ownership (agreed with `saoc-nos-design-54` / `saoc-0f`)

- Chrome and nav, the vendor apply→approve→token→payment flow, and ticketing are
  **functionally fixed** — no flow, nav, or behaviour changes. They are still re-skinned
  through the token scope, which touches none of their files.
- The scoped-token seam is **sanctioned by the tree owner**: redeclare the existing
  semantic names (`--bg`, `--bg-tint`, `--bg-dark`, `--fg`, `--fg-muted`, `--fg-on-dark`,
  `--accent`, `--link`, `--link-underline`) with NOS values on one scope element, NOS
  source palette declared on that same scope and assigned through — mirroring how
  `globals.css` already layers raw palette into semantics. Nothing renamed, no component
  forked, one deletable wrapper. **`:root` and `@theme` stay untouched** (`@theme` is
  global and would leak show tokens onto every SAOC page).

### Designer ruling — re-skin the "fixed" surfaces, with six hard guardrails

`saoc-nos-design-54`, 2026-09-06, as the design authority: chrome, vendor flow and
ticketing are **functionally fixed, not visually frozen**. Restyle them through the token
scope, edit none of their files, change no behaviour. Settled — not to be re-litigated at
review. (A section where the landing page is NOS-branded and ticket purchase is
SAOC-parchment would look broken, not restrained.) The
`app/(marketing)/national-show/layout.tsx` seam is the adopted version.

**Guardrails — brand consistency stops where it costs money or legibility:**

1. **Semantic status colours stay semantic.** Error/warning/success must NOT be remapped
   to brand hues. A failed card payment cannot render in violet because violet is the
   accent. Where `globals.css` routes these through the semantic layer, exclude them from
   the scope override explicitly.
2. **Focus rings must survive the ground change.** `--ring-focus`
   `rgba(154,99,174,.45)` is designed against white; on pale gold it may fall below 3:1
   non-text contrast. Check on every ground introduced; where it fails use solid
   `--violet #7E3F97` rather than thinning the ring.
3. **Body-copy contrast is measured, not assumed.** `--text-body` (`#3A3654`) on
   `--gold-100` (`#FBFAF0`) is comfortable. On royal purple, body text is **pale gold,
   never olive** — `#A7A841` on `#211A57` is fine for a wide-tracked location line and
   fails as running text.
4. **No uppercase form labels.** `saoc-0f` removed that transform deliberately for
   readability. Wide-tracked caps are for eyebrows and the wordmark; a form label is
   neither.
5. **Restraint scales with transaction risk.** Through apply → approve → register →
   payment, bias to the most conventional, highest-contrast treatment in the palette.
   Primary actions royal purple on light, or pale gold on royal purple. Never pale gold
   on white; never olive as a button fill. Someone entering card details should feel the
   page is boring and safe.
6. **The scrim serves legibility before mood.** Dark-to-transparent over the photograph,
   text on the dark end, headline tested against the actual image rather than an average
   of it. No duotone, filters or vignettes on photography.

**The overriding test:** the rejected pass "was correct about tokens and wrong about
feeling". The brand is a naturalists' society, not a festival — warm, quietly
authoritative, generous with space, elegant rather than austere. **If a screen looks
technically compliant and still feels cold, it is wrong.** Judge output on that before
judging it on the checklist.

## Notes

- Evidence harness lives at scratchpad `capture.mjs` (Playwright, `deviceScaleFactor: 2`,
  full-page, `reducedMotion: 'reduce'`); writes `<phase>-<viewport>.png` into
  `.agent/evidence/nos-design/<slug>/`. "before" set captured 2026-09-06 (28 shots).
- Contrast watch: pale gold `#F3F2D6` grounds with olive `#A7A841` text will **fail**
  WCAG AA. Olive is an accent/rule colour, not body text on light grounds.

---

## NEXT MISSION — NOS section structure (agreed with `saoc-0f`, 2026-09-08)

Lee-Ann's Drive folder structure is now the baseline site structure (Brad's
instruction). Her "National Show" folder (Drive id `1O2Lbzsbt57i8-7ZLFdhrcHjaMQ--TkJH`)
has 13 numbered folders; **five have no route**. Read her documents with the `gws`
CLI — **curl does not work against Drive here.**

### The five routes to build — paths are agreed and final

| Lee-Ann | path | source document |
|---|---|---|
| 2 About | `/national-show/about` | `2.1 About - 2027 National Show.docx` |
| 5 International Exhibitors | `/national-show/exhibitors/international` | — |
| 6 SAOC Symposium | `/national-show/symposium` | `Symposium Theme` |
| 7 WOSA Conference | `/national-show/wosa-conference` | — |
| 11 Programme of events | `/national-show/programme` | — |

International nests under the existing `/national-show/exhibitors` so that live,
indexed URL stays stable; it remains the South African page.

### Sub-nav grouping (agreed, adopted by `saoc-0f`)

Grouped by visitor intent, **not** by Lee-Ann's numbering — her numbers are document
order, not information architecture, and building nav from them would ship her filing
system to visitors. The spine is *can I come, what's on, can I take part, how do I pay*.

- **Visit** — About · What to expect · Plan your visit · FAQ
- **Programme** — Programme of events · Workshops & field trips · SAOC Symposium · WOSA Conference
- **Exhibit & trade** — South African exhibitors · International exhibitors · Vendors
- **Tickets** — standalone, outside the groups; it is the conversion path and must never be two clicks deep
- **Past editions** — archive, deliberately last and visually quieter

**Read versus buy.** `/national-show/conferences` is a *ticketing category* page.
`/symposium` and `/wosa-conference` are *content* pages (theme, speakers, programme).
Programme links to the content pages; those pages carry the CTA through to
`/conferences`. Without this distinction the two look like duplication.

**Two nav layers.** `saoc-0f` builds the header `National Show` dropdown. This session
builds the section's own persistent sub-nav **below** the SAOC header, inside
`.nos-theme`. Honours the hard rule: NOS branding sits below the header and never
modifies it.

### ⚠ FABRICATION TRAP — the Symposium has no date at source

Lee-Ann's own FAQ document contains the literal placeholder
`"The symposium will be held on xx, xx September 2027 at the xx"`.

**There is no date or venue to find.** It must NOT inherit the show's own
16–19 September dates or the show venue as a stand-in. That is exactly how an invented
CTICC venue once propagated across six fields on this site. `saoc-0f`'s F2 contract now
greps for that substitution. Use `data-placeholder`, or omit.

### Other agreements

- **Exhibitor Entry → `exhibitor-entry`**, its own ticket category, never `admission`.
  The buyer is a participant, not a visitor; collapsing them destroys the
  visitor-vs-exhibitor split Brad asked to be unmistakable. `saoc-0f` is NOT retrofitting
  this tonight — the `'unresolved-nos-boundary'` literal is contract-locked and stays
  until the Sanity enum can hold a fourth value.
- **WOSA:** cultivation vs wild is a hard `CLAUDE.md` line. `/wosa-conference` covers the
  conference *at our show* and links out for wild-orchid content. WOSA's own site rebuild
  is a different session's work — **link, never mirror.**
- **Ownership:** `saoc-0f` owns ticketing engineering, taxonomy, pricing, checkout,
  `components/tickets/**`, and `nav-config.ts`. This session owns all markup inside
  `app/(marketing)/national-show/**`, NOS branding, and admin UI. They deliver a data
  layer + component API and stay out of the NOS tree entirely.
- **New pricing rule:** early bird = purchased 90+ days before the show = **20% discount**
  (cutoff 2027-06-18). This supersedes the separate early-bird products, so the tickets
  front door will need re-cutting against a computed discount rather than a static cutoff
  line.

### Live-data cautions

- **One shared Sanity dataset (`production`)** for local dev and the deployed site. Any
  dataset write is instantly live with no deploy. Treat writes as production changes.
- **Two Weekend Pass SKUs coexist** (R380 with a 2027-07-31 cutoff, and R400 flat).
  Neither is authoritative; Brad's to resolve.
- **The VIP ladder is incoherent** (VIP R300 below a R400 Weekend Pass while including
  more). Client's call; VIP keeps `data-placeholder`.
- **Two enquiry addresses live at once** (`council@saoc.co.za`, `info@saoc.co.za`). Use
  the existing contact component; hardcode neither.
