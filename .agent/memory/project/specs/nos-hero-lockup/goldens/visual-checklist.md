# nos-hero-lockup — visual checklist

Per the project rule "visual work is not done until a browser has seen it":
contract assertions (grep/cmp/tsc) cannot see a rendered page. Capture both
widths on `/national-show` (dev server) AND on one other NOS route (e.g.
`/national-show/tickets`) to prove the masthead routing (§2) didn't regress the
other 18 pages. Use `BrowserAgent`/Playwright, not a design agent's own claim.

## `/national-show` at 1280px

- [ ] No SAOC-purple/hairline strip between the global SAOC header and the
      hero — the masthead band is gone on this route only.
- [ ] Hero `<h1>` is the horizontal lockup artwork (navy/olive/magenta on
      transparent), NOT the old plain-text headline, NOT an emblem badge.
- [ ] Lockup box's left edge sits flush with the section's outer edge (32px
      further left than the eyebrow/lede text below it, which stays on the
      1216px column).
- [ ] Order top-to-bottom: lockup → "The Flagship" → "Edition XIX" (small
      mono caps, same row-height family as a JetBrains Mono eyebrow) → lede
      paragraph → 4-column meta facts → confirmation badge (if a status is
      set) → button row → "Opens in" + countdown.
- [ ] Scrim: dark solid over the left/text column, fading to visibly showing
      the photograph by roughly 3/4 across, clear at the right edge — no dark
      wash across the top of the image, no vertical dark band, photograph
      reads in its own colour (no purple/violet cast) at the right.
- [ ] No visible Cormorant Garamond glyphs anywhere in the hero (the old
      headline's serif is gone; eyebrow/lede/meta read in Karla — a
      grotesque, not the elegant swash-y Cormorant).

## `/national-show` at 390px

- [ ] Lockup is the VERTICAL file, visually centred in the column (roughly
      equal air left and right of the artwork, not flush-left).
- [ ] "The Flagship" sits close beneath the lockup (small gap, not the ~58px
      desktop gap).
- [ ] Everything below the lockup (eyebrow, Edition XIX, lede, meta, buttons,
      countdown) is left-aligned — only the mark itself is centred.
- [ ] Photograph still visible and legible behind/around the scrim; no
      layout overflow (compare against `no-horizontal-overflow.spec.ts`'s
      intent even if not run here).

## `/national-show/tickets` (or any other NOS subpage) at 1280px and 390px

- [ ] Masthead band (emblem + "National Orchid Show / Western Cape · 2027")
      IS still present above this page's own content, unchanged from before
      this feature — proves §2's route-scoping didn't remove it site-wide.
- [ ] This page's own `<h1>` / content is unaffected by anything in this
      feature.

## Cross-cutting

- [ ] Tab through the hero's interactive elements (buttons, any links) —
      visible focus ring present on each, same as before this change.
- [ ] Browser console: no new errors/warnings introduced (missing image,
      hydration mismatch from the `<picture>`/`getImageProps` markup, etc).
- [ ] DevTools Network: on a simulated 2x/Retina viewport, the lockup image
      request resolves to a ≥2x-density candidate for its rendered width
      (R22/8) — not the 1x/256px-class candidate.

## Amendment 2026-09-29 (Codi deltas)

Source: `.agent/memory/scratch/rulings-inbox/codi-hero-deltas-2026-09-29.md`,
after the first QA FAIL. Re-check the whole checklist above against the new
photo/placement — these items refine or add to it, they don't replace it.

### `/national-show` at 1280px

- [ ] Hero background is `orchid-dark.jpg` (NOT `orchid-violet.jpg`) —
      recognisably the same specimen as the reference artifact's own hero
      photograph (same downscaled source).
- [ ] Photograph's focal point reads as `object-position: 68% 50%` — bloom
      sits right-of-centre, vertically centred; compare against the artifact.
- [ ] Lockup-to-"The Flagship" gap reads as ~58px of visible ink-to-text
      clearance (target unchanged from the original checklist; the CSS
      mechanism behind it changed, the rendered gap should not have).

### `/national-show` at 390px

- [ ] Background photograph is full-bleed and sits **behind the entire hero
      content column**, edge to edge — NOT a separate photo band beneath the
      text block. There is no ~260px band of bare photograph below the type.
- [ ] The dorsal sepal (topmost petal) of the flower is **fully visible**,
      not clipped by the SAOC site header above the hero.
- [ ] Lockup box is centred on the **full viewport width** — measure the gap
      from each screen edge to the visible ink; both sides should read
      ~18px, not ~18px from the 32px-gutter column edge (a subtly different,
      wider position than the pre-amendment version).
- [ ] Lockup-to-"The Flagship" gap reads as ~37px of visible ink-to-text
      clearance (target unchanged; mechanism changed to a flat 8px margin
      with no flex gap contribution).
- [ ] No new horizontal scroll/overflow introduced by the viewport-relative
      centring formula (`100vw - 25px`) at 375px and 320px, not just 390px.

### Cross-cutting

- [ ] Network tab: the `<source>` (vertical, mobile) request shows explicit
      `width`/`height` on the element (3272×2876) — inspect the DOM, not just
      the request — and no layout shift is visible on load at 390px (the
      point of the CLS fix in item 7).
- [ ] Re-confirm no purple/violet colour cast anywhere near the lockup or the
      photograph now that the source image has changed.

## Amendment 2026-09-29b (legibility)

Source: `.agent/memory/scratch/rulings-inbox/codi-hero-legibility-2026-09-29.md`,
ruling on `bce627a2`. RULING 1 (365px box / 38-40px ink inset) needs no new
check — the existing 390px checklist items above already cover it and nothing
changed. The items below are new, for RULING 2.

### `/national-show` at 1280px and 1714px

- [ ] Hero copy block (eyebrow, "Edition XIX", lede, the 4-fact `dl`, button
      row, "Opens in" + countdown) visibly stops at a narrower column than the
      1216px content column — it reads noticeably narrower than the lockup
      image box above it, not edge-to-edge with it.
- [ ] The `dl` still reads as 4 columns across inside that narrower block (or,
      if the fallback triggered, 2×2 — see the gated check below for which).
- [ ] No text glyph — including the venue line if it wraps — sits visibly past
      the point where the R10 scrim ramp goes light; nothing reads over bare
      unscrimmed photograph.
- [ ] Scrim itself is visually unchanged from the pre-amendment 1280/1714
      captures (same fade shape/stops) — only the text column got narrower.

### `/national-show` at 390px

- [ ] The scrim reads as one flat dark tint across the whole hero, not a
      left-to-right fade — no visible gradient edge/banding anywhere in the
      hero at this width.
- [ ] Photograph is still recognisably `orchid-dark.jpg`, full-bleed, same
      framing as the pre-amendment 390px capture (`68% 50%`) — only the scrim
      shape changed, not the photo.

### Gated acceptance (run the script, don't eyeball this one)

- [ ] `node scripts/checks/nos-hero-contrast.mjs` exits 0 against a live
      `pnpm dev` server. Attach its stdout table (per-element worst-case
      contrast ratio, floor, PASS/FAIL) to the sign-off request alongside the
      three screenshots — this is the "contrast table" Codi's ruling asks be
      resent with them.
- [ ] If any desktop `dl` cell fails at 720px/4-column, confirm the build was
      switched to 2×2 at desktop and the script was re-run (not just re-read)
      before claiming PASS.
