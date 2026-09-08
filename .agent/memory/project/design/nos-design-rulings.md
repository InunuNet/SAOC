# NOS 2027 — Design Rulings (mirror)

**Canonical copy:** `.agent/memory/project/design/nos-design-rulings.md` in the
`~/ai/SAOC NOS Design` workspace. Source of record: Codi, design authority.
This file is a read-only mirror kept so contracts written in this repo can cite a
ruling. Do not edit it here — request the change from Codi and replace this file
with the text sent back.

Authoritative record of design decisions for the NOS subsection of saoc.co.za.
A ruling here is settled — it is not re-derived by an architect or improvised by a
dev. New questions escalate to Codi; they do not get resolved at the keyboard.

Sources of truth: the Claude Design project `262aba20-788b-4930-b724-255600ffd9d3`
(`readme.md` is the grammar, `tokens/*.css` are only the vocabulary,
`guidelines/*.html` are binding), and the live site language in
`app/globals.css`.

## R1 — NOS keeps SAOC's structural grammar; only its identity changes

NOS 2027 and the SAOC site are two different design languages. NOS is a
*subsection*, not its own site, so the structure stays SAOC's and the identity
shifts.

Inherited from SAOC, unchanged: radius 0 on cards, `--radius-1: 2px` on buttons,
elevation expressed as borders rather than shadows, JetBrains Mono eyebrows, the
8pt spacing rhythm.

Changed for NOS: palette (sage → royal purple, parchment → pale gold, brass →
olive/violet), display face (Crimson Pro → Cormorant Garamond), the emblem, and the
photography treatment.

Why: a NOS section carrying its own radii and shadow language reads as bolted onto
the site rather than part of it. Identity travels in colour, type and imagery;
structure is the site's.

Correction on record: Codi once relayed the NOS radii/shadow/Jost rules to the
build session as universal. That was wrong and was retracted — those belong to the
standalone NOS brand system, not to the NOS subsection of saoc.co.za.

## R2 — Pill radius is reserved for eyebrow pills

Buttons are 2px. A full pill on a hero CTA contradicts `--radius-1` and reads as a
different system. Pill radius earns its place on eyebrow pills and nowhere else.

Corollary: primary actions are buttons. An action demoted to an underlined text
link has left the hierarchy — "Register interest" is the exhibitor conversion and
must never decay into body copy.

Corollary: changing a button from pill to rectangle moves the focus ring relative
to the label. Re-measure the ring; a ring that cleared a pill can foul a tight
corner.

## R3 — The page states its name in type; the emblem is a mark, not a headline

The `<h1>` is the typographic headline. The emblem sits above it as a modest mark.
Emblem-only is the badge variant — for avatars and favicons, not for signing a
page. The full lockup (emblem above wordmark) belongs in header and footer, where a
signature is what's wanted.

Why: the headline does the compositional work. Remove it and the hero is a small
mark floating in a hole, with the photograph's strongest region backing nothing.

## R4 — Compositional collisions are fixed by the crop, never by the scrim

`guidelines/brand-photography.html`: "No filters, vignettes, or duotones — the
flower supplies the colour." A scrim deepened across one region to hide a collision
is a vignette solving a layout problem. The scrim has exactly one job — a subtle
dark-to-transparent gradient for text legibility — and does not acquire a second.

How the hero collision is resolved:
1. Focal point shifts right; the left third resolves to the naturally dark,
   out-of-focus ground already present in the frame.
2. Declared via `object-position` off the real bloom centre — not a hardcoded crop
   — so the composition holds across viewport aspects, not only at 1280.
3. At 390 the bloom stacks below the type block, full-bleed, never behind it.
4. Emblem and bloom never overlap at any width. This is a golden assertion.

Escalation path: if contrast at the composited pixel still fails behind the `<h1>`
after re-cropping, the fix is the type moving to quieter ground or the crop moving
further. Not opacity. It comes back to Codi.

## R5 — Duotone means the mark, never the photographs

The duotone and mono sets are logo reproduction treatments. Photography is
delivered as shot: one specimen, deliberately lit, soft side light, shallow depth of
field, warm saturated petals, generous margin.

## R6 — Transactional surfaces are functionally fixed, not visually frozen

Tickets, vendor and site chrome may take the NOS identity, under six guardrails:

1. Semantic status colours (success / warning / error) are excluded from the
   palette shift — they mean what they mean.
2. Focus rings are re-measured on every re-skinned control, never assumed.
3. Body text on purple is pale gold, not olive — olive fails at body sizes.
4. Form labels are never uppercase; caps tracking is for eyebrows and the wordmark.
5. Restraint scales with transaction risk — the closer to payment, the plainer.
6. Any scrim or overlay must serve legibility, never decoration (see R4).

## R7 — Copy is not invented

The live site already carries the show's own words. Headlines, standfirsts and
section copy come from it or from Brad. Inventing plausible-sounding copy for a real
event is a defect, not a placeholder.

## Verification standard

Design claims are settled by rendered evidence, not by reading source. Contrast is
measured at the composited pixel with a negative control — Tailwind v4 serialises
opacity-modified colours as `oklab()`, so regex-parsing `getComputedStyle()` returns
plausible, wrong numbers (filed as InunuNet/SAOC#3). Captures at 390 and 1280
minimum, before and after.

## Approval sequence

Design locally → Codi reviews the rendered evidence → Brad approves it looks
beautiful → only then does anything go to the main SAOC repo. Nothing rolls across
the remaining routes until Brad has approved the hero it is templated from.
