# F2 — R23: place the supplied lockup, stop building one

Ruling: `.agent/memory/project/design/nos-design-rulings.md` R23 ("The pages are
building a lockup out of an emblem and type. They must not."), R22 ("Place the
supplied file. That is the whole instruction."), R21/8 (rendered-width legibility
table), R20 (file source of truth). Codi's delta batch item 2 names this
component and this ruling directly.

## What exists today

`components/nos/Logo.tsx` composes `EmblemBadge` (the vendored
`disa-graminifolia-emblem.svg`) with two hand-typeset `<span>`s ("National Orchid
Show" / "Western Cape · 2027", in `font-serif`/`font-sans`) into a lockup, in
three `orientation` modes. It has exactly two call sites, both untouched by this
feature:
- `components/nos/NosMasthead.tsx:42` — `<Logo orientation="responsive" tone="light" />`,
  inside a `<Link href="/national-show">`, on a `bg-parchment` (`--parchment: #fbfaf0`)
  ground. Renders on every route this layout owns **except** `/national-show`
  itself (F1's route-scoped masthead retirement).
- `app/(marketing)/national-show/layout.tsx:86` — `<Logo orientation="vertical"
  tone="on-dark" />`, inside the colophon `<footer>`, on a `bg-[var(--night)]`
  (`--night: #0e0b24`) ground. Renders on **every** route this layout owns,
  including `/national-show`.

`EmblemBadge.tsx` has no other call site anywhere in the repo today. R23's own
closing paragraph keeps it anyway — "legitimate as exactly what its name says...
for avatars and favicons" — so **do not delete `EmblemBadge.tsx`.** It becomes
temporarily unused by this change, which is expected, not dead code to clean up.

## What changes

Rewrite `Logo.tsx`'s render body only. **The public `NosLogoProps` API
(`tone`, `orientation`, `className`) and both call sites stay exactly as they
are** — `tone` already distinguishes light/dark ground (maps to colourway
below) and `orientation` already distinguishes vertical/horizontal/responsive
(maps to file orientation below). No caller needs to change.

Stop composing `EmblemBadge` + text. Start placing a supplied file from
`branding/National Show 2027/Logo/` (R20's sole source), copied
byte-identical into `public/images/nos/lockup/` (R22 — reference the supplied
file, do nothing else to it), rendered through `next/image` so Next's
optimiser handles resize/re-encode at delivery (R22/7-8 — the repo copy stays
byte-identical to the master; the *served* bytes are the optimiser's business,
exactly as F1's hero lockup already does via `getImageProps`).

## File + colourway selection, by ground

R22/5's table only directly clears one ground exactly (`#0B0A14`, the F1 hero's
near-black scrim, "a one-value difference, imperceptible" from
`reversed-white-vertical.jpg`'s baked `#0B0914`). Neither of this feature's two
grounds is that value, so neither gets that JPG optimisation without a fresh
pixel check — safer and equally R22-compliant to use the **transparent PNG**
both places, which composites correctly against any ground by construction
(R20) and needs no colour-match judgement call at all:

| placement | ground | value | colourway | orientation | files (branding master → public copy) |
|---|---|---|---|---|---|
| masthead | `--parchment` | `#fbfaf0` | `full-colour` (R21/8 cleared this colourway on SAOC's parchment `#f4f3ec`, one value off, same reasoning as R22/5's "imperceptible" call) | vertical (< `xl`) + horizontal (`>= xl`, matching the existing `responsive` breakpoint) | `NOS-2027-logo-full-colour-vertical.png`, `NOS-2027-logo-full-colour-horizontal.png` — **new copies**, not yet in `public/images/nos/lockup/` |
| colophon | `--night` | `#0e0b24` | `full-colour-reversed` (same family F1's hero already uses on its near-black scrim; reversed colourways are the dark-ground family per R14/4's own ordering) | vertical (matches the existing `orientation="vertical"` call) | `NOS-2027-logo-full-colour-reversed-vertical.png` — **already in `public/images/nos/lockup/`** from F1; reuse it, do not re-copy |

Do not use `reversed-gold`/`reversed-white`/any JPG for either placement without
a fresh pixel measurement against `#fbfaf0`/`#0e0b24` specifically — R21/8's own
method note is explicit that colour clearance is "measured directly... not read
off catalogued values," and no such measurement exists yet for these two exact
grounds against those files. The PNG route above needs no such measurement.

Copy the two new masthead files byte-identical, exactly as F1 copied the hero's
two files — same mechanism, same directory, no conversion:
```
public/images/nos/lockup/NOS-2027-logo-full-colour-vertical.png
public/images/nos/lockup/NOS-2027-logo-full-colour-horizontal.png
```
`public/images/nos/lockup/` then holds exactly 4 files (2 from F1's hero + these
2 new ones) — no other derivative should appear there.

## Sizing (R22/5: "keep the CSS sizing minimal" — engineering's call, bounded by R21/8)

**Checked against the committee PDF's clear-space rule — not applied.** The
committee-approved `branding/National Show 2027/National Orchid Show 2027
Logo.pdf` (p.8, "Clear space and minimum size") sets clear space on all four
sides to one quarter of the emblem width, "nothing sets inside it." That rule
could in principle bound how tightly the masthead/colophon can pack the
lockup against surrounding chrome. It is **not used here**: Codi's "mobile
lockup geometry stays exactly as built" ruling (`f2-page-deltas.md` §0)
settles that "the 10 Sep Logo folder files supersede the PDF's lockup
geometry" for this project, and applying the PDF's clear-space formula to a
*new* placement would be invoking the exact authority that ruling just
rejected for an existing one. Sizing below comes from R21/8 instead — a
measurement of those same 10-Sep supplied files' actual legibility, not from
the PDF.

No ruling gives an exact pixel target for a masthead or a footer colophon
specifically — R21/8's table is the only rendered-width legibility precedent
that exists for this artwork, and it explicitly names "compact contexts" (its
64px row) as the use case a masthead/footer band is. Apply that table rather
than inventing a number:

- **Masthead:** vertical orientation rendered at **96px wide** ("sound minimum
  for a real placement," R21/8) below `xl`; horizontal orientation rendered at
  **48px tall** (`width: auto`) at `xl` and up — chosen so its footprint stays
  close to the masthead band's previous visual height rather than growing the
  header. Width follows the horizontal master's native ratio (4108:1008,
  ≈4.08:1) at that height (~196px).
- **Colophon:** vertical orientation rendered at **120px wide** ("clean
  throughout — general use," R21/8) — the footer has more headroom than the
  masthead, so it gets the more generous end of the same table rather than the
  compact-context minimum.

**Confirmed against the PDF's other size rule, and it holds.** Codi's answer
(rulings-inbox, "Codi answers") accepts both figures explicitly: "The R23
masthead and colophon use the supplied transparent PNGs, 96px on the
masthead and 120px on the colophon. Accepted, because both clear the
committee's 24px minimum emblem height." The PDF (p.8, "Clear space and
minimum size") sets a 24px on-screen floor for emblem height; 96px and
120px both clear it by a wide margin regardless of which dimension of the
vertical lockup is read as "emblem height." This is a confirmation of the
R21/8-derived numbers above, not a new source — the sizing rationale stays
R21/8 as written; the PDF is cited here only because Codi's answer checked
it and it does not conflict.

Set width/height via CSS/className only, per R22/5 — no `sizes`/`quality`
prop changes beyond what makes `next/image` pick a correctly-dense candidate
for the *actual* rendered box (R22/8: "the 2x candidate must be the one a 2x
display receives" — pass an explicit `sizes` matching the fixed CSS width so
Next's device-size selection isn't guessing from the viewport).

## Accessible name

R21/6 and R23 agree: the wordmark is in the artwork, so the artwork carries
the accessible name. Use the exact string F1 already established for the hero
lockup (`page.tsx`'s `HERO_LOCKUP_ALT`), for identity consistency across every
placement of this mark:

```
alt="National Orchid Show, Western Cape 2027"
```

Masthead: this `alt` is also the `<Link href="/national-show">`'s accessible
name (unchanged wrapping). Colophon: the image is not interactive, so `alt` is
descriptive only — do not wrap it in a new link; none is specified anywhere in
this delta batch and adding one is inventing a feature, not placing an asset.

## What must NOT change

- `EmblemBadge.tsx` — untouched, kept for its own legitimate future use (R23).
- `NosMasthead.tsx` and `layout.tsx`'s two `<Logo .../>` call sites — same
  props, same JSX, same position in the tree.
- The `xl` breakpoint the masthead's `responsive` orientation already switches
  on — this feature changes *what* renders at each side of it, not *when* it
  switches.
- Any font token (see `f2-page-deltas.md` §0) — the old Logo's `font-serif`/
  `font-sans` spans simply disappear along with the composed text; that is a
  side effect of R23, not a font-remap decision.
