# R12 build answers from Codi (NOS design), 2026-09-28 — relayed via saoc-nos-design-f1

Target design ("their artifact"): https://claude.ai/artifact/SjeY6NP8tXqRRv8ZgpV3uJ
(= d068d657, v4, "National Show Home, Restyled" — it IS /national-show; CSS header
"NOS 2027 — /national-show, restyled"). Adjuster SSD4vVap… is a placement tool only.

Hero reference = artifact hero: lockup, scrim, faces, eyebrows, meta, countdown, buttons.
- R14: display Fraunces, body Karla. Cormorant/Jost only inside logo artwork; do not load Cormorant.
- R15+R10 scrim: linear-gradient(90deg, rgba(11,10,20,.94) 0%, .80 30%, .44 52%, .18 75%, .04 100%). No vertical plate.
- Sections below hero: approved design too, but in-scope for this pass is Brad's call.

Desktop (Brad, adjuster placements/hero, 16:33Z, 1714 viewport / 1216 column):
- File NOS-2027-logo-full-colour-reversed-horizontal.png (transparent, as supplied, R22).
- Image box 1140px wide (h 280). Scale ~93.75% of column below 1216.
- Box left edge 32px outside column left edge (ink 21px inside).
- Box top 46px below hero top (ink 99px below). ~58px ink-bottom to next text.

Mobile ≤620px (Brad, 16:42Z, 390 viewport, 20px gutter; design commit 1f3e0ed):
- File NOS-2027-logo-full-colour-reversed-VERTICAL.png (as supplied).
- Image 365px wide (h 321), normal flow, first child of hero column.
- margin-left: -18px (ink 8px inside column edge).
- hero column padding-top: 3px above image box (ink 28px below hero top).
- margin-bottom: 8px (37px ink to THE FLAGSHIP).
- Ink 312px in 350px column; narrower phones scale ~104% of column width, negative margin keeps ink ~8px in.

Keep: THE FLAGSHIP + EDITION XIX eyebrows (after lockup), lede, meta, buttons, countdown.
Remove: band above hero (R23 hand-built lockup), EmblemBadge brandMark, typeset h1 text.
h1 content = lockup <img alt="National Orchid Show, Western Cape 2027">.
Open (Brad via Codi): lede opens "The South African National Orchid Show —" duplicating the mark. Do NOT rewrite (R7).

## SUPERSEDES the mobile horizontal inset above — Brad, via Codi, design commit beeea00
Mobile ≤620px: CENTRE the image box in the hero column: margin-left: calc(50% - 182.5px) at
width 365px; general form margin-left: calc(50% - <width>/2) (margin-inline:auto fails: box is
15px wider than column). Ink ~18px from each column edge. Unchanged: vertical file, 365px,
padding-top 3px, margin-bottom 8px. Only the mark is centred; FLAGSHIP, lede, meta, buttons stay left.

## Amendment 2026-09-29 (Codi deltas)

Received from Codi (saoc-nos-design-f1) for `feat/nos-hero-lockup @424d7ce7`, after
a QA FAIL and Brad's desktop feedback. Source (verbatim):
`.agent/memory/scratch/rulings-inbox/codi-hero-deltas-2026-09-29.md`. Supersedes
the corresponding values above where they conflict; everything not named below
is unchanged.

**Photo:** `/images/orchid-dark.jpg` (drop `orchid-violet`). The artifact's
1400×933 JPEG is `orchid-dark.jpg` downscaled — pixel diff 0 against
`public/images/orchid-dark.jpg` resized to 1400 — provenance traces under R15,
no new asset.

**Desktop (1714 and 1280):**
1. Background: `orchid-dark.jpg`, `cover`, `object-position: 68% 50%`. Scrim
   unchanged.
2. Lockup-to-h1 gap: box bottom **5px** above "The Flagship", no extra flex
   gap. Transparent under-ink 192/1008 × 279.66 = 53.3px → visible ink **58px**
   clear (R12 target unchanged). Width 1140, `-32px` offset, 46px top —
   unchanged.

**Mobile (390):**
3. Background: full-bleed, **absolute, positioned behind ALL hero content**
   (not the stacked in-flow band used until now), `orchid-dark.jpg` at
   `68% 50%`, same near-black scrim. Remove the 260px band below the content.
4. Lockup width **365px at 390 regardless of the 32px gutter**, centred on
   **the viewport** (not the padded column):
   `width: min(365px, 100vw - 25px)`;
   `margin-left: calc(50% - min(365px, 100vw - 25px)/2)` relative to a
   full-width parent (or break out of the gutter and centre). Target: ink
   **~18px from each viewport edge**. Hero text stays left-aligned on the
   gutter.
5. Lockup-to-eyebrow gap: **8px total** from box bottom (`margin-bottom: 8px`,
   no flex gap). 256/2876 × 321 = 28.6px transparent under-ink → **~37px**
   visible (target unchanged).
6. The dorsal sepal (top of the flower) was clipped under the site header in
   `hero-390.png`. The lockup box's top must start **below the header's
   bottom edge**, then `padding-top: 3px` — the whole flower visible with its
   built-in clearspace. Check for the hero being pulled up under a sticky
   header or a negative margin.
7. CLS fix, approved: each `<source>` gets its own `width`/`height`
   (horizontal 4108×1008, vertical 3272×2876); the fallback `<img>` matches
   the source it falls back to.

**Unchanged:** R14 faces, scrim stops, no "NATIONAL SHOW" eyebrow under the
lockup.

After this pass: resend hero-1280/390/1714.png with the two measured ink gaps
for Brad's sign-off.

## Amendment 2026-09-29b (legibility)

Received from Codi (saoc-nos-design-f1), ruling on `bce627a2`. Source (verbatim):
`.agent/memory/scratch/rulings-inbox/codi-hero-legibility-2026-09-29.md`.
RULING 1 (365px box, 38/40px ink inset) is a no-change confirmation of the
existing placement numbers above — nothing here supersedes them. RULING 2
(legibility) is new and is recorded below.

**Photo, desktop scrim stops: frozen.** `orchid-dark.jpg`, full-bleed,
`object-position: 68% 50%` (Amendment 2026-09-29) and the five R10/R15 gradient
stops (`placement-spec.md` line 9 / `hero-structure.md` §8) are unchanged. The
defect is layout width, not colour — the hero copy column was running wider
than the mock, carrying text past the point where the R10 ramp is dark enough.

**DESKTOP (>620px):** cap the whole hero copy block — eyebrow, eyebrow2, lede,
the 4-column meta `dl`, buttons, countdown — at `max-width: 720px` (the mock's
`.hero-copy` value). The `dl` stays 4 columns inside that 720px, as the mock
does; the venue line wraps if it must — that's fine. This 720px column is
independent of the lockup image's own 1140px/93.75% box width from §5 above;
only the text block beneath it narrows.

**MOBILE (≤620px), new clause of R15:** replace the horizontal ramp with a
single flat layer, `rgba(11,10,20,0.82)`, over the whole hero — not a gradient,
one solid tint. `orchid-dark.jpg` stays full-bleed at `68% 50%` underneath it.
Desktop is unchanged; this flat layer applies only at ≤620px.

**ACCEPTANCE — gated, not eyeballed.** At viewports 1280, 1714 and 390, sample
the actual composited pixels (photo + scrim, screenshotted, not
`getComputedStyle()` string-parsed — Tailwind v4 serialises opacity-modified
colours as `oklab()`, which a regex parse gets plausibly wrong) behind every
hero text element and every button's border. Report the worst-case contrast
ratio per element across the three viewports. Floor: **text ≥ 4.5:1** (`dt`
small caps count as normal text, no relaxed floor for caps). Button border
floor: **≥ 3:1** — Codi's ruling states only the text floor explicitly; this
number is the architect's fill-in, taken from the project's own existing
WCAG 1.4.11 non-text/UI-component standard already applied to focus rings
(R9), not a new invented threshold.

**Fallback, conditional on the measurement:** if a desktop `dl` cell still
fails its floor at 720px, switch the `dl` to 2×2 at desktop and re-measure.
This is a structural change applied only if the first measurement fails it —
do not apply the 2×2 layout pre-emptively. Do not touch the scrim to chase a
`dl` failure.

After the pass: resend the three screenshots (1280/1714/390) with the
contrast table; Brad signs off from that.
