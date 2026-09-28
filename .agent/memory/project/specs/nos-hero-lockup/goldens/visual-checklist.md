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
