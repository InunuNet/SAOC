# NOS design system — M1 (F1–F3) decision record

Transcribed from the tree owner's M1 brief (2026-09-07). Nothing here is re-derived —
these are the decisions as given; implement against them and the contract, not against
fresh design research.

## D1 — Scope seam

New `app/(marketing)/national-show/layout.tsx` wraps children in `<div className="nos-theme">`.
A NOS-only stylesheet (`app/(marketing)/national-show/nos-theme.css`) imported by that layout
redeclares the **existing SAOC semantic custom-property names** on `.nos-theme`. Nothing is
renamed, no component is forked. `:root` and `@theme` in `app/globals.css` are never touched —
`@theme` is global and editing it would leak show tokens onto every SAOC page.

This works because `app/globals.css` declares `@theme` as pure indirection
(`--color-parchment: var(--parchment)`) and CSS custom properties resolve at the element that
uses them. Redeclaring `--parchment` (and the rest of the semantic set) on `.nos-theme` re-skins
every descendant — including SAOC-owned `components/vendors/*`, `components/ui/PageHero.tsx`,
`components/tickets/*` — with zero edits to them.

Remap on `.nos-theme` (NOS raw palette declared on the same scope, then assigned through the
semantic layer, mirroring how `globals.css` layers palette into semantics):

| Semantic name | Raw NOS value | Hex |
|---|---|---|
| `--parchment` / `--ivory` | pale ground | `#FBFAF0` |
| `--bone` / `--bg-tint` | pale gold | `#F3F2D6` |
| `--primary` / `--ink` | royal purple | `#211A57` |
| `--primary-800` | deep purple | `#1A1445` |
| `--primary-700` | mid purple | `#33296F` |
| `--primary-100` | pale purple tint | `#ECE8F5` |
| `--accent` | violet (**not olive** — olive fails contrast as a fill) | `#7E3F97` |
| `--accent-soft` | pale violet | `#9A63AE` |
| `--muted` | muted ink | `#6A6780` |
| `--rule` | hairline | `#DAD7C8` |
| `--rule-soft` | fainter hairline | `#E8E6C2` |
| `--serif` | Cormorant Garamond stack | — |
| `--sans` | Jost stack | — |
| `--serif-weight` | `400` | — |

Golden reference: [`goldens/tokens.css`](goldens/tokens.css).

### Empirical verification (mandatory before F1 is called done)

Add a temporary scoped override to a scratch page under `app/(marketing)/national-show/`,
confirm against the dev server at `http://localhost:3002` that a `bg-parchment` (or equivalent
Tailwind utility bound to the semantic token) descendant of `.nos-theme` actually renders the
NOS colour, not the SAOC colour — then **delete the scratch file**. If the override does not
take effect (e.g. Tailwind v4 utility classes resolve `--color-parchment` from `@theme` at
build time rather than redirecting through the runtime custom property), report that plainly
and stop. Do not invent a workaround; escalate to `@architect`/`main` instead.

## D2 — Fonts

Cormorant Garamond + Jost via `next/font/google`, loaded inside the new
`national-show/layout.tsx` and bound to NOS-scoped CSS variables applied on the same
`.nos-theme` element (via each font's `variable:` option). `app/layout.tsx` must **not** be
modified. If binding fonts without touching the root layout turns out to be impossible, say so
explicitly rather than editing it.

## D3 — Logo

Emblem source: `branding/National Show 2027/emblem/Disa graminifolia.svg` — true vector, 1223
paths, no embedded raster. Strip its `<metadata>` C2PA blob before vendoring. Destination:
`public/images/nos/`.

The circular badge logo is **retired** — never use it, never reference it in new code.

Approved identity is **Layout B**: emblem above a single-line `NATIONAL ORCHID SHOW` wordmark
in Cormorant, over a wide-tracked `WESTERN CAPE · 2027` line in Jost at `0.30em` tracking.

## D4 — Components

- **F2 primitives:** `Button` (primary / ghost / on-dark variants), `Badge`, `Card`,
  `SectionHeading`, `Logo`, `EmblemBadge`.
- **F3 composites:** `NosHero` (full-bleed photo + purple scrim), `NosEventCard`, section nav,
  CTA band.

Server Components by default. `'use client'` only where genuinely needed (event handlers,
browser APIs, state), with a comment explaining why.

## D5 — Photography

Only the five already-in-production images in `public/images/`: `orchid-dark.jpg`,
`orchid-pink.jpg`, `orchid-purple.jpg`, `orchid-violet.jpg`, `orchid-yellow.jpg`. Scott
Ormerod's 13 branding-zip photographs are **not rights-cleared** — never ship them.

Photography is the signature device: full-bleed studio orchid on near-black under a
dark-to-transparent royal-purple scrim, text on the dark end. No duotone, filters, or
vignettes. The scrim must be strong enough to hold white-text legibility against the
brightest of the five images (`orchid-yellow.jpg` — the current `/national-show/tickets` hero
scrim is too weak against it and must not be reused as-is).

## D6 — Contrast, measured (golden)

See [`goldens/nos-contrast.golden.md`](goldens/nos-contrast.golden.md) for the full table.
Headline figures, transcribed:

royal purple on pale gold **13.69** · royal purple on white **15.55** · pale gold on royal
purple **13.69** · ink-700 `#3A3654` on gold-100 **10.91** · violet `#7E3F97` on pale gold
**6.07** · violet on white **6.90** · olive-500 `#A7A841` on royal purple **6.16** ·
olive-700 `#6A6829` on gold-100 **5.53** · olive-600 `#7F7D33` on white **4.30 (large only)** ·
olive-500 on white **2.52 (decorative)** · olive-500 on pale gold **2.22 (decorative)**.

**Rule:** olive is a rule/eyebrow/tracked-caps colour. Never body text on light. Never a
button fill.

## Guardrails (encoded as contract assertions)

1. Status colours (error/warning/success) are **not** remapped to brand hues. This project's
   `app/globals.css` `:root` declares none today — nothing to exclude by name, but the NOS
   stylesheet must never introduce any (`F1-08`).
2. Focus ring must hold 3:1 on every ground. `rgba(154,99,174,.45)` fails on pale gold — use
   solid `#7E3F97` there. Never thin the ring.
3. No uppercase form labels — `text-transform` on labels is banned, deliberately, for
   readability (`F2-02`).
4. Transaction surfaces get the most conventional, highest-contrast treatment: royal purple on
   light, or pale gold on royal purple. Never pale gold on white, never olive as a fill.
5. Headlines are sentence-case Cormorant 400–500. Tracked caps only for the wordmark and Jost
   eyebrows.
6. Radii: 10px cards / 16px large surfaces / 999px pills. Borders: 1.5px primary / 1px
   hairline. Shadows: purple-tinted, never black.

## Hard rules from the tree owner

- **No fabricated content.** Never invent a person's name, meeting time, venue, address,
  phone, or email. Missing content is omitted or written as credible filler marked
  `data-placeholder` (`X-01`, `X-02`).
- **JSX whitespace bug class is live in this repo.** An inline close tag ending a source line
  drops the following space (`<span>x.</span> These` renders as `x.These`). Not detectable by
  reading source. Any assertion about rendered copy must check served HTML, never the file
  (`X-03`).

## Cross-references

- Mission: `.agent/memory/project/missions/2026-09-06-nos-design-system.md`
- Research: `.agent/memory/scratch/research-nos-design.md`
- Contract: `contract.yaml` (this directory)
- Contrast table: `goldens/nos-contrast.golden.md`
- Token golden: `goldens/tokens.css`
