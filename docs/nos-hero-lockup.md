# NOS hero lockup (nos-hero-lockup F1)

The `/national-show` hero's `<h1>` is the supplied NOS-2027 lockup artwork — not typeset
text, and not the hand-composed emblem-plus-wordmark that shipped before it. This is the
one hero on the site built this way; the other eleven `NosHero` call sites are unaffected.

## Why: the R12 decision and the rulings behind it

Brad's original complaints about the live page — *"the emblem's too small"*, *"it's not
balanced"*, *"conflicting with a SAOC logo that's horizontally set"* — turned out to trace
to one cause: `components/nos/EmblemBadge.tsx` (the `disa-graminifolia-emblem.svg`) was
being composed with a text wordmark into a hand-built lockup, in both the masthead band
above the hero and the footer colophon. **R23** names this directly: *"the pages are
building a lockup out of an emblem and type. They must not."* **R14/4** already forbade it
from the type side — *"the artwork is never re-typeset... pick a colourway, do not build a
lockup."*

**R12, decided by Brad on 2026-09-28**, resolved where the real supplied lockup goes: *"the
lockup goes top-left of the hero, not floating above it."* The masthead band on
`/national-show` — the R23 hand-built composition floating as a second strip under SAOC's
own header — is retired. The supplied transparent PNG lockup moves inside the hero instead,
as the `<h1>`. Brad also ruled the same day that no "NATIONAL SHOW" eyebrow runs under the
lockup, since the lockup artwork already reads NATIONAL ORCHID SHOW and a second line
would repeat the name.

**R22** governs how the artwork itself is handled once it's in the hero: *"place the
supplied file, nothing else happens to it."* No resize, re-save, re-typeset, tint, or
crop — see [Lockup files are masters](#lockup-files-are-masters-r22) below.

**R15** governs the hero's ground for this display headline: the scrim ramps in near-black
`#0B0A14`, not purple, so the photograph's veining reads true instead of washing to mud —
see [The single-gradient scrim](#the-single-gradient-scrim).

## What changed

| File | Change |
|---|---|
| `app/(marketing)/national-show/layout.tsx` | Inline masthead `<header>` replaced by `<NosMasthead />`; loads Fraunces/Karla additively |
| `components/nos/NosMasthead.tsx` | New. Client component, route-scopes the masthead band off `/national-show` only |
| `components/nos/NosHero.tsx` | New `eyebrow2` prop; `display`-branch `<h1>` renders `title` unstyled (a supplied `<picture>`, not typeset text); single R10/R15 scrim (desktop) plus a flat mobile scrim replace the three-layer stack for this branch only; photo box is `absolute inset-0` at every width (no more mobile in-flow stacking); copy column capped `max-w-[720px]` |
| `app/(marketing)/national-show/page.tsx` | `HeroLockup()` — art-directed `<picture>` serving the two lockup masters; `brandMark={<EmblemBadge />}` and the typeset `title` string removed; `eyebrow2` passes `Edition {roman}`; hero photo is `orchid-dark.jpg` at `68% 50%`; meta `dl` is 2×2; `data-nos-hero-text`/`data-nos-hero-button` hooks added |
| `components/show/ShowCountdown.tsx` | `data-nos-hero-text` hooks added to the countdown's digits, unit labels, and "dates to be confirmed" state, for the contrast script below |
| `scripts/checks/nos-hero-contrast.mjs` | New. Gated legibility check — see [Gated legibility check](#gated-legibility-check-scriptschecksnos-hero-contrastmjs) below |
| `public/images/nos/lockup/*.png` | New. Served copies of the two lockup masters (see below) |

## NosMasthead: route-scoped, not removed sitewide

`components/nos/NosMasthead.tsx` is a `'use client'` component that reads `usePathname()`
and renders nothing when the path is exactly `/national-show`. Every other route under
`app/(marketing)/national-show/layout.tsx` — about, archive, conferences, exhibitors, faq,
tickets, and the rest of the eighteen NOS sub-pages — still gets the masthead band,
unchanged. The match is exact, not a prefix: a prefix match would also hide the band on
every nested route, which is the eighteen routes this component exists to keep it on.

`layout.tsx` renders `<NosMasthead />` in place of the old inline `<header>` and touches
nothing else — the footer colophon (`data-nos-colophon`) still renders on every route,
including `/national-show`; only the masthead *band* is scoped off, per R12's instruction
to retire the header-adjacent lockup, not the footer one.

## NosHero: the `eyebrow2` prop and the display-branch scrim

`NosHero.tsx`'s existing `isDisplayTitle` branch (`titleSize="display"`) is the only call
site this feature touches — the other eleven heroes render through the `else` branch,
unchanged.

Two additions, both gated to that branch:

- **`eyebrow2?: ReactNode`** — rendered between `title` and `lede`, display branch only.
  Optional and additive; none of the other eleven `NosHero` call sites pass it. On
  `/national-show` it carries `Edition {roman}` (e.g. "Edition XIX"), the small mono-caps
  line from the reference artifact's `.hero-eyebrow-2`. This is *not* the "NATIONAL SHOW"
  eyebrow R12 ruled out — that one repeated the lockup's own wordmark; this one states the
  edition number, which the artwork doesn't carry.
- **The single-gradient scrim.** For `isDisplayTitle`, the three-layer scrim stack (bottom-up
  purple wash, left-right fade, conditional top-down band) used by the other eleven heroes
  is replaced by one R10/R15 horizontal gradient at desktop widths: near-black `#0B0A14` at
  the text column, fading to transparent by the right edge. The `else` branch's three-layer
  stack is untouched — nothing changes for the eleven heroes that still use it. (Mobile gets
  its own flat variant of this scrim — see
  [Photo, background, and scrim](#photo-background-and-scrim-amendment-2026-09-29--2026-09-29b)
  below.)

`<h1>{title}</h1>` in the display branch carries no type-scale classes: `title` is now a
`<picture>` element (`HeroLockup()`, in `page.tsx`) with its own sizing, not a string
NosHero would set `font-serif`/`--display-xl` on. `brandMark` is not rendered at all in the
display branch — the mark is already in the lockup artwork, so the `brandMark` slot (used
by the other heroes for `<EmblemBadge />`) has nothing to add here.

## Fraunces and Karla: additive, not a replacement

`layout.tsx` now loads `Fraunces` and `Karla` from `next/font/google` alongside the
existing `Cormorant_Garamond` and `Jost` — additively. Per **R14**, Cormorant and Jost stay
reserved to the wordmark artwork and the other eighteen routes' existing type; this feature
ships no new Cormorant or Jost usage. Karla (R14's body face) is applied inside the
flagship hero only — the eyebrow and the meta grid's `<dt>`/`<dd>` labels on
`/national-show` now read `font-[family-name:var(--font-nos-karla)]` instead of the shared
`font-sans` alias. Fraunces (R14's display face) loads here because `layout.tsx` is where
R14's eventual sitewide font decision will land, but no Fraunces text ships in this
feature — the one display headline this hero carried is now the lockup image, not typeset
text.

## Lockup files are masters (R22)

`public/images/nos/lockup/NOS-2027-logo-full-colour-reversed-{horizontal,vertical}.png`
are served **byte-identical** to
`branding/National Show 2027/Logo/NOS-2027-logo-full-colour-reversed-*.png` — the contract
gate's A1/A2 assertions `cmp -s` the two paths on every run. Per R22, these files are never
re-saved, resized, re-encoded, tinted, or cropped; the only thing that happens to them is
the browser's own `next/image`-style delivery-time resizing (R22/7 — delivery, not
editing). If a placement ever needs a different size or colourway, the fix is choosing a
different supplied file (there are sixteen), never editing one of these two.

An art-directed `<picture>` (`HeroLockup()` in `page.tsx`) serves the vertical master below
620px and the horizontal master above it via a native `<source>`/`<img>` pair, so exactly
one `<img>` exists in the rendered DOM at any width — one accessible name
(`National Orchid Show, Western Cape 2027`), no screen-reader duplication.

## Placement numbers

Brad set the desktop placement directly in the design adjuster (`placements/hero`,
2026-09-28T16:33Z, 1714px frame / 1216px column): image box width `min(1140px, 93.75%)`,
`-32px` margin-left (so the box's left edge lands flush with the section's outer edge,
past the column's own padding), `46px` from the column's top, `58px` clear above the
following text.

The first build (`c75b51ca`) hit that 58px/37px clear by inflating `margin-bottom` itself
(`95px` desktop / `48px` mobile) to absorb the PNGs' built-in transparent clearspace below
the visible ink. Codi's 2026-09-29 amendment (`bce627a2`) replaced that with the exact
figure instead of a tuned guess:

- **Desktop:** the lockup box sits `5px` above "The Flagship" — `NosHero` now keeps the
  display `<h1>` outside its flex `gap`, so `mb-[5px]` on the `<img>` is the *whole* gap.
  The rendered box is 1140px wide, so its height is `1140 × 1008/4108 ≈ 279.7px`; the
  horizontal file's own transparent clearspace is `192/1008` of that, `≈53.3px`. `5px +
  53.3px ≈ 58px` visible ink-to-text clearance — matching R12's target exactly, not by
  tuning.
- **Mobile:** `margin-bottom: 8px` is the whole box-to-eyebrow gap. At a 365px-wide box the
  rendered height is `365 × 2876/3272 ≈ 321px`; the vertical file's clearspace is `256/2876`
  of that, `≈28.6px`. `8px + 28.6px ≈ 37px` visible — matching the mobile target.
- **`max-w-none`** on the `<img>` is unchanged from the first build: it still overrides
  Tailwind Preflight's `img { max-width: 100% }`, which otherwise clips both boxes back to
  100% of their column.

**Mobile box width, corrected.** The box is now `width: min(365px, 100vw - 25px)`, centred
with `margin-left: calc(50% - <rendered-width>/2)` **relative to the viewport**, not the
padded column — the hero copy stays left-aligned on the 32px gutter, but the lockup image
breaks out of it. This replaced the original `min(365px, 104%)`-of-column formula and
**resolves the 339px-vs-365px deviation the first build shipped with**: at exactly 390px of
viewport width, `100vw - 25px = 365px`, so `min(365px, 365px) = 365px` — Brad's spec value,
exactly, independent of the site's 32px gutter.

Codi's first pass at this amendment also targeted an ink-to-viewport-edge gap of ~18px;
**Ruling 1 (2026-09-29) withdrew that target as an arithmetic error** (it treated the image
box's edge as the ink's edge) and confirmed the 365px box with the resulting **38–40px** ink
inset as correct, matching Brad's own adjuster setting — no further code change was needed.

**CLS.** The mobile `<source>` now carries its own intrinsic `width={3272} height={2876}`
(the vertical file's native size) alongside the desktop `<img>`'s existing `4108×1008`, so
below 620px the browser reserves the vertical file's aspect ratio instead of the fallback
`<img>`'s horizontal one — approved by Codi as item 7 of the same amendment.

**Header-clip finding — no code change.** Codi's first review flagged the dorsal sepal
(the flower's top petal) as clipped under the site header in the `hero-390.png` capture and
asked for the lockup box to start below the header's bottom edge. Investigation found the
clipping was an artifact of how that screenshot was captured (a sticky header intercepting
the capture viewport), not a real rendering defect — the hero's existing `pt-[3px]` at
`≤620px` (unchanged since the original build) was already correct once the photo/scrim
fix below made the mobile hero a normal in-flow section again. Recorded so the finding
isn't re-investigated as a live bug.

## Photo, background, and scrim (Amendment 2026-09-29 / 2026-09-29b)

Codi identified that the reference artifact's own hero photograph is `orchid-dark.jpg`
downscaled (pixel diff 0 against `public/images/orchid-dark.jpg` resized to the artifact's
1400px width) — not a new asset, and not the `orchid-violet.jpg` + measured 51%/37%
bloom-centroid crop the first build shipped. The hero photo is now `orchid-dark.jpg` at
`object-position: 68% 50%`, Codi's value verbatim, at every viewport width.

**Full-bleed at every width, not just desktop.** The original build stacked the photo
in-flow below the type on mobile (its own 3:2 box, roughly a 260px band) because a display
headline plus lede/actions is tall enough to leave the overlay photo as a sliver of
scrimmed texture behind a full-height text column. Codi's amendment retires that: the photo
is now `absolute inset-0` — full-bleed, behind all hero content — at every breakpoint, with
no `isDisplayTitle`-specific stacking. `NosHero.tsx`'s section wrapper and photo box no
longer branch on `isDisplayTitle` for layout at all.

**Mobile gets its own scrim clause (new R15 mobile clause, legibility Amendment
2026-09-29b).** With the copy running full-width on mobile, the R10/R15 horizontal ramp's
lighter end (meant for the desktop bloom, at the right of a 1216px column) sat directly
under mobile text. Desktop keeps the existing five-stop horizontal gradient unchanged, now
gated `max-[620px]:hidden`. At `≤620px` a second, mutually exclusive layer renders instead:
a single flat `rgba(11,10,20,0.82)` tint over the whole hero — no gradient — gated `hidden
max-[620px]:block`. The photo stays `orchid-dark.jpg` at `68% 50%` underneath it either way.

## Desktop legibility: the 720px copy cap (Amendment 2026-09-29b)

Codi's second review found the underlying fault was layout width, not scrim colour: the
hero's copy column (eyebrow, eyebrow2, lede, the 4-fact meta list, the confirmation badge,
the three buttons, "Opens in" and the countdown) ran the full 1216px content column, well
past the point where the R10 ramp is dark enough — venue and cycle text measured
2.0–4.1:1 at the ramp's lighter end at 1280/1714.

The fix caps that whole block at `max-width: 720px` — the reference mock's own
`.hero-copy` value — inside the `isDisplayTitle` branch, independent of the lockup image's
own 1140px box above it. Two follow-on adjustments landed once the cap was gated by the
contrast script below:

- **The meta `dl` is 2×2 at every width**, not the earlier responsive `grid-cols-2
  sm:grid-cols-4` — 4 columns inside a 720px cap still failed for the venue/cycle cells.
- **`dt` reads `text-ivory/90`**, not `text-ivory/55` — the same token `eyebrow2` already
  used, not a new value (`be1bb68d`).
- **The display-branch lede is capped at `34ch`**, not `58ch` — narrow enough to clear
  4.5:1 on every rendered line at 1280 and 1714, so no further step-down to 30ch was
  needed (`be1bb68d`).

Button borders are unaffected: the existing 3:1 non-text contrast floor for the three
hero buttons' edges was already correct and Codi's ruling kept it as-is.

## Gated legibility check: `scripts/checks/nos-hero-contrast.mjs`

Legibility is no longer eyeballed against a screenshot — `scripts/checks/nos-hero-contrast.mjs`
samples the real composited pixels behind every hero text element and every button edge and
fails on the worst case, per Codi's ruling ("sample the composited pixels... report
worst-case contrast ratio per element"):

- **Method:** each `[data-nos-hero-text]` element's CSS colour (and each
  `[data-nos-hero-button]`'s edge colour) is resolved via a 1×1 canvas fill, the text is
  made transparent in place, the hero is screenshotted at three viewports (1280, 1714,
  390), and each element's colour is alpha-composited against every background pixel in its
  box — the minimum ratio in that box is the element's score.
- **Floors:** text `4.5:1`, button edges `3:1` (WCAG 1.4.11; a filled button's edge is its
  own fill).
- **Usage:** `node scripts/checks/nos-hero-contrast.mjs`, reading
  `NOS_HERO_CONTRAST_URL` (default `http://localhost:3002/national-show`). It assumes a
  server is already running and never spawns one — an unreachable server is a **failure**
  (it prints `SKIP-AS-FAIL` and exits 1), never a silent pass.
- **Extending it:** any new hero text element must carry a `data-nos-hero-text="<label>"`
  hook (a short kebab identifier used only in the script's own report table) or the script
  cannot see it and cannot fail it. This is additive inside the `isDisplayTitle` branch
  only — the other eleven heroes carry no such hooks and are untouched.

The contract gate is now 30/30 assertions (up from 22), including this script's own run.

## Out of scope

This feature is hero-only, by Brad's explicit instruction. Not touched:

- **The footer colophon** still renders the R23 hand-composed lockup (emblem + text). A
  follow-up feature is expected to apply the same R22/R23 fix there.
- **Button/action order** in the hero differs from the reference artifact; not reconciled
  in this pass.
- **Sections below the hero** (about/stats, three-year cycle, show class grid, exhibitor
  timeline, past editions, CTA band — see [docs/b4-national-show.md](b4-national-show.md))
  are unchanged.
- `EmblemBadge.tsx` itself is untouched — it still renders on the other eighteen NOS routes
  via `Logo.tsx`, and remains legitimate for that (avatar/favicon-scale) use per R23.

**Resolved (`c27c351e`): the hero lede has its own copy, separate from the meta
description.** Brad's instruction, verbatim: *"update the intro text so it makes sense and
doesn't repeat the owrding."* The display hero's `lede` prop now reads a dedicated
`HERO_LEDE` constant —

> "South Africa's triennial orchid competition, bringing together growers, judges and
> enthusiasts from all nine provinces."

— reusing only facts already on the page (triennial, growers/judges/enthusiasts, nine
provinces) and dropping the repeats of "National Orchid Show" (already in the lockup
artwork above it) and "flagship" (already in the eyebrow). `PAGE_DESCRIPTION` — the
`<meta name="description">` and JSON-LD value — is **unchanged**, and deliberately keeps
the full show name for SEO; only the on-page hero lede changed. Layout is unaffected: the
`34ch` cap from the legibility pass above still applies, and the new copy's worst-case
measured contrast is `7.77:1`, well clear of the `4.5:1` floor. Gate 30/30.

## Verification

`.agent/memory/project/specs/nos-hero-lockup/contract-f1.yaml` — 30/30 assertions passing
(up from the original 22, after two amendment rounds added coverage for the photo/placement
retune and the legibility pass), covering R22 byte-identity (A1/A2), the lockup replacing
`EmblemBadge` as the hero `<h1>` (A3–A6), the masthead's exact-route scoping (A7–A10), and
`scripts/checks/nos-hero-contrast.mjs`'s gated run among others. Goldens (`hero-structure.md`,
`placement-spec.md`, `visual-checklist.md`, and the reference artifact HTML) are at
`.agent/memory/project/specs/nos-hero-lockup/goldens/`, including the "Amendment
2026-09-29" and "Amendment 2026-09-29b" sections added after Codi's (saoc-nos-design-f1)
two rounds of review on top of the original build.
