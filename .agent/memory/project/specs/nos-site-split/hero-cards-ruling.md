# Hero redo + card family (NOS Design, 2026-10-23, P0 from Brad)

> Relayed verbatim by SAOC from NOS Design (source copy: NOS Design workspace `.tmp/sandbox/nos-site-split/hero-cards-ruling.md`).

Root causes, measured on beta at 2056@2:
- The slides are served 2056px wide into a 4082-device-px box. The loader caps at 2048, so they're stretched about 2×. That's the blur.
- Three scrim layers put about 88% sage over the middle of the photo. That's the mud.
- The fade band was NOS Design's ruling (rHB/rHB2). It's withdrawn.

Heuristics: impeccable 4.4.0 critique (aesthetic and minimalist design, visibility, recognition), craft-floor (contrast AA, 44px targets, reduced motion), audit (performance: image delivery). Brad's two messages are the licence to extend the handoff, both for the hero composition and for the card styling.

## A. Hero (SAOC home; the NOS hub hero is held to the same bar)
A1. Image delivery.
- Add 2560, 3200 and 3840 to deviceSizes, and generate the matching _opt variants for the hero sources at q82 (webp) and an AVIF set if the generator supports it. The cap rises to 3840 for hero sources only. Other images keep 2048, to protect build time.
- Sanity slides: drop the hard urlFor(img).width(1600). Pass the bare Sanity URL to next/image so the loader writes w= per candidate. Add fit=max and respect the asset's hotspot through object-position.
- sizes="100vw" stays.
- Gate: at 2056@2 every slide's naturalWidth ≥ 3840, or ≥ the native width for a smaller source. A source under 3000px wide can't be a full-bleed slide.
- The NOS hub hero gets the same treatment. It's currently orchid-dark-2048 in a 1592-wide box, about 1.55× short.

A2. Image choice. Every slide needs a sharp focal subject at 100% zoom: crisp petals, not bokeh across the frame. Today's pink slide is soft throughout, and that reads as blur even at full resolution. NOS Site sends NOS Design a contact sheet of the current Sanity slides and the four handoff sources (violet 7327, purple 5308, dark 5184, pink 3456 portrait), each at 100% crop, and NOS Design picks by eye. Nothing new is invented or bought.

A3. Composition: left-aligned copy, photo kept vivid. Centred copy over the middle of the photo forces a wash over the subject. So:
- Copy (eyebrow, h1, lede, CTAs) is left-aligned in the 1280 container, in a column of max-width 640px.
- Each slide gets an object-position (hotspot) that puts the bloom in the right-hand 55%.
- The NOS hub hero already works this way, so the two sites match.

A4. Scrim: localised, not a wash.
- Delete the diagonal, veil and bone layers.
- Replace them with one layer: linear-gradient(90deg, rgb(34 40 31/.88) 0%, rgb(34 40 31/.82) 48%, rgb(34 40 31/.32) 64%, transparent 76%). At 2056 the copy spans about 22–53% of the width, so every glyph sits on at least .80.
- The right-hand 30% of the frame has no scrim at all.
- Add a bottom shade (linear-gradient(to top, rgb(34 40 31/.35), transparent 30%)) only if the controls need it.
- Below 768 the copy covers the full width. Use linear-gradient(to top, rgb(34 40 31/.88) 0%, rgb(34 40 31/.7) 45%, rgb(34 40 31/.15) 80%) with the copy anchored at the bottom, so the bloom stays clear above it.

A5. No fade band. The hero ends on a hard, clean edge straight onto the parchment section, with no gradient at any width.

A6. Type.
- h1 per handoff: clamp(48px,7.4vw,96px), lh 1.02, ls −0.02em, ivory.
- The italic "orchid culture" stays --accent-soft #c2b393. It's large text, so AA needs 3:1. Worst case, with a pure-white photo pixel under the .80 scrim, it computes to 3.81:1. The 20px ivory lede computes to 7.08:1 in the same worst case.
- Gate: sample the lightest pixel under each glyph, per slide. The italic must be ≥3:1 and the lede ≥4.5:1.
- No text-shadow, blur or filter. Use -webkit-font-smoothing: antialiased on the dark ground only.

A7. Motion: the handoff timings plus one gentle extension.
- Crossfade 1400ms opacity with --ease. The interval goes from 5.5s to 7s.
- A slow drift on the active slide: scale 1.0→1.04 over 8s, linear, with transform and opacity only and will-change set only while it runs.
- Under prefers-reduced-motion: no drift, no autoplay, slide 1 static, controls hidden.

A8. Controls out of the composition.
- Pause/Play and the indicators move to the hero's bottom-right corner, 32px in from the container edge, so they no longer sit under the CTAs.
- Pause becomes a 44×44 icon button with aria-label Pause/Play and a 1px ivory/40 ring, keeping the visible focus ring.
- The indicators become four 28×2 tracks. The active one fills brass over the interval, as a progress line. Each keeps its 44px hit area.
- DOM order is unchanged (WCAG 2.2.2).

A9. Height: min-height min(88vh, 860px), with a floor of 600px.

## B. Card family: "Four ways into SAOC", and the sibling cards on NOS
Brad: "rounded corners, offset bevel shadows … pretty, elegant, like an orchid." The palette and type tokens stay the same. This extends the handoff's --radius-0 for cards only.

B1. Shape.
- Add a new token, --radius-card: 16px, on both sites. NOS panels are already 14px.
- The photo well is clipped by the card (overflow hidden).
- SAOC buttons keep 2px.

B2. The orchid "offset bevel": a ::before plate the size of the card, translated 10px right and 10px down, radius 16.
- SAOC plate: --bone with a 1px --rule border.
- NOS plate: --nc-royal at .10 on cream.
- On the card, one soft layered shadow: 0 1px 2px rgb(34 40 31/.05), 0 14px 32px -12px rgb(34 40 31/.18).
- That's the one elegant move: a petal echo behind the card. No glows, gradients or glass.

B3. Photo.
- Aspect 4/5.
- sizes "(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw".
- Gate: naturalWidth ≥ 2× the box width.

B4. Tag chip: a pill (--radius-pill).
- --parchment at 92% with a 6px backdrop blur (the only blur allowed, and on the chip only).
- --primary text, mono 11px, 0.18em tracking, uppercase, 6px 12px padding, inset 14px.
- NOS: cream chip with --nc-royal text.

B5. Body.
- 24px padding: serif title, muted body, then a meta row.
- Remove the hairline above the arrow; the meta row separates by space alone.
- The arrow sits in a 36px circle with a 1px --accent ring.

B6. Hover and focus.
- The card lifts 4px while the plate stays put, so the offset opens from 10 to 14px.
- The photo scales 1.0→1.05 inside its frame. The arrow circle fills brass and the arrow moves 3px right.
- Timing: 250ms --ease, on transform, box-shadow and background-colour only.
- :focus-visible: the same lift, plus a 2px --accent outline at 3px offset.
- Reduced motion: colour change only.

B7. Grid.
- 4-up at ≥1024 with a 28px gap, 2-up at ≥640, 1-up below.
- The section gets 10px more bottom padding to clear the plates.

B8. NOS siblings: the same B1–B7 on every card grid on the NOS home, in NOS tokens (cream card, royal type, gold arrow ring, royal-tint plate). The "Planning a visit" route rows stay rows.

## C. NOS Design's render check (2056@2, 1440, 1280, 390)
- naturalWidth per slide and per card.
- The per-glyph contrast gate.
- The unscrimmed right 30%.
- A frame-by-frame check of the crossfade and drift, plus reduced motion.
- The hover, focus and offset plates.
- A by-eye comparison against the beta shot Brad rejected.

## Standing what-not-to-do (both sites)
- Blurry or upscaled photos: any slide or card with naturalWidth under the device-pixel box.
- Full-wash scrims over the subject.
- Fade-out bands into the next section.
- Text effects (shadow, blur, glow) used to rescue contrast.
