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


<!-- R11–R23 mirrored from Codi (NOS design) 2026-09-28 via saoc-nos-design-f1; verbatim -->

## R11 — Unconfirmed copy is disclosed in one anatomy, at two weights

Sixteen of the eighteen pages carry copy the Council has not written. That notice is
on the live site for months and is the first thing many visitors read. It is a trust
artefact: the Council telling people which parts of their own site are not theirs yet.
Calm and matter-of-fact is right. Apologetic is wrong, and *broken* is worse.

The build session's own framing named the real failure: a notice can render first,
pass every DOM assertion, and still read as fine print. Structure is what fixes that,
not colour and not size.

**One anatomy, both states, both levels.** Label chip, then one sentence, then the
surface that scopes the block the notice governs (R19 — was a dashed rail until
2026-09-10).

1. ~~**The rail is the mechanism.**~~ **SUPERSEDED BY R19 (2026-09-10)** — the
   disclosed extent is a surface, not a stripe. This clause is kept as the record of the
   argument R19 preserves; do not build it. Original text: A dashed 2px rail on the leading edge, running the
   whole height of the governed block, scopes the disclosure to its content. The
   reader sees the *extent* of what is unconfirmed, not merely a note above it.
   Dashed, because provisional; a solid rail reads as a pull-quote. This is what
   stops the notice degrading into fine print, and it is the part not to negotiate.
2. **Two states, two inks, one form.** They are the same kind of statement differing
   in degree, so they do not get different structures.
   - `placeholder` → `--status-warning-on-light` / `--status-warning-on-dark`
   - `research` → `--muted` `#6a6780` on light (5.18:1), `--status-muted-on-dark`
     `#a49dbe` on every dark ground. Rail takes the same ink as its own text.
   Both carry their word in the chip, so hue is never doing the work alone.

   **Corrected 2026-09-09.** I first bound `research` to `--ink-soft` and
   `--rule-strong`. Those are furniture in my specimen sheet and are declared in no
   shipped layer — the build session was right to read the rendered declaration over
   my prose and to refuse to bind them. On light the state takes the base's existing
   `--muted`; nothing new. On purple, `#8b84a6` is one new value, declared because
   **a state that only works on one ground is not a token** — the same rule R8/3
   states, and the reason warning and success already ship as pairs. Hue holds at
   ~252° against `--muted`'s ~247°, inside R8's ±15°. `--rule` was correctly rejected
   for the rail: 1.38:1 on parchment is not an indicator, and 11.82:1 on purple is
   loud, which is the opposite of this state's job.

   **Corrected again, same day.** I first set the dark value at `#8b84a6`, validated
   against `--primary-800` alone. The build session applied my own principle one level
   down and was right to: a token checked against one dark ground has the same defect
   as a state that works on one ground. `#8b84a6` measured 4.41 / 4.26 / **3.53** on
   the other three, so it would have failed silently on exactly the surface nobody
   checked. `#a49dbe` clears all four, and — the check that actually matters — stays
   quieter than the placeholder token on every one of them:

   | ground | research `#a49dbe` | placeholder `#d6a164` |
   |---|---|---|
   | `--primary-800` `#1a1445` | 6.62 | 7.43 |
   | `--primary` `#211a57` | 6.03 | 6.77 |
   | `--nos-purple-lift` `#241c5c` | 5.84 | 6.55 |
   | `--primary-700` `#33296f` | 4.83 | 5.42 |

   Hue 252.7° against `--muted`'s 247.2°, a 5.5° delta inside R8's ±15°. **A token is
   validated against every ground its state can reach, not against the one that was
   convenient.** That is the general form, and it is now the rule.
3. **Never the error tokens.** `--status-error-*` says something is broken. Nothing
   is broken. An unwritten page is not a fault.
4. **Page-level sits directly beneath the hero**, full content width, before any
   content block. Not over the hero — that fights R10 and wastes the photograph.
   Not a full-bleed band at the top of the document — that is a cookie bar, and it
   reads as a system error rather than an honest disclosure.
5. **Section-level never goes quieter than: chip at 11px / 0.14em with a 1px border,
   one sentence at body-minus-one, and the rail.** It does not degrade to plain
   italic text. That is the floor, and it is the answer to "how quiet can it get".
6. **Zero state is absence, not an empty slot.** Notice and rail are one component.
   When the flag clears, the padding clears with it. Assertion: a page with every
   flag cleared renders pixel-identical to the same page authored with real copy.
7. **Never dismissible, never animated, never sticky, no shadow, no fill behind the
   body copy, no icon in place of the word, no italicised placeholder prose.** Copy
   living for months must stay as readable as the copy replacing it.

Contrast is met on all four combinations at 4.5:1 or better, measured composited at
390 and 1280.

**On the "visible without scrolling" assertion:** it conflicts with rule 4 at 390 and
should be replaced. Assert instead that the page-level notice is *the first element
after the hero, with no content block preceding it* — DOM-checkable, honest, and it
does not force a disclosure above the show's own headline to satisfy a viewport test.

8. **A notice may render on either ground.** Ruling against the cleaner-sounding
   alternative: the disclosure travels with the copy, so the day a purple band carries
   draft prose the notice must go there too. Forbidding it would force either an
   improvised hex or a layout change to satisfy a gap in the palette. Declared and
   dormant is the R8 pattern, and it is the right one here.
9. **The wording carries the AI disclosure.** Brad's condition is placeholder,
   *AI-generated*, and awaiting Council copy. My worked example dropped the middle
   term; the build session's wording is correct and binding:
   *"This text is an AI-generated placeholder. It has not been written or approved by
   the South African Orchid Council, and it may be inaccurate. Final copy is still to
   be supplied by the Council."* Assertions measure the rendered text, never a fixed
   string — the Council edits it in Sanity.

Rendered on the house-style sheet under "Placeholder copy", both states.

## R12 — The canvas kit's own header does not ship; NOS begins below SAOC's

`ui_kits/event-website/SiteHeader.jsx` is a **standalone-site header**: sticky, pale
gold at 90% with an 8px blur, the full horizontal NOS lockup at a 46px emblem, its own
four-item nav (Programme / Visit / Exhibit / About) and its own "Buy tickets" button.
It is well made and it is out of scope. The kit's own README says so plainly — *"no
event website existed in the source material — this kit applies the supplied brand to
a plausible event site"*. Plausible-standalone is exactly what NOS is not.

R1 settles it: NOS is a subsection of saoc.co.za, so site chrome is SAOC's and
identity begins below it. The main-site lane confirmed the shipped handoff independently
— `src/chrome.jsx:4` is a flat six-item nav (About, Societies, Judging & Awards,
National Show, Events, Learn), header at 18px vertical padding, three zones, logo left /
nav centre / actions right, and **no dropdown or mega menu anywhere in the handoff**.

The ruling:

1. **The canvas `SiteHeader` is retired as a deliverable.** It is not a defect to be
   fixed and not a variant to be reskinned. Nothing in it reaches a NOS route.
2. **No NOS route gets a second nav.** Two navigations stacked is how a subsection
   starts reading as a separate site — the failure R1 exists to prevent.
3. **Purple and Cormorant never enter the SAOC header.** NOS identity starts at the
   first element below it.
4. **Two things in that header are worth keeping, relocated, not deleted.** The
   horizontal lockup treatment (emblem beside wordmark, ~46px emblem) and the standing
   "Buy tickets" primary action are both good calls that simply belong in the page
   rather than the chrome. The action lives in the hero, where the canvas already puts
   one.

**Corollary — what is NOT a second navigation (ruled 2026-09-10, on request).**
`components/show/ShowSectionNav.tsx` is not a R12/2 violation. An in-body cross-link
block, below the chrome, in the content column, styled as page content, is a **content
pattern** — the "more in this section" module every large site needs. R12/2 forbids
*site furniture*: a second header, a second nav bar, a persistent strip competing with
SAOC's chrome. The distinction is not the `<nav>` element or the accessible label,
both of which are correct here; it is whether the thing behaves like chrome.

It also solves a real problem. `/national-show/archive` returned 200 for months with
nothing linking to it, and with no header dropdown approved this block plus the hub are
the only way sixteen NOS pages become reachable by clicking. A design ruling that made
half the section unreachable would be a bad ruling.

Four conditions keep it content rather than furniture, and if it fails any of them it
has become a header and R12/2 applies:

1. **Never sticky, never fixed.** The moment it follows the scroll it is chrome.
2. **Position decides, not width — corrected 2026-09-10.** My original wording ("a band
   running edge to edge reads as a bar regardless of where it sits") was too broad, and
   the main-site lane was right to fail its own component against it and then argue.
   A full-bleed tinted band whose inner content is held to the measure, sitting at the
   **foot** of a page below its primary content, is a section break — a normal and good
   content pattern. The bar-reading risk comes from **proximity to the chrome**, not
   from width. So: full-bleed is permitted at the foot; the same band placed above the
   page's primary content, near the header, is a bar and fails. `bg-bone py-12` with an
   inner `max-w-[1280px] px-8` at the foot of a show page is correct as built.
3. **No emblem and no lockup.** A mark plus links is a header by any other name.
4. **Links set as content, not as nav items.** Uppercase with display tracking is
   eyebrow and wordmark territory; borrowing it here is what would make the block start
   competing with the chrome above it.

Ruled on the description, not on pixels — I have not rendered it and cannot read that
tree. Provisional until I see it at 390 and 1280, per the verification standard.

**Open, and Brad's to decide (he reserved this one).** Where the NOS lockup sits on a
page now that the header cannot carry it. Brad's instruction on 2026-09-09 was that
emblem placement is not straight-cut and comes to him. My recommendation is the hero,
above the `<h1>`, per R3's default — the canvas hero currently has no lockup at all, so
this is an addition to it rather than a move. Not applied until he says so.

**Decided by Brad, 2026-09-28: the lockup goes top-left of the hero, not floating above it.**
The band above the hero on the live tickets page (emblem plus typeset NATIONAL ORCHID SHOW)
is retired: it is the R23 hand-built lockup and it floats as a second strip under SAOC's
header. The supplied transparent PNG lockup sits inside the hero instead, and Brad is
fixing the exact colourway, size and offsets in the adjuster at
https://claude.ai/artifact/SSD4vVapJQE8iaHWoh88Yo, which saves to `placements/hero`.
Those saved values are the ruling once read back; nothing ships to the build side before then.

**Brad, same day: no "NATIONAL SHOW" eyebrow under the lockup.** The lockup already reads
NATIONAL ORCHID SHOW, so an eyebrow saying NATIONAL SHOW beneath it repeats the name. On a
hero that carries the lockup, the eyebrow is dropped and the headline follows the mark directly.

**Placement as saved by Brad (adjuster `placements/hero`, 2026-09-28T16:33Z, desktop frame 1714px,
1216px column):** file `NOS-2027-logo-full-colour-reversed-horizontal.png` (transparent, as
supplied); image box width 1140px (height 280px); image box left edge 32px outside the content
column's left edge (visible ink 21px inside it); image box top 46px below the hero top (visible
ink 99px below it); 58px clear above the headline. Brad checked it by eye on a Retina MacBook Pro and it looked
sharp, so no density follow-up is needed for this placement. Mobile placement is not yet set.
Applied to the home page artifact (d068d657, v4) on 2026-09-28, scaled to its 1124px column.

## R13 — A card grid's column count follows the item count; never orphan one card

`ShowSectionNav` renders `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` over
`SECTION_LINKS` minus the current page — six minus one, so **five cards in a four-column
grid**, leaving one card alone on the second row at `lg` on every show page. The
societies grid has the same shape. This is one defect, not two, and the ruling is about
the pattern rather than either component.

**A single card alone in a row is the failure.** It reads as a mistake, or as an item
someone forgot to add, and three empty cells beside it make the page look unfinished at
exactly the moment it is trying to look complete.

1. **The column count is derived from the rendered item count, never hardcoded.** These
   collections are dynamic — one excludes the current page, others grow as content
   lands — so a constant column count is a bug waiting for the next item.
2. **The rule, assertable as written: for `n` items and `c` columns, `n mod c` may not
   equal 1 when `n > c`.** Pick the largest `c` up to 4 that satisfies it.
   - n=5 -> 3 columns (5 mod 4 = 1 fails; 5 mod 3 = 2 holds)
   - n=6 -> 4 or 3, both hold
   - n=7 -> 4 columns (7 mod 3 = 1 fails)
   - n=9 -> 3 columns (9 mod 4 = 1 fails)
3. **A row of two is a pair; a row of one is an orphan.** Two cards side by side read as
   deliberate. This is why 3 columns beats 4 at five items despite the wider cards.
   **`n = c` takes `c`.** The constraint is written "when `n > c`", so four items in four
   columns is unconstrained and takes 4, not 3 — a 2x2 is a block, not an orphan. Stated
   explicitly because "largest `c` up to 4 that holds" reads ambiguously at `n = c`.
4. **Small counts take their natural shape.** n<=3 uses n columns, not a 4-column grid
   with dead cells.
5. **The rule binds at `c` >= 3, and is tolerated at `c` = 2 — corrected 2026-09-10.**
   My original "below `lg` this is moot" was simply wrong: five items in two columns
   gives rows of 2, 2, 1 and orphans exactly as four columns do. It is tolerated there
   for a reason, not overlooked. A two-column grid reads as a list more than a grid, one
   empty cell beside a trailing card is mild, and the only alternative — dropping tablet
   to a single column — is worse. At `c` >= 3 the dead cells become a visible hole and
   the rule binds. At `c` = 1 it cannot arise.
6. **When no `c` avoids the orphan, the last card spans the remainder.** `n` = 13 breaks
   the rule as first written: 13 mod 4 = 1, 13 mod 3 = 1, 13 mod 2 = 1, so every
   candidate is rejected and thirteen cards would stack in a single desktop column. That
   is a defect in my rule, not a layout anyone should ship, and it recurs at every
   `n` = 1 (mod 12) — 13, 25, 37 — which the SA nursery directory could easily reach.

   The fix follows from what the rule is actually for. The failure was never "one card in
   a row"; it was **dead cells beside a lone card**. So when no count avoids it, keep the
   content ceiling and let the final card **span the empty remainder**. At `n` = 13,
   `c` = 4: three full rows and a final full-width card. No dead cells, and a wide
   closing card reads as deliberate. Never leave the orphan sitting in a partial row, and
   never centre it — a lone centred card in a four-column grid is the accidental-looking
   version of the same thing.
7. **The cap of 4 is about card contents, not about grids — added 2026-09-10.** I wrote
   "largest `c` up to 4" without justifying the 4, and a repo sweep turning up an
   existing `lg:grid-cols-5` exposed the gap. The cap applies to **text-bearing cards**:
   a title plus a hint needs roughly 280px to set without the label wrapping to three
   lines, and five across a 1280 container leaves about 230px. It does **not** apply to
   **small uniform tiles** — sponsor and affiliate logos, photo thumbnails — where 5 or 6
   across is correct and 4 looks sparse. The orphan rule binds at whatever `c` is chosen:
   nine logos in six columns leaves three on the second row and is fine; thirteen in six
   leaves one and is not.

   So the sweep has two families, not one. Read what the card contains before picking
   its ceiling, and do not let a helper flatten sponsor logos to the same grid as
   section links.

Applies to every card collection in the NOS layer, and resolves the separately-logged
societies-grid question as the same finding.

## R14 — The logo keeps its faces; the pages get their own

Brad, 2026-09-10: *"I don't want to use the logo fonts anywhere else on the NOS site
other than in the logo."*

1. **Cormorant Garamond and Jost are reserved to the wordmark.** They appear in the
   logo artwork and nowhere else. Because the lockup ships as supplied artwork, neither
   face need be loaded on a content page at all — the reservation enforces itself.
2. **Display is Fraunces.** It carries a warmth Cormorant deliberately does not, which
   is what lets it hold its own against the soft radii and purple-tinted shadow this
   system chose. A second Garamond would only read as the wordmark failing to match
   itself. Keep its optical-size axis low at display sizes so the contrast stays calm.
3. **Body is Karla — a warm grotesque, not a geometric one.** That distinction is the
   whole reason for the choice: anything geometric reads as Jost and pulls the eye back
   to the wordmark. Karla stays quiet across seventeen pages of prose and takes tracking
   well enough to set eyebrows without borrowing the logo's voice.
4. **The artwork is never re-typeset and never re-tinted.** Eight colourways ship —
   full colour, full-colour reversed, three inks, grayscale, gold, white. Pick a
   colourway. Do not build a lockup.

## R15 — The hero scrim is near-black, not purple

The live `/national-show` hero put a royal-purple wash over a magenta *Phalaenopsis*.
Brad's verdict: *"the purpl on purple is also shit."* He was diagnosing the ground, not
the photograph — a purple scrim over a magenta flower drives both to the same hue and
the bloom turns to mud. No better photograph fixes that while the wash is there.

1. **The scrim ramps in near-black `#0B0A14`, not `--purple-900`.** On near-black the
   veining reads as magenta on white and the bloom is the brightest thing in frame.
2. **R10's profile still governs the ramp** — 0.94 at the text column, 0.44 by the
   midline, 0.18 at x=75%, effectively clear at the edge. One horizontal layer, no
   vertical layer.
3. **The photograph stays as shot.** The live page washes it to olive monochrome, which
   is a filter by another name and fails the brand photography guideline.
4. **Keep the existing image** (`/images/orchid-dark.jpg`) until Lee-Ann supplies a
   cleared replacement. Scott Ormerod's set is studio-on-black, watermarked, and its
   rights are unconfirmed — and studio-on-black is precisely why a replacement will
   need no scrim rework.

## R16 — Never print the same photograph for different things

`/national-show` shows five past editions — 2024, 2021, 2018, 2015, 2012 — using one
identical photograph five times. On a real council's site that reads as fabricated, and
the cost is trust rather than polish. Past editions are set typographically instead.

**No image beats a false one.** This is R7 (copy is not invented) applied to pictures:
an image asserts "this is that show", and repeating it asserts something untrue five
times.

## R17 — Where R1/R2 contradict the approved canvas, the canvas wins

Settled 2026-09-10, on Brad's instruction that the designs and the rules are final.

R1 and R2 were written before the Claude Design canvas (`262aba20`) was read. Their
*structural* clauses — radius 0 on cards, `--radius-1: 2px` on buttons, elevation as
borders rather than shadows — assert the opposite of what the canvas specifies and of
what Brad approved on the restyled home page. A rule that contradicts an approved
design is a stale rule, not a constraint on it.

1. **Radii and elevation come from the canvas.** 10px on controls and small surfaces,
   16px on cards and panels; elevation is purple-tinted shadow, not a border. The
   canvas's `readme.md` and `guidelines/*.html` are the binding source; `tokens/*.css`
   is vocabulary only.
2. **R1's structural clause is superseded**; the rest of R1 stands — NOS is a
   subsection of saoc.co.za, identity travels in colour, type and imagery, and SAOC's
   site chrome is inherited unchanged.
3. **R2's "buttons are 2px" is superseded.** Its two corollaries stand and matter more
   than the number ever did: a primary action is a button and never decays into an
   underlined text link, and any radius change re-measures the focus ring against the
   new corner.
4. **The pill stays reserved to eyebrow pills.** A pill CTA still reads as a foreign
   system next to a 10px control.

**Why this way round.** Brad approved the canvas and then approved the restyled home
page built on it. Two approvals beat a rule that no longer describes anything shipped.
Reversible on his word, exactly as R3 was.

## R18 — An empty listing is a dated promise, never a void and never a placeholder record

Three NOS routes have no records at all: `/national-show/sa-exhibitors`,
`/national-show/international-guests`, `/national-show/sponsors`. No nurseries are named,
no guests are confirmed, and Lee-Ann's sponsor folder is empty. Ruled 2026-09-10 on the
build session's escalation.

**The route still ships.** A linked page that 404s is a worse failure than an honest empty
one, and the section nav counts these pages.

1. **No "No results found."** That anatomy belongs to a search or filter that returned
   nothing — it tells the reader their query failed. Nothing failed here; the content has
   not landed. Borrowing the search-failure component to say "not yet" misdescribes the
   state.
2. **No skeletons, no ghost cards, no shimmer.** A greyed card grid asserts a shape and a
   count that do not exist, and shimmer specifically claims the page is loading. Both are
   lies about state, and the second is one the browser will never resolve.
3. **No imagery.** R16 forbids a borrowed photograph standing in for a record, and a
   decorative orchid dropped in to fill the hole is the same act with a thinner excuse.
   These pages are typographic until real records exist.
4. **The page's real structure stays visible** — h1, intro, section nav, and any furniture
   that does not depend on records. What must not render is the grid itself: an empty grid
   with no children is not structure, it is absence with a class name.
5. **Where the grid would sit, one panel states what will appear and when.** Canvas card
   anatomy — 16px radius, purple-tinted shadow, never a dashed outline (a dashed box is the
   drop-zone/missing-file anatomy, and R17 retired borders as elevation regardless). Two
   elements, in this order:
   - **what** will be listed, in the page's own nouns — "South African exhibitors", "our
     international guests", "the 2027 sponsors";
   - **when** — or, if no date is known, **the gate in words**: "…once entries close",
     "…as sponsors are confirmed". R7 binds: an invented date is invented copy. Never a
     count. "40+ nurseries expected" is a promise nobody made.
6. **A next action only where one exists.** `/sponsors` has a conversion job and takes a
   button (sponsorship enquiry). `/sa-exhibitors` takes the exhibitor-entry action if that
   route is live. `/international-guests` gives the reader nothing to do, so it gets no
   button. A CTA manufactured to balance a layout is the R2 corollary inverted: an action
   that is not real must not be dressed as one.
7. **This is not R11.** R11 discloses text that exists and is unverified; R18 covers records
   that do not exist at all. Do not stack the AI-placeholder disclosure onto an
   empty-listing panel — there is no AI-generated claim on the page to disclose. If the
   *intro prose* of such a page is itself placeholder, R11 applies to that prose, in its own
   anatomy, independently of this panel.
8. **Filtered-to-zero is a different component.** Should any of these pages grow filters,
   "no matches — clear filters" is a distinct state with a distinct action. Never reuse the
   R18 panel for it: one says "not yet", the other says "not with those filters".
9. **R13 does not apply.** `n` = 0 is not a grid, and the panel is not a card in a
   collection. When the first real record lands, the grid returns and R13 governs it from
   `n` = 1.

## R19 — The disclosed extent is a surface, not a stripe

Settled 2026-09-10 on the build session's escalation. R11 clause 1 mandates a dashed 2px
rail and calls it non-negotiable; R17 retires 2px and retires borders as elevation, and
R18/5 rejects the dashed outline outright as the drop-zone anatomy. The build session was
right to refuse to build against that contradiction, and right that deleting the rail
without a replacement reopens the exact failure R11 exists to prevent.

**R11 clause 1 is superseded by this ruling.** Everything else in R11 stands — the wording,
the two states, the two inks, the assertion discipline.

**What R11 got right and this ruling keeps.** A notice can render first, pass every DOM
assertion, and still read as fine print. *Structure* fixes that, not colour and not size.
And the structure must scope the **extent** of what is unconfirmed, not merely sit above it.

**What R11 got wrong.** It made a dash carry provisionality. A dashed edge is the
drop-zone/missing-file anatomy — it says *something is absent here*, when the truth is that
something is present and unverified. **Provisionality is stated, not textured.** The chip
and the sentence say it in words; the anatomy's only job is scoping.

1. **The governed block sits on its own surface.** A low-tint ground from the canvas — no
   new colour — 16px radius, purple-tinted shadow at its lightest step. The surface's top
   and bottom edges scope the extent in both directions, which a leading rail only ever did
   in one. This is a strictly better mechanism, not a compromise.
2. **No border on any edge, dashed or solid.** R17. The surface is drawn by ground and
   shadow.
3. **The chip attaches to the surface's head.** Attached, not floating above it —
   attachment is what makes the chip and the prose one object rather than a note and some
   text near it.
4. **The closing sentence sits inside the surface, at the foot, at the quiet weight.**
   Outside the surface it is fine print again, which is the failure R11 named. Inside it,
   it is part of the disclosed object. This is R11's "one anatomy, two weights": the chip
   is the loud weight, the sentence the quiet one, and the surface is what makes them one
   anatomy.
5. **Distinguish it from a card and from a pull-quote**, both of which it could be mistaken
   for. Shadow at the lightest step — a card in a collection sits higher. Full measure — a
   pull-quote insets. And the chip — a card carries none at its head.
6. **Never nest a disclosure.** One surface per governed extent. If an entire page is
   unconfirmed, one surface wraps that page's prose; it is never one surface per paragraph.
   Sixteen pages of stacked panels would be the fine-print failure arriving by another
   route — through fatigue instead of through size.
7. **Unchanged from R11:** the exact wording, the placeholder / *AI-generated* / awaiting-
   Council triad, both state inks (`--status-warning-*` and the research pair on all four
   dark grounds), and assertions that measure rendered text rather than a fixed string.

## R20 — One source for logo files; four stale sets exist and must never ship

Settled 2026-09-10. The build session found a second Claude Design project —
`6cca8eaa-5cac-42f2-97e9-06496fbae25d`, the **logo production project** — and asked which
of three candidate locations is authoritative. Verified against both projects and the
local branding folder before ruling.

**Authoritative, and the only place to take a logo file from:**
`/Users/vetus/ai/SAOC/branding/National Show 2027/Logo`. Sixteen files (8 treatments ×
2 orientations) in both `.png` and `.jpg`. These are byte-for-byte the delivered masters:
their filenames match `assets/export/*` in the production project exactly —
`NOS-2027-logo-{treatment}-{orientation}.{png,jpg}`. Brad authorised reading that path.

**That path is outside this project folder — ask before reading it.**
`/Users/vetus/ai/SAOC/branding/…` is a sibling tree, so the scope rule applies: permission
is requested first, naming the full path and saying which tree it is in. Brad has granted
it before; a grant does not carry across sessions. Flagged by the build session on
2026-09-10 because "the only place a logo file comes from" reads as an available path, and
a future agent will otherwise discover the boundary as a permission prompt in the middle of
a mission. Ask at the start of the design pass, not when reaching for the file.

**Standing grant, 2026-09-14 — widened same day.** Brad, directly: *"Inside our project,
don't ask me to fix it again."* — then clarified the scope: *"it stands for all design
assets for NOS"*, naming the parent folder `/Users/vetus/ai/SAOC/branding/National Show
2027/`. The standing grant covers that whole folder (Logo included, plus any other NOS
design-asset subfolder under it), not just `Logo/` — read from it without a fresh ask each
session. This does not touch `.claude/rules/scope.md` itself (harness-owned, never
hand-edited per [[athanor-is-the-harness]]) and does not extend to any sibling path outside
this folder — e.g. the rest of `/Users/vetus/ai/SAOC/` stays subject to the normal
ask-first rule. Recorded here so it isn't re-litigated as a permission prompt.

**The production project is where they were made, not where they are taken from.** Read
`Logo Export Sheet.dc.html` and `Lockup Proportion Studio.dc.html` for the studio
proportions and the clearspace rule. Its tinted preview panel is preview only and is not
part of any file — the shipped ground is transparent with clearspace built in.

**Four stale sets exist in that project. None of them ships. Ever.**
- `assets/lockups/` — sixteen PNGs under an older naming scheme (`…-logo-colour-…`).
  Superseded by `assets/export/`.
- `assets/final/` — six files. The name is a lie; it predates the export run.
- `design_handoff_nos2027_logo/` — an earlier three-file handover with its own
  `CLAUDE_CODE_PROMPT.md`. **That prompt is not an instruction to anyone now.**
- `assets/ds-logo/` and `scraps/` — working material.

**The canvas's `assets/logo/*` is the wrong artefact class, not merely a stale copy.**
Those seven files are **emblem** variants — `orchid-emblem`, `orchid-grayscale`,
`orchid-ink-*`, `orchid-rev-*`. R3-reversed puts the **lockup** inside the `<h1>`, because
the lockup is what reads NATIONAL ORCHID SHOW. An emblem in that slot gives the page an
`<h1>` that states nothing. Use the canvas's logo assets to render the canvas; never to
sign a page.

**A file's presence is not a licence.** `docx/fonts/CormorantGaramond.ttf` and `Jost.ttf`
ship inside the production project for the Word pack. R14 reserves both faces to the
wordmark; finding them next to the logo files is not permission to load them on a page.

**Correction on record.** I told the build session "nothing else exists, there is no third
design surface." I meant design surfaces for the website, and I should have said so. The
logo production project is an asset-production surface and it existed the whole time. The
statement was true as I meant it and misleading as I wrote it.

## R21 — NOS colour may cross into SAOC chrome; NOS anatomy may not

Settled 2026-09-17. The SAOC session's `menu-system-layout4` landed a single "National
Show" mega-menu in the SAOC header, whose feature rail uses NOS-brand-coloured destination
pills and whose lead block uses the vertical NOS lockup. That puts NOS identity *above* the
header line, which R1 and R12 appeared to forbid. It does not, and the distinction is worth
stating because someone will otherwise "fix" a correct component to satisfy a rule that
never bound it.

**A mega-menu panel is a destination preview, not site chrome.** It shows what is behind the
door. So a NOS-coloured rail inside SAOC's header is showing the reader where they are about
to go, not rebranding the header. Permitted.

1. **Colour travels. Structure does not.** The pills' shape, radius, spacing and focus
   behaviour are SAOC's, because R1 keeps structure with the site. **R2's pill reservation
   does not bind here** — it governs the NOS layer's own pages. A NOS colour token crossing
   the boundary does not drag NOS anatomy across with it.
2. **Distinct token names are mandatory, and they got this right.** `--color-nos-*` rather
   than redeclared SAOC names. The NOS layer redeclares SAOC token *names* to different
   values — "parchment" is `#FBFAF0` in one layer and `#F4F3EC` in the other — and a shared
   surface reading a redeclared name resolves whichever layer rendered it. That is the
   defect that produced a real 4.34:1 failure once already.
3. **Contrast is measured against the panel's actual ground, not the NOS layer's.** Three
   pills carrying NOS purple into a SAOC-ground panel is exactly the cross-layer measurement
   that has failed before. 4.5:1 on the ground that actually renders.
4. **The exception stays narrow or it stops being one.** That one rail. The mobile drawer
   staying wholly SAOC palette is correct and is part of what makes the rail legible as
   deliberate rather than as leakage.
5. **NOS colour must not collide with status colour.** R8 keeps status functional and out of
   the palette shift. Three brand-coloured pills must not be mistakable for state.

**The lockup as a lead block — two conditions.**

6. **It carries an accessible name.** The lockup *is* the wordmark reading NATIONAL ORCHID
   SHOW; that is why R3 was reversed to let it be the `<h1>`. The same logic binds here: as
   the lead block of the menu's single biggest item, it is a navigational label made of
   artwork. Unlabelled, the biggest item in the header is silent to a screen reader.
7. **No plate behind it.** The supplied files carry transparent ground with clearspace built
   in, and the production sheet's tinted panel is preview only (R20). Pick a supplied
   colourway that works on the panel's ground; never re-tint, never re-typeset, and do not
   add a tinted rectangle to make a mismatched colourway sit.

8. **`full-colour` is cleared on parchment `#f4f3ec`, with a minimum size.** Checked
   2026-09-17 by compositing the actual PNG onto that ground and looking at it, not by
   reasoning from catalogued ink values. The navy wordmark, the olive subline, and the
   flower's purple throat, olive sepals and magenta labellum all sit well clear of the
   cream. The file's corners are alpha 0, so R20's transparent ground holds for it.

   **CORRECTED 2026-09-19 — the 120px floor first recorded here was wrong.** It was read
   off an evidence plate that was itself upscaled, so the blur I measured was my own.
   Re-rendered at true 2x device resolution, the lockup holds far lower:

   | rendered width | what survives at 2x | use |
   |---|---|---|
   | 64px | orchid reads as an orchid; show name legible; subline very small | compact contexts only |
   | 96px | both lines comfortable | sound minimum for a real placement |
   | 120px | clean throughout | general use |
   | 160-220px | veining and labellum fully present | heroes and section openers |

   Below roughly 48px it genuinely stops working, and favicon scale (16-32px) has no
   answer in the supplied set at all — see R22.

   **Two method notes, both recorded because the wrong instrument produced a false
   finding.** First: a pass measured every opaque pixel against the ground and found 59%
   below 1.6:1. Accurate and worthless — **a WCAG text-contrast floor does not apply to a
   watercolour botanical illustration.** Pale interiors are meant to be pale; measuring
   them as type manufactures a defect. Type and rules take contrast ratios; artwork is
   judged by looking at it on its actual ground.

   Second, and the reason the floor above was wrong: **an evidence plate rendered at 1x
   and displayed larger is measuring its own blur.** Brad caught this on a Retina screen
   within seconds of opening the review. Any plate used to judge legibility must be
   authored at 2x and capped at its true CSS width, or it proves nothing about the
   artwork and everything about the plate.

**The primary-menu item is closed by this.** The show is the single biggest item in the
header, which satisfies the one requirement I placed on nav IA: NOS is SAOC's flagship
triennial event and must not be a leaf. How it is expressed was theirs to decide and they
decided it well.

## R22 — Place the supplied file. That is the whole instruction.

Settled 2026-09-21. Brad: *"Keep the fucking branding assets as I supplied them. Don't
convert edit or change anything. You place it on the page and that's it."*

Earlier versions of this ruling built a derivative pipeline — a 2x source floor, "generate
every derivative from the master, never from another derivative", a contract assertion to
police export widths. **All of that is withdrawn.** It was asset production dressed as a
constraint, and it is not ours to do.

1. **Reference a supplied file and set its display size in CSS. Nothing else happens to
   it.** No export, no resize, no re-save, no format conversion, no optimisation pass, no
   tinting, no cropping, no re-typesetting, no compositing with other elements.
2. **There is no resolution problem when the file is used as supplied.** The vertical
   master is 3272px wide and the horizontal 4108px. A 200px placement is oversampled
   roughly sixteen times over. Every density concern raised in earlier versions of this
   ruling existed only because I had assumed sized derivatives would be cut; used as
   supplied, the question does not arise.
3. **Choosing among the sixteen supplied files is not modification.** Picking the vertical
   over the horizontal, or a reversed colourway over full-colour, is selection and is the
   designer's job. Altering any of them is not.
5. **Place the closest supplied size and keep the CSS sizing minimal** (Brad, 2026-09-21).
   The set offers exactly **two native sizes** — vertical `3272x2876`, horizontal
   `4108x1008` — in PNG and JPG. There is no web-sized variant, so "closest" means
   choosing the right *format* for the ground, not a smaller export.

   **The JPGs are pre-composited onto the brand's own grounds, and that is what makes them
   usable as supplied:**

   | file | baked ground | weight | use on |
   |---|---|---|---|
   | `reversed-white-vertical.jpg` | `#0B0914` | 479 KB | the near-black hero ground (R15 `#0B0A14` — a one-value difference, imperceptible) |
   | `reversed-gold-vertical.jpg` | `#221A56` | 495 KB | royal purple `#211A57` |
   | `full-colour-vertical.jpg` | `#F3F2D6` | 652 KB | **not parchment** — `#F3F2D6` is visibly yellower than `#F4F3EC` and would show as a rectangle |
   | `full-colour-vertical.png` | transparent | **4875 KB** | parchment and any light ground |

   So: **on dark grounds the JPG is the correct supplied file** — eight to ten times
   lighter than the PNG, nothing modified, ground already matching. **On parchment only the
   PNG works**, and it costs 4.8 MB for a 200px logo.

6. **The 4.8 MB light-ground case is an open escalation, not a licence to export.** There
   is no supplied file that solves it. Designing around it means preferring dark-ground
   placements for the lockup where the layout allows, which R21 already favours for other
   reasons. If a light-ground lockup placement is required and the weight is unacceptable,
   that is Brad's decision to make — a web-sized asset would have to come from him.

7. **"As supplied" is tested by byte-identity at rest, not by what the delivery layer
   does in flight.** Ruled 2026-09-21 on the SAOC session's escalation. Their `next/image`
   optimiser resizes and re-encodes the supplied PNG on the way to the browser while the
   repo copy stays byte-identical to the master.

   **That is delivery, not editing, and the policy does not reach it.** Every image on
   every site is decoded and rescaled somewhere — the browser itself does it. A rule that
   caught the optimiser would forbid displaying the file at all. The test that matters is
   the one Brad's instruction is actually about: **is the asset in the repo the supplied
   asset, unaltered?** Theirs is. Lower-casing a filename is a path convention, not an
   edit, on the same test.

   **Do not bypass the optimiser to serve the master untouched.** 4.8 MB for a 200px slot
   is a worse outcome by every measure, and it is not what the instruction was protecting.

8. **A correction to my own withdrawal, from their measurement.** I withdrew the density
   rule saying there was no density problem because the master is 3272px wide and a 200px
   placement is "oversampled roughly sixteen times". **That figure is wrong at the point of
   display.** They measured the live DOM: the browser loads a **256px** candidate for that
   200px slot. Real oversampling is about 1.3x.

   The withdrawal still stands — a 2x *source floor policed by a contract assertion* was
   asset production and was never the answer. But the concern it was groping at is real and
   is mine to state as a design requirement:

   **The mark must arrive at full density on the display it is viewed on.** A 256px file in
   a 200px slot is effectively 1x, and on a Retina screen it will look soft — which is
   precisely the quality Brad objected to by eye. The fix is in the optimiser's candidate
   selection, not in a new asset: the 2x candidate (384px here) must be the one a 2x
   display receives. How that is configured is engineering's call; that it happens is mine.

9. **A gap in the set is designed around, never filled.** If no supplied file suits a slot,
   the answer is a different design for that slot — type, or nothing — not a new asset.

## R23 — The pages are building a lockup out of an emblem and type. They must not.

Settled 2026-09-19, from the NOS Site audit's source reading rather than from anything I
observed — which is the only reason it is right.

`components/nos/EmblemBadge.tsx` renders `/images/nos/disa-graminifolia-emblem.svg` and
composes it with a **text wordmark** into the masthead and colophon lockup at
`app/(marketing)/national-show/layout.tsx`. That is a hand-assembled lockup.

**R14/4 already forbids exactly this:** *"The artwork is never re-typeset and never
re-tinted. Eight colourways ship... Pick a colourway. Do not build a lockup."* R20 adds the
distinction that makes it concrete: the canvas's emblem files are a **different artefact
class** from the lockup, and an emblem standing where the lockup belongs gives a heading
that states nothing.

This single finding explains all three of Brad's original complaints about the pages, none
of which needed a resolution theory:

1. **"The emblem's too small, you can't see the details."** It is an emblem badge sized as
   chrome, not the lockup sized as identity. No supplied artwork is being used at all.
2. **"It's not balanced."** The supplied lockups carry studio-locked proportions and
   built-in clearspace. A lockup assembled at runtime from a badge plus a text line has
   neither, so its balance is whatever CSS happens to produce.
3. **"Conflicting with a SAOC logo that's horizontally set."** A badge beside or above a
   text wordmark is a horizontal composition by construction, which is the stacked-bars
   fault of R21 arriving by a different route.

**The fix is to stop composing and start placing.** Use a supplied lockup file, vertical
where it sits beneath SAOC's horizontal mark, at a size from R21/8's table. The wordmark is
in the artwork; it is not typeset alongside it.

**`EmblemBadge` is legitimate as exactly what its name says** — a badge, for avatars and
favicons — rendering the supplied `Disa graminifolia.svg`. Correcting myself again: I
called this an open gap needing a new asset. It is not. The emblem is vector and renders
sharp at any size; what it loses at 32px is detail, not sharpness, and per R22/5 that is
the accepted outcome rather than a problem to solve with a new file.

**On the vector-to-raster question:** replacing the composed lockup with a supplied PNG
moves the masthead mark from vector to raster. That is simply what the supplied set is.
It needs no mitigation — the master is large enough that any on-page placement is heavily
oversampled. Place it and size it in CSS.

**Method note.** I spent a day diagnosing these pages from the master files and my own
plates while repeatedly stating I could not see the pages. The build session read the
source and found in one pass that the artwork under discussion was never on them. When a
diagnosis cannot be grounded in the thing being diagnosed, that is a blocker to escalate,
not a gap to reason across.

## Standing directive — new pages: structure first, design later

Brad, 2026-09-14: *"no design, structure only we will tackle the new pages with individual
designs when all linked and ready."* Confirms and sharpens the 2026-09-14 hold already
relayed by `saoc-5e` (design needs his firm confirmation; site structure can proceed from
the existing plan). New/unbuilt pages get their nav, routing and content structure now,
under the standing rulings above (chrome, grids, empty-state anatomy, etc.) — no new
per-page design decisions until the page is linked into the site and ready, at which point
each gets its own individual design pass. Do not pre-design pages that aren't reachable yet.
