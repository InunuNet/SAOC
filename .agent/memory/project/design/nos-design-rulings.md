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

## R8 — Status colour is functional; it never joins the palette shift

R6/1 assumed semantic tokens existed to be excluded. They don't, so the guardrail was
unenforceable as written and the FAIL is the right verdict on it. That the collision is
latent makes it worse, not lighter — it shipped unseen across eight routes.

1. **Status colour carries meaning, not identity.** Hue is the signal and the palette shift
   does not reach it. A brand that recolours its own error states has stopped warning anyone.
2. **Declare the tokens in the NOS layer now.** Do not open the SAOC base uninvited — that
   base is not ours, and a token change there is a blast radius this mission has no mandate
   for. File the gap to the SAOC session as a finding with this audit attached. When the base
   declares them, the NOS declarations collapse to overrides and nothing is stranded.
3. **Two tokens per state — on-light and on-dark.** One value cannot clear 4.5:1 on both the
   pale gold ground and the royal purple one. Hold hue constant across the pair and lighten
   for the dark ground, so the state reads as the same state on either surface.
4. **Ink, not signal.** These sit in a botanical, faintly formal system: deep oxblood rather
   than fluorescent red, and the same register for warning and success. Saturated enough to
   mean something, dark enough to belong.
5. **Never colour alone.** A word or an icon carries the state as well, so a drifted hue
   degrades to ugly rather than to silent.
6. **Capture triggered.** Status states are verified in their triggered state at 390 and
   1280, never at rest. A state nobody rendered is a state nobody checked.

Values are proposed against these constraints and approved on a rendered swatch sheet over
both grounds — not asserted from a colour picker.

**Evidence review 2026-09-08 (captures at 127.0.0.1:8765, HEAD 24f87e05):**

- **Error on the pale gold ground — APPROVED.** Real triggered UI on
  `/vendors/apply` (400) and `/vendors/register` (403), 390 and 1280. Oxblood
  heading and rule, word carrier present, body in ink. This is what R8 looks
  like when it is right.
- **Synthetic specimens — WITHDRAWN as evidence, not re-run.** All five painted
  the SAOC base ink `#171917` with no status token applied, and the "dark
  ground" set rendered on the light chrome `#f4f3ec`. They demonstrated
  nothing, and the honest labelling is the only reason this is a note rather
  than a finding. Rule going forward: a synthetic specimen is never R8/6
  evidence. A state with no surface has no capture; it is recorded as dormant.
- **Findings from the audit.** `--status-warning-*` and `--status-success-*`
  have zero consumers; `--status-error-*` has no consumer on a dark ground.
  Ruling: the tokens stay declared and dormant. Do not invent a surface to
  consume them. One exception: the vendor application thank-you panel *is* a
  success state and currently paints plain ink; its heading consumes
  `--status-success-on-light` with the word carrier kept, captured triggered
  at 390 and 1280 when done. Warning and on-dark error stay dormant until a
  real surface exists, and that surface ships with its capture.

## R9 — Focus is a solid outline; opacity is not a contrast instrument

1. **`outline` + `outline-offset`, never `box-shadow`.** The outline follows the border
   radius, is not clipped by an overflow ancestor, survives forced-colors mode, and is
   already what the one NOS control that passes uses. The inner pale gold layer was a spacer
   wearing a focus ring's clothes; `outline-offset` is the honest way to say that.
2. **Full alpha, always.** R4 forbids buying contrast with opacity; this is the same rule
   read from the other end — opacity is not a contrast instrument in either direction. A
   focus ring is a functional state, and functional states are opaque.
3. **Two ring colours, by ground.** Violet `#7E3F97` on pale gold (measures ~6.6:1 against
   `#fbfaf0`); pale gold `#fbfaf0` on royal purple (~16:1 against `#1a1445`). The violet ring
   on a purple ground is ~2.5:1 and is a defect — the single-ring instinct is what produced
   this failure.
4. **3:1 is the floor, not the target.** A ring that lands at 3.1:1 is one ground-colour
   tweak away from failing again.

Every re-skinned control's ring is measured at the composited pixel with a negative control.
Focus is never inspected by reading the stylesheet.

**Evidence review 2026-09-08 — PASS.** 62 control pairs across four routes at
390 and 1280, focused by real keyboard Tab with an unfocused negative control.
Outline only, `box-shadow: none` on all 62. Violet on pale gold, pale gold on
purple. Raster-measured ring-to-ground contrast 5.71:1 at the lowest pair.
One condition attached: on the violet-filled buttons the ring is the same hue
as the fill and reads only through the `outline-offset` gap. That gap never
drops below 2px; it is a golden assertion. Still owed when a dev registration
code path exists: the full register form and the marketing word-count error.
Ask the SAOC session for a dev code; never disable the gate to capture past it.

## R10 — The hero scrim is a gradient with a transparent end, never a plate

The scrim probe (normal composite, flat `#808080` photograph swap, luminance
columns at 25/50/75% width, 1280) measured the overlay at alpha 0.76 or higher
at every sample, and at 1.0 across the entire left half and bottom third. The
photograph survives only in the upper-right quadrant at 10 to 24% strength,
and violet-cast. The hero is not a photograph with a scrim; it is a purple plate
with a faint photograph behind it. That is a duotone by another route, and it
fails R4 (the scrim has one job, legibility) and R5 with the brand photography
guideline (no filters, the flower supplies the colour).

1. **The scrim ends transparent.** From x = 75% outward, mid-height, the
   overlay alpha is 0.25 or lower and the bloom reads as shot: warm petals in
   their own colour, not violet.
2. **The text column may be dark.** Behind the `<h1>` and standfirst, from the
   left edge, alpha may rise to about 0.85 and must fall away by the midline.
   The existing left-to-right layer is the legibility mechanism; the vertical
   layer goes, or becomes light enough that rule 1 holds.
3. **Legibility is measured, then the crop moves.** Headline and standfirst at
   the composited pixel, 4.5:1 or better, with a negative control. If the
   text fails on the quieter scrim, R4 applies: the crop or the type moves.
   Alpha does not climb back.
4. **Verified by the same probe.** Normal plus grey swap plus column profile at
   390 and 1280, before and after. Green when the x = 75% column reads alpha
   at or under 0.25 and the x = 25% column reads 0.75 or over.

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
