# M7 golden — the `/national-show` hero, after the four defects

Authority: `.agent/memory/project/design/nos-design-rulings.md` **R2**, **R3**,
**R4**, **R7**. Target state for `app/(marketing)/national-show/page.tsx`
(hero call site ~343–433), `components/nos/NosHero.tsx`, `components/nos/Logo.tsx`,
`components/nos/Button.tsx` and a new NOS-scoped
`app/(marketing)/national-show/layout.tsx` chrome band.

---

## D1 — The page states its name in type (R3)

**Now:** the hero's `<h1>` is `<Logo orientation="responsive" tone="on-dark"
size="hero" as="h1" />` — the full emblem-above-wordmark lockup standing in for a
headline.

**After:** the `<h1>` is a typographic headline.

```
The South African National Orchid Show
```

Exact required properties, all measured in a browser:

| # | property | required |
|---|---|---|
| D1.1 | `h1` text content (trimmed, whitespace-collapsed) | exactly `The South African National Orchid Show` |
| D1.2 | computed `font-family` | resolves to the Cormorant Garamond stack (substring match on `Cormorant`, case-insensitive) |
| D1.3 | computed `text-transform` | `none` — sentence case. R6/4's caps-tracking rule is for eyebrows and the wordmark; a headline in caps is a different design |
| D1.4 | rendered glyphs | not all-uppercase (guards against caps baked into the string rather than the CSS) |
| D1.5 | computed `font-size` | equals the resolved value of `--display-xl` at that element, ±0.5px |
| D1.6 | rendered line-box count | **exactly 2** at 390, 1024 and 1280 |
| D1.7 | emblem above it | an `<img>`/`<svg>` mark whose rect bottom ≤ the `h1` rect top, and whose rendered width ≤ 25% of the `h1` rect width — "a modest mark", not a headline |
| D1.8 | the full lockup | **absent** from the hero. No emblem-plus-wordmark lockup inside the hero section |

**D1.5, on scoping.** `--display-xl` already exists in `app/globals.css` (~line 41)
as `clamp(54px, 7vw, 96px)`, consumed at globals.css:134. `NosHero`'s current
default title style is `text-[clamp(36px,5.6vw,64px)]` and is shared by **12 call
sites**. Do not raise the shared default. Add a prop:

```
titleSize?: 'default' | 'display'   // default: 'default'
```

`'display'` selects `--display-xl`; only the `/national-show` hero passes it.
Every other call site keeps the size it renders today — a regression there is a
regression in eleven pages nobody asked to change.

**D1.6, on measurement.** Assert the measured line-box count, not a
`max-w-[Nch]` class. A `ch` cap is a proxy for the outcome and passes while the
outcome is wrong at a viewport nobody checked. Count line boxes by walking the
`h1`'s text nodes with a `Range` and collecting distinct `getClientRects()` top
offsets (rounded to 1px).

**D1.8, on where the lockup goes.** R3: *"The full lockup (emblem above wordmark)
belongs in header and footer, where a signature is what's wanted."*

It goes in a **NOS-scoped** masthead and colophon band, in
`app/(marketing)/national-show/layout.tsx`. It does **not** go in
`components/chrome/Header.tsx` or `components/chrome/Footer.tsx` — those render on
every SAOC page, and putting the show lockup there leaks a show signature onto
`/societies`, `/judging` and the rest. The contract asserts both halves: present
under `/national-show`, absent from a non-NOS route.

---

## D2 — The collision is fixed by the crop, never the scrim (R4)

**This ruling is not the architect's to make and has been made.** It is recorded
here verbatim so it survives re-argument during implementation:

> `guidelines/brand-photography.html`: *"No filters, vignettes, or duotones — the
> flower supplies the colour."* A scrim deepened across one region to hide a
> collision is a vignette solving a layout problem. The scrim has exactly one job
> — a subtle dark-to-transparent gradient for text legibility — and does not
> acquire a second.

An earlier architectural recommendation to deepen the left scrim was **reversed**.
Fix the collision by re-framing. **The scrim stays exactly as already specified** —
the three existing gradients in `NosHero.tsx` keep their current stops and
opacities. Any diff that changes a scrim opacity, adds a fourth gradient, or
raises a gradient's coverage is a violation of this golden regardless of what the
contrast numbers say.

The four requirements, as ruled:

1. **Focal point shifts right.** The bloom centre sits in the right third; the
   left third resolves to the naturally dark, out-of-focus ground already present
   in the frame.
2. **Declared via `object-position`, off the real bloom centre — not a hardcoded
   crop.** `NosHero.tsx` currently renders `<Image fill className="object-cover">`
   with no `object-position` at all, so it defaults to `50% 50%`. Add a
   `focalPoint?: string` prop (a CSS `object-position` value) applied to the
   image, and pass the measured bloom centre of `/images/orchid-violet.jpg` from
   the call site as a **named constant with a comment recording how it was
   measured**. Not a per-breakpoint media-query crop: a single declared point, so
   the composition holds across viewport aspects rather than only at 1280.
3. **At 390 the bloom stacks below the type block, full-bleed, never behind it.**
   Measured as: at 390 the hero image's rect top ≥ the type block's rect bottom.
4. **Emblem and bloom never overlap at any width.** This is a golden assertion —
   see §D2.1 for how "the bloom" is measured.

### D2.1 — Measuring "the bloom" without hand-waving

"Overlap with the bloom" has to be a number or it is an opinion. The bloom is the
lit, *chromatic* subject against dark out-of-focus ground, so measure it that way.

**Two instruments, chosen by what the width makes exact.**

*At 390*, the hero image and the emblem are in separate stacked blocks (clause 3
puts the image below the type block entirely), so overlap is a **rect
intersection** — exact, no sampling, no classifier. Use it. A colour classifier
here would answer a question geometry has already answered better, and would
inherit sampling error for nothing.

*At 1024 and 1280*, the emblem sits over the image and only colour can say
whether it sits over the *lit* part of it. Then:

- Screenshot the composited hero (no DOM overlays, no synthetic elements).
- Sample pixels on a ≥16×16 grid over the emblem's rect **plus 8px of padding on
  every side, with the emblem's own rect masked out** — an annulus, not a filled
  box. The emblem's ink is not the bloom, and including it makes every reading a
  measurement of the mark rather than of the ground under it.
- Convert each pixel to **absolute chroma** `(max − min) / 255` and HSL lightness
  `(max + min) / 2 / 255`.
- A pixel is **bloom-like** when `chroma ≥ 0.08 AND 0.15 ≤ lightness ≤ 0.90`.
- A rect is **clear of the bloom** when < 2% of its sampled pixels are bloom-like.

**Defect correction (2026-09-08) — the earlier formula could not work.** This
golden previously specified HSL `saturation ≥ 0.35 AND lightness ≥ 0.35`. That is
not a mis-tuned threshold, it is a broken instrument, and no choice of numbers
repairs it: HSL saturation normalises against distance from the nearest grey
*axis endpoint*, so it climbs toward 1.0 at both extremes of lightness. The
emblem's own ivory, `rgb(255,255,240)`, computes to `s = 1.0, l = 0.97` —
"maximally saturated" for a pixel that is very nearly white. Every bright
low-chroma surface on the page misfires the same way. Absolute chroma has no such
degeneracy, and the lightness *window* (floor **and** ceiling) excludes near-white
and near-black by construction rather than by luck.

Measured with the corrected classifier at the declared focal point (`51% 37%`),
control rect vs emblem annulus — `chroma ≥ 0.08 AND 0.15 ≤ l ≤ 0.90`, the exact
classifier the verifier ships — → **99% / 0%** at 1280 and 95% / 0% at 1024. §N2
discriminates; all three bloom checks pass. Every number recorded in this section
was measured on that classifier and on no other.

Two worked exclusions, since near-white is the failure this correction exists to
close. The emblem's ivory `rgb(255,255,240)`: chroma `15/255 = 0.059`, below the
0.08 floor; lightness `0.971`, above the 0.90 ceiling. The pale gold page ground
`#fbfaf0`: chroma `11/255 = 0.043`; lightness `0.963`. Both are excluded twice
over — by chroma and by the ceiling independently — so neither the mask nor the
ceiling is load-bearing alone here. Keep both anyway: they fix different
exposures, and a blown highlight inside the photograph can clear the chroma floor
where flat near-white cannot.

**The numbers above are fixed. Do not move the lightness floor in either
direction.** The floor sits on a cliff — 0.15 → 99% control, 0.20 → 29%, 0.25 →
0% — because the composited bloom at the focal point lands at roughly RGB 38–51.
Raising the floor fails §N2 and reads as a harness regression that is not one.
Lowering it fits the instrument to the composite and certifies the darkness
permanently. The thin margin is a **true reading**, and §N2 going red on any
further scrim darkening is the control doing its job.

Because the correction was a defect fix and not a calibration, the previous
instruction for `@dev` to record a retune note **does not apply and is
withdrawn**. The verifier deliberately departs from the superseded formula and
records the reason in its own constants block; this section is now the
authoritative statement of the metric, and the two agree.

**Still not a scrim question — for M7.** The scrim is untouched, per §D2 and the
M7 out-of-scope list, and nothing in this correction licenses touching it. But
the new numbers *sharpen* rather than dissolve the design observation behind R4:
all three gradients stack to roughly 86% opacity at the declared focal point, so
the subject composites to lightness ≈ 0.15–0.20. R5 asks for photography
delivered as shot — "warm saturated petals" — and a petal rendering at lightness
0.17 is neither. R4 assigns legibility to the crop and holds the scrim to exactly
one job; if the crop's focal point is invisible under the scrim stack, the crop
is not doing that work. **Whether the scrim stack is load-bearing is a design
determination under R4, belongs to Codi, and is explicitly not M7's to answer.**
Codi's escalation path forbids opacity as the fix and names moving the type to
quieter ground or moving the crop further. Raised with the orchestrator; not
blocking this milestone.

### D2.2 — Contrast, and the escalation path when it fails

Contrast is measured at the **composited pixel** — screenshot sample under the
glyph boxes — at **390, 1024 and 1280**. 1024 is mandatory: it was the previously
recorded worst case (4.78:1), and a check that skips it is checking the two
viewports that already passed.

| target | ratio |
|---|---|
| `h1` against the composited hero behind it | ≥ 4.5:1 |
| hero lede | ≥ 4.5:1 |
| each of the three action labels against its own composited background | ≥ 4.5:1 |
| the `OPENS IN` eyebrow | ≥ 4.5:1 |

**Escalation, quoted from R4:** *"if contrast at the composited pixel still fails
behind the `<h1>` after re-cropping, the fix is the type moving to quieter ground
or the crop moving further. Not opacity. It comes back to Codi."*

Operationally: `@dev` does **not** reach for a scrim opacity, a `bg-black/40`
plate, a `text-shadow`, or a backdrop filter. `@dev` stops and returns to the
orchestrator with the measured numbers.

### D2.3 — Dead code the supersession creates

`titleIsElement` on `NosHero` and `as` / `size='hero'` on `Logo` exist only to let
the lockup impersonate the `<h1>`. Once D1 lands they are dead, and the project's
own standard is that dead code is removed, not left as an unused branch.

- Remove `titleIsElement` from `NosHero`'s props and from every call site.
- Remove `as` and the `'hero'` value of `size` from `Logo`. **Keep** `orientation`
  including `'responsive'` — the masthead/colophon bands use it.
- `NosHero`'s top-down `h-[62%]` scrim band is currently gated on
  `brandMark || titleIsElement`. That gate loses one of its operands. Re-specify
  the condition explicitly — do not let it silently collapse to `brandMark` alone
  and change the rendering of the other eleven heroes. The band's behaviour on
  every existing call site must be unchanged; the contract asserts this by
  measuring a second, unrelated NOS hero before and after.

---

## D3 — Three equal-weight rectangular buttons (R2)

**Now:** one `Button variant="on-dark"` to `/tickets`, plus two underlined text
`<Link>`s — `/contact` ("Register interest") and `/societies` ("Find your
society").

**After:** three buttons. R2's corollary is the whole point: *"primary actions are
buttons. An action demoted to an underlined text link has left the hierarchy —
'Register interest' is the exhibitor conversion and must never decay into body
copy."*

| slot | label | href | treatment |
|---|---|---|---|
| 1 | (existing ticket label, unchanged — R7) | `/tickets` | filled |
| 2 | `Register interest` | `/contact` | outlined |
| 3 | `Find your society` | `/societies` | outlined |

Labels are **not** rewritten. R7: copy is not invented. The ticket button keeps the
string it renders today.

Required, all measured:

| # | property | required |
|---|---|---|
| D3.1 | count | exactly 3 action controls in the hero action row |
| D3.2 | computed `border-radius` | `2px` on all four corners of all three |
| D3.3 | computed `text-decoration-line` | `none` on all three — no underlined links survive |
| D3.4 | fill | exactly **one** has an opaque background; exactly **two** have a transparent/near-transparent background *and* a visible border ≥ 1px |
| D3.5 | equal weight | identical computed `font-size` and horizontal padding across all three; rendered heights within 2px |
| D3.6 | hrefs | exactly `/tickets`, `/contact`, `/societies` |
| D3.7 | focus ring | measured — see below |
| D3.8 | label contrast | ≥ 4.5:1 each, composited (D2.2) |

**D3.4 needs a variant that does not exist.** `Button.tsx` has `primary`, `ghost`
and `on-dark`; there is no outlined-on-dark. Commission `ghost-on-dark`: transparent
background, `border-[length:var(--border-primary)]` in the on-dark border colour,
on-dark label colour, same padding and font as every other variant. Do not reach
for `ghost` (its `border-primary`/`text-ink` fail on the photograph) and do not
inline one-off classes at the call site — the project bans inline styling of
variants and the next hero would copy it.

**D3.7, the measured focus ring (R2 corollary, R6/2).** For each of the three
buttons: focus it from the keyboard, capture, and compare composited pixels against
the unfocused capture in a band just outside the border box. Require a detectable
change at **all four edge midpoints and all four corners**. The corners are the
assertion that matters — a ring that cleared a 999px pill can foul a 2px corner,
and that is the specific regression this milestone creates.

Also confirm the ring is not clipped: no ancestor of the action row may impose
`overflow: hidden` that crops the ring band.

---

## D4 — The `OPENS IN` eyebrow

**The brief describes this as a missing element. It is not.** The eyebrow exists
at `app/(marketing)/national-show/page.tsx:~420` and already renders uppercase. The
real defect is a **font and weight mismatch**: it is `font-sans` (Jost) 10px/500 at
`text-ivory/70`, while the `ShowCountdown` unit labels directly beneath it are
`font-mono` 11px at `text-ivory/90`. Two eyebrow treatments, 30px apart, in one
block. R1 keeps JetBrains Mono eyebrows; the countdown obeys that and the eyebrow
does not.

`ShowCountdown` lives at `components/show/ShowCountdown.tsx` — **not** under
`components/nos/`. Any path in an assertion must use the real location.

**After:** the eyebrow matches the countdown's own label treatment.

Asserted by comparing the eyebrow's computed style to a live `ShowCountdown` unit
label's computed style, in the same page render — not against literal values.
Token drift then cannot pass the check by moving both sides at once, and a future
retune of the countdown labels drags the eyebrow with it instead of silently
re-opening the mismatch.

| # | property | required |
|---|---|---|
| D4.1 | `font-family` | equal to the countdown label's |
| D4.2 | `font-size` | equal to the countdown label's |
| D4.3 | `letter-spacing` | equal to the countdown label's |
| D4.4 | `text-transform` | `uppercase`, on both |
| D4.5 | `color` | equal to the countdown label's (string equality is fine here — both sides come from the same engine in the same render, so the `oklab()` serialisation is identical on both) |
| D4.6 | position | the eyebrow's rect bottom ≤ the countdown block's rect top |
| D4.7 | contrast | ≥ 4.5:1, composited |

D4.5 is the one place a computed-colour **string comparison** is legitimate: it is
an equality test between two values produced by the same serialiser, not an
attempt to extract channel numbers. Contrast still comes from pixels (D4.7).

---

## Negative controls

A harness that has never failed has not been shown to be capable of failing. Both
controls below are checks in the same verifier and both must be green.

**N1 — the contrast detector can fail.** Inject a synthetic probe into the page:
a text node in a colour known to fail against the sampled ground (e.g. ivory at
15% opacity over the hero). Measure it with the *same* code path the real checks
use. N1 passes when the harness reports a ratio **below** 4.5:1 for the probe.
Remove the probe before any real measurement. A harness that scores the probe as
passing is broken and every other contrast number in this contract is worthless.

**N2 — the bloom metric discriminates.** Apply §D2.1's metric to a control rect
centred on the declared focal point. N2 passes when that rect measures **above**
the bloom-like threshold — i.e. the metric can tell the bloom from the ground. A
metric that reports "clear" everywhere would pass D2 §4 trivially.

---

## Out of scope for M7

Unchanged and not to be touched: the NOS palette, Cormorant Garamond, oldstyle
figures, the emblem artwork itself, mono eyebrows elsewhere, the scrim
specification (see D2), and every hero call site other than `/national-show`
except where D2.3 requires a mechanical prop removal.
