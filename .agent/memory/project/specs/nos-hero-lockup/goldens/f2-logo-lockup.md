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

## Sizing — SUPERSEDED 2026-09-29 (Codi F2 review)

**The R21/8-derived 96px/120px sizing below this note is dead.** Codi
reviewed the built masthead and colophon and found both illegible: "At 1280
'WESTERN CAPE · 2027' is ~3px tall (illegible); masthead ~180px wide. Files
correct; size wrong." The files and colourway selection above are unaffected
— only the rendered dimensions change. The original 96px/120px section is
kept immediately below, struck by this note, for the audit trail of what
shipped first and why it was wrong (R21/8's table was legibility data for
the artwork *in general*; it was never a substitute for measuring the
lockup's own smallest legible sub-element, the location line, which is what
actually failed).

## Sizing (current, Codi F2 review, 2026-09-29)

**New rule, replacing R21/8's table for this placement specifically:**
Codi measured the location line ("WESTERN CAPE · 2027") directly against
the supplied files — not the whole lockup's legibility, the smallest text
element inside it, which is the part that was failing:
- horizontal file: location band is 67 of 4108px of the file's width →
  needs **≥440px rendered width** for a ≥7px cap height.
- vertical file: location band is 67 of 2876px of the file's height →
  needs **≥300px rendered height** (≈340px rendered width at the file's
  native ratio) for the same ≥7px floor.

**Both placements now take the same sizing rule** (masthead and colophon
differ only by colourway via the existing `tone` prop, which already
resolves correctly — see "File + colourway selection" above; nothing in
that table changes):

- **≥620px viewport: horizontal file at 440px wide** (`height: auto`,
  native ratio 4108:1008 ⇒ ≈108px tall).
- **<620px viewport: vertical file at `min(340px, 100vw - 2×gutter)`**
  (`height: auto`). 620px is not a new breakpoint invented for this — it is
  the same mobile threshold F1's hero lockup already switches on
  (`page.tsx`'s `<source media="(max-width: 620px)">`, `NosHero.tsx`'s
  `max-[620px]:` classes); reusing it keeps one mobile boundary for the
  whole route instead of a second, unexplained one.

**Gutter has no CSS variable to reference** (confirmed: no `--gutter` custom
property exists anywhere in this repo). Both containers this lockup renders
inside use the identical literal instead — `NosMasthead.tsx`'s `<div
className="mx-auto max-w-[1280px] px-8 py-6">` and `layout.tsx`'s colophon
`<div className="mx-auto max-w-[1280px] px-8 py-12">` both pad `px-8` (32px)
each side. 2×gutter is therefore the literal **64px**, taken from the two
actual containers the mark sits inside, not invented independently of them.
If a future change ever gives either container its own distinct padding,
this 64px stops being derived and must be revisited — it is not meant to
outlive the assumption that both containers match.

**Clear space (Codi F2 review: "≥ 1/4 emblem width... left-aligned as
now").** Left alignment is unchanged, needs no code change, and no
assertion. Clear-space width is **not independently gated in this
contract** — R21/8's own method note applies here too ("measured directly...
not read off catalogued values"), and no ruling records the emblem's own
width as a fraction of either supplied file's total width (the 67/4108 and
67/2876 figures above are the *location line*, a different sub-element).
Verifying "1/4 emblem width" precisely would require measuring that
sub-region directly, which no existing evidence plate does. Per no-invention,
this is flagged rather than guessed at: dev implements the two rendered
sizes above (which are exact and sourced), and Codi's own closing
instruction — "Resend colophon + masthead screenshots at 1280 and 390
after" — is the verification step for clear space, the same way it already
is for legibility. If the screenshot shows either mark crowded against the
container edge or an adjacent element, that is a follow-up ruling, not a
silent judgment call made here.

**File coverage — checked, nothing new to copy.** All four files this
sizing rule needs already exist byte-identical in
`public/images/nos/lockup/` — two from this feature's own masthead work
(`NOS-2027-logo-full-colour-vertical.png`,
`NOS-2027-logo-full-colour-horizontal.png`) and two reused from F1's hero
(`NOS-2027-logo-full-colour-reversed-vertical.png`,
`NOS-2027-logo-full-colour-reversed-horizontal.png` — F1's hero already
uses the reversed-horizontal file as its own desktop lockup, contract-f1.yaml
A1). The directory still holds exactly these 4 files; A9 is unchanged.

Set width/height via CSS/className only, per R22/5 — no `sizes`/`quality`
prop changes beyond what makes `next/image` pick a correctly-dense candidate
for the *actual* rendered box (R22/8: "the 2x candidate must be the one a 2x
display receives" — pass an explicit `sizes` matching each fixed CSS width
so Next's device-size selection isn't guessing from the viewport).

## Sizing (SUPERSEDED — 96px/120px, R21/8 legibility table; kept for the record)

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

**Confirmed against the PDF's other size rule, and it holds — still true, just
moot now that these numbers are superseded.** Codi's answer (rulings-inbox,
"Codi answers") accepted both figures: "The R23 masthead and colophon use the
supplied transparent PNGs, 96px on the masthead and 120px on the colophon.
Accepted, because both clear the committee's 24px minimum emblem height."
That PDF clearance check has no bearing on the new 440px/min(340px…) numbers
above — they clear a 24px floor even more comfortably — so nothing here
needed re-checking against the PDF when the sizing changed.

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
- `NosMasthead.tsx`'s call site — same props, same JSX, same position in the
  tree (`<Logo orientation="responsive" tone="light" />`, unchanged).
- Any font token (see `f2-page-deltas.md` §0) — the old Logo's `font-serif`/
  `font-sans` spans simply disappear along with the composed text; that is a
  side effect of R23, not a font-remap decision.

## Correction, 2026-09-29 (Codi F2 review) — the colophon call site DOES change

Everything above this note assumed a fixed `orientation="vertical"` colophon
that never switched size or orientation. That assumption is gone: Codi's F2
review puts the colophon under the **same** 620px-breakpoint responsive rule
as the masthead (horizontal at ≥620px, vertical below it — see "Sizing"
above), and `Logo.tsx`'s `verticalSrc(tone)`/`horizontalSrc(tone)` helpers
are already tone-aware (they resolve to the `-reversed-` files for
`on-dark` with no extra logic), so the cleanest implementation is for the
colophon to use the **same** `responsive` orientation the masthead already
uses, not a second bespoke mode.

`layout.tsx`'s colophon call site therefore changes from:
```
<Logo orientation="vertical" tone="on-dark" />
```
to:
```
<Logo orientation="responsive" tone="on-dark" />
```
Same position in the tree, same wrapping `<div className="mx-auto
max-w-[1280px] px-8 py-12">` — only the `orientation` prop value changes.
This supersedes this file's earlier "both call sites stay exactly as they
are" instruction for the colophon specifically; the masthead call site is
still unchanged.

The fixed `orientation="vertical"`/`orientation="horizontal"` branches in
`Logo.tsx` keep no call site after this change. **Do not delete them** —
same reasoning as `EmblemBadge.tsx`: they are part of the component's public
API (`NosLogoProps`), a future placement may need a non-responsive fixed
size, and removing a branch nobody currently calls is exactly the kind of
"tidying" that turns into a second, undocumented API change nobody asked
for.
