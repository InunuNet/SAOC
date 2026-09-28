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
| `components/nos/NosHero.tsx` | New `eyebrow2` prop; `display`-branch `<h1>` renders `title` unstyled (a supplied `<picture>`, not typeset text); single R10/R15 scrim replaces the three-layer stack for this branch only |
| `app/(marketing)/national-show/page.tsx` | `HeroLockup()` — art-directed `<picture>` serving the two lockup masters; `brandMark={<EmblemBadge />}` and the typeset `title` string removed; `eyebrow2` passes `Edition {roman}` |
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
  is replaced by one R10/R15 horizontal gradient: near-black `#0B0A14` at the text column,
  fading to transparent by the right edge. The `else` branch's three-layer stack is
  untouched — nothing changes for the eleven heroes that still use it.

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
following text. Mobile: box `min(365px, 104%)` of the column, centred.

Two corrections landed in the follow-up fix commit (`c75b51ca`), both from measurement
rather than from the original spec:

- **`max-w-none` on the `<img>`.** Tailwind Preflight's `img { max-width: 100% }` was
  silently clipping both boxes back to 100% of their column, defeating the deliberately
  oversized placement (mobile 104%, desktop's negative margin). The reference artifact's
  own `.hero-wordmark img` rule carries the same override.
- **`margin-bottom` retuned to `95px` desktop / `48px` mobile**, not the spec's flat
  `58px`/`8px`. The supplied PNGs carry built-in transparent clearspace below the visible
  ink (measured from each file's alpha channel: 19.0% of the horizontal file's height,
  8.9% of the vertical's), so hitting Brad's actual ~58px/~37px ink-to-eyebrow gap needs
  more raw margin than the flat figures assumed. Verified with Playwright
  `getBoundingClientRect` at 1714px/390px: desktop measured 57.8px, mobile 37.5px —
  within the target.

## Known deviation: mobile lockup renders ~339px, not 365px

At 390px viewport width the lockup box renders about **339px** wide, not Brad's spec value
of 365px. The site's mobile gutter is 32px; the adjuster Brad used to set the placement
assumed a 20px gutter. The box is still centred correctly — only the absolute width is off
from spec, by the gutter difference. This is flagged, not fixed, pending Brad/Codi
sign-off on whether 339px at a 32px gutter is acceptable or needs a formula change.

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

## Verification

`.agent/memory/project/specs/nos-hero-lockup/contract-f1.yaml` — 22/22 assertions passing,
covering R22 byte-identity (A1/A2), the lockup replacing `EmblemBadge` as the hero `<h1>`
(A3–A6), and the masthead's exact-route scoping (A7–A10) among others. Goldens
(`hero-structure.md`, `placement-spec.md`, `visual-checklist.md`, and the reference
artifact HTML) are at
`.agent/memory/project/specs/nos-hero-lockup/goldens/`.
