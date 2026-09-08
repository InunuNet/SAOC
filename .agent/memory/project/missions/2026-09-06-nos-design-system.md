---
schema: athanor.mission/v1
slug: nos-design-system
goal: nos-design-system
created_at: '2026-09-06T21:02:15.256562+00:00'
started_at: '2026-09-06T21:02:15.256562+00:00'
last_active_at: '2026-09-08T17:09:35.331219+00:00'
status: in_progress
cost_estimate:
  features: 27
  milestones: 9
  total_calls: 0
last_checkpoint:
  milestone: M4
  feature: F12
  ts: '2026-09-08T17:09:35.331219+00:00'
features:
- id: F1
  status: done
  inline_brief: Scoped NOS token layer, fonts and logo assets. New app/(marketing)/national-show/layout.tsx
    introducing a nos-theme wrapper that redefines the NOS palette/type/spacing tokens locally. Cormorant
    Garamond + Jost via next/font. Emblem and Layout-B logo assets vendored from the Claude Design project.
    Zero edits to app/globals.css :root and zero edits to components/chrome/*.
  started_at: '2026-09-06T22:31:31.784397+00:00'
  completed_at: '2026-09-07T22:34:06.041424+00:00'
- id: F2
  status: done
  inline_brief: 'NOS primitive components: Button, Badge, Card, SectionHeading, Logo (Layout B), EmblemBadge,
    Icon, plus the form primitives the vendor and ticket forms need. All render through the F1 scoped
    tokens.'
  completed_at: '2026-09-07T22:34:07.682092+00:00'
- id: F3
  status: done
  inline_brief: 'NOS composite blocks: NosHero (full-bleed with purple scrim), programme/event card grid,
    visit and CTA bands, section nav, and the NOS footer brand band that sits above the inherited SAOC
    footer.'
  completed_at: '2026-09-07T22:34:08.928790+00:00'
- id: F4
  status: done
  inline_brief: Restyle the /national-show landing page (642 lines, flagship) into the NOS system.
  completed_at: '2026-09-07T22:34:10.242338+00:00'
- id: F5
  status: done
  inline_brief: Restyle /national-show/plan-your-visit and /national-show/what-to-expect.
  completed_at: '2026-09-07T22:34:11.554798+00:00'
- id: F6
  status: done
  inline_brief: Restyle /national-show/faq, /national-show/archive and /national-show/archive/[year].
  completed_at: '2026-09-07T22:34:13.110263+00:00'
- id: F7
  status: done
  inline_brief: Restyle /national-show/exhibitors.
  completed_at: '2026-09-07T22:34:14.434897+00:00'
- id: F8
  status: done
  inline_brief: Restyle /national-show/tickets.
  completed_at: '2026-09-07T22:34:15.886730+00:00'
- id: F9
  status: done
  inline_brief: Restyle /national-show/workshops and /national-show/conferences through NOS-scoped wrappers
    and props only. components/tickets/CategoryTicketsPage is owned by the sibling SAOC session and must
    not be edited.
  completed_at: '2026-09-07T22:34:17.193109+00:00'
- id: F10
  status: done
  inline_brief: Restyle /national-show/vendors and /national-show/vendors/apply.
  completed_at: '2026-09-07T22:34:18.433576+00:00'
- id: F11
  status: done
  inline_brief: Restyle /national-show/vendors/register and /national-show/vendors/payment.
  completed_at: '2026-09-07T22:34:19.643734+00:00'
- id: F12
  status: done
  inline_brief: Capture "after" screenshots at 390 and 1280 for every route into .agent/evidence/nos-design/<route>/,
    run the route-200 sweep, and complete the a11y pass (visible focus, labelled controls, WCAG AA contrast
    against the NOS palette).
  started_at: '2026-09-07T22:34:26.109560+00:00'
  completed_at: '2026-09-08T17:09:35.331034+00:00'
- id: F13
  status: pending
  inline_brief: Write docs/nos-design-system.md, get the contract gate green, and open the PR to main.
- id: F14
  status: done
  inline_brief: Admin information architecture and navigation. Make role separation unmistakable — vendor
    vs exhibitor vs visitor — with scannable status, clear wayfinding, and a dashboard that answers "what
    needs me now". Structural information design, not a re-skin; admin is deliberately NOT show-branded.
  completed_at: '2026-09-07T22:34:20.922983+00:00'
- id: F15
  status: done
  inline_brief: 'Admin vendor and exhibitor review surfaces: application queues, status transitions, payment
    and booth allocation, made legible at a glance.'
  completed_at: '2026-09-07T22:34:22.136910+00:00'
- id: F16
  status: done
  inline_brief: 'Admin visitor and door surfaces: check-in scanner, ticket lookup, live show-day operational
    view.'
  completed_at: '2026-09-07T22:34:23.349296+00:00'
- id: F17
  status: pending
  inline_brief: Ticket purchase flow as a conversion surface end to end — product presentation, day selection,
    attendee naming, and a confirmation moment that feels like an event ticket rather than a receipt.
- id: F18
  status: done
  inline_brief: 'SEO and discoverability: per-route metadata, Event/Organization structured data, Open
    Graph and Twitter cards with NOS-branded images, sitemap, canonical URLs.'
  completed_at: '2026-09-07T22:34:24.580750+00:00'
- id: F19
  status: pending
  inline_brief: Social and advertising kit built from the NOS tokens and emblem — fixed-ratio export-ready
    artboards for Instagram and Facebook.
- id: F20
  status: done
  inline_brief: Token grammar hardening — 44-id verifier at execution/checks/verify_nos_m7_hero_and_grammar.ts
    covering the M7 hero/grammar contract. Goldens and contract made coherent, scrim baseline captured
    from a detached worktree at 24f87e05, blocked_when retired. Zero code defects found; type-check and
    build both exit 0.
  completed_at: '2026-09-08T00:00:00.000000+00:00'
- id: F21
  status: done
  inline_brief: Typographic h1 grammar as part of the M7 hero/grammar contract (see F20 verifier). Covered
    by contract-m7.yaml + goldens/m7/.
  completed_at: '2026-09-08T00:00:00.000000+00:00'
- id: F22
  status: done
  inline_brief: Hero composition as part of the M7 hero/grammar contract (see F20 verifier). Covered by
    contract-m7.yaml + goldens/m7/.
  completed_at: '2026-09-08T00:00:00.000000+00:00'
- id: F23
  status: done
  inline_brief: Status colour tokens — six semantic status tokens added at nos-theme.css:192-197 (hex
    8f2834, 714a1e, 1f5c3e, e298a0, d6a164, 8fb89c), four call sites updated. Design-approved by Codi
    (design authority). Covered by contract-m8.yaml + goldens/m8/.
  completed_at: '2026-09-08T00:00:00.000000+00:00'
- id: F24
  status: done
  inline_brief: 'Focus affordance — one scoped :focus-visible reset fixing nine ring-ink/40 sites without
    editing any of them. Headline defect found and fixed during this feature — see docs/nos-design-system.md
    and learned.md ''NOS M7/M8 verification post-mortem'': .nos-on-dark was declared in nos-theme.css
    but applied to no element, leaving contrast at 2.53:1 against a promised 18:1 until a rendered measurement
    caught it. Both evidence artefacts now carry controls that demonstrably fail (2.17:1 and 2.48:1).
    Design-approved by Codi. Covered by contract-m8.yaml + goldens/m8/.'
  completed_at: '2026-09-08T00:00:00.000000+00:00'
- id: F25
  status: pending
  inline_brief: 'R10 hero scrim rework: scrim ends transparent (x=75% column alpha <=0.25 at mid-height,
    petals in own colour), text column may darken to ~0.85 from the left edge and must fall away by the
    midline, vertical layer removed or lightened; legibility >=4.5:1 measured at composited pixel with
    negative control, crop/type moves before alpha climbs; verified by the same grey-swap probe at 390
    and 1280 before and after. Requires Codi review then Brad hero approval before templating across routes.'
- id: F26
  status: pending
  inline_brief: 'Vendor application thank-you panel heading consumes --status-success-on-light with word
    carrier kept; captured triggered at 390 and 1280. Warning, success-elsewhere, and error-on-dark tokens
    stay declared and dormant: never invent surfaces, never synthetic specimens as R8/6 evidence.'
- id: F27
  status: pending
  inline_brief: 'R9 golden: on violet-filled buttons the ring reads only through the outline-offset gap;
    assert the gap never drops below 2px in contract-m8. Still owed: register-form and marketing word-count
    focus captures, pending a dev registration-code path from the SAOC session (gate never disabled).'
milestones:
- id: M1
  status: done
  features:
  - F1
  - F2
  - F3
- id: M2
  status: done
  features:
  - F4
  - F5
  - F6
  - F7
- id: M3
  status: done
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
  status: done
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
- id: M7
  status: done
  features:
  - F20
  - F21
  - F22
- id: M8
  status: done
  features:
  - F23
  - F24
- id: M9
  status: pending
  features:
  - F25
  - F26
  - F27
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

---

## ⚠ DESIGN SUPERSESSION — 2026-09-08, from `saoc-nos-design-54` (design authority)

**This overrides the "Design grammar" section above on three points. Part of what
shipped in PR #1 is now wrong and needs rework.**

The designer had not seen `globals.css` or the rendered site when the original brief
was written; Brad has since granted read access. The earlier rules were taken from the
standalone NOS 2027 design system, which its own readme describes as an event sub-brand
authored with **no product to mirror**. They are correct for that system and wrong for
this site.

### The site already has a coherent language — "Sage & Paper"

`--radius-0: 0` for cards and image wells · `--radius-1: 2px` for buttons and inputs ·
pill radius **only** for eyebrow pills · **cards use borders, not shadow** (the single
shadow token exists only for floating menus) · **JetBrains Mono** for every eyebrow and
meta label at `--mono-tracking` 0.18em.

We built the opposite: 10/16/999 radii, white cards with purple-tinted shadows, and
Jost eyebrows. Applying those produces exactly the "takes over the parent site" outcome
Brad's hard constraint forbids.

### The revised rule: keep the structural grammar, change palette, display face, imagery

**Inherit unchanged from `globals.css`:** `--radius-0` cards, `--radius-1` buttons, pill
for eyebrow pills only; **borders not shadows** on cards; **JetBrains Mono eyebrows** at
`--mono-tracking`; the 8-pt spacing scale; `--section-y: 96px`; `--container-max: 1280px`;
the existing display/body type scales; `--ease` and the 150/250/400ms durations.

**NOS identity enters through three things only:**

1. **Palette, mapped onto the existing semantic names.**
   `--bg` `#f4f3ec` → pale gold `#F3F2D6` (close cousins, a subtle warm shift) ·
   **`--bg-dark` `#384138` → royal purple `#211A57` — the signature move, carries most of
   the identity** · `--accent` brass `#9e8c6b` → olive `#7F7D33` · `--link-underline` and
   `--focus-ring` → violet `#7E3F97` · `--fg-on-dark` → pale gold.
   **Keep `--ink` for body copy on light; do not tint running text purple.**
2. **Display face:** Crimson Pro → **Cormorant Garamond**, still weight 500, still
   sentence case. Both are high-contrast serifs, so it reads as a change of voice rather
   than a change of system. **Keep JetBrains Mono for eyebrows — do not substitute Jost.**
   Jost is reserved for the logo lockup's location line only, which is where the NOS
   system actually specifies it.
3. **The emblem and the orchid photography.**

### Unchanged from the original brief

Sentence-case Cormorant 400–500 · no gradients or textures · ease-out motion without
bounce · no duotone or filters on photography · semantic status colours excluded from the
override · no uppercase form labels · restraint increasing through the payment flow ·
**do not invent copy**.

### Rework scope against PR #1

The scoped-token seam, the palette mapping, the Cormorant swap, the emblem, the
photography treatment and the measured scrims all **stand**. What needs revisiting is
`components/nos/*` where it introduced 10/16px radii, card shadows, and Jost eyebrows —
those should inherit the site's existing radii, border-not-shadow card treatment, and
mono eyebrows.

The designer's argument for why this is right rather than a compromise: the existing hero
composition — full-bleed dark orchid under a scrim, mono eyebrows stepping down to a very
large serif, a four-column meta row on hairline rules, serif countdown over mono unit
labels — **does not need new radii or shadows to carry NOS.** It needs the ground to go
purple, the serif to become Cormorant, and the mark to be the *Disa*. Change those and it
is unmistakably the National Orchid Show. Change the radii and card treatment as well and
it stops being the same website.


## Codi rulings on the 2026-09-08 evening evidence set (HEAD 24f87e05)

Served at 127.0.0.1:8765 from `.tmp/sandbox/codi-evidence/site/`. R8 error-on-light APPROVED
(four real captures). All synthetic specimens WITHDRAWN as evidence — measured as base ink on the
light chrome, demonstrating nothing; standing rule: a state with no surface has no capture and is
recorded dormant. R9 PASS (62 pairs, outline-only, min 5.71:1) with one new golden (offset gap
>=2px). R10 NEW: measured overlay alpha >=0.76 everywhere and 1.0 across the left half and bottom
third — "a purple plate with a faint photo behind it", fails R4/R5. Rework opened as M9 (F25–F27).
Verbatim rulings text requested from Codi for the mirror at
`.agent/memory/project/design/nos-design-rulings.md`; do not paraphrase rulings into the mirror.
