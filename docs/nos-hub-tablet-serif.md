# NOS hub tablet order and light display serifs

Mission `nos-hub-tablet-serif`, spec `.agent/memory/project/specs/nos-hub-tablet-serif/`. Two NOS Design rulings, both css-only in `app/(nos)/national-show/nos-theme.css` and `nos-structure.css`.

## H-a (P2): the hub at 768-1023px

Ruling: "768-1023 hub stacks copy-first -> photo-last as a 4:3 block 565px tall ... At 390 the photo is first (R74), so the stacked layouts disagree. Fix: at 768-1023 use the same order as 390, photo first, as a 2/1 band (the same ratio as the inner-page G2 band), then copy."

- Cause: the `max-width: 1023px` stacked block gave the hub media `order: 2` and `aspect-ratio: 4 / 3`. Below 768px a later block already overrides to `order: -1` and a 300px band, so 768-1023 was the only width where the photo came last.
- Change: in that block, `order: -1` and `aspect-ratio: 2 / 1`. The 2/1 ratio is the inner-page G2 band (`nos-theme.css`, `aspect-ratio: 2 / 1`). Nothing else in the hub rules changed; 1024px and wider and below 768px are untouched.
- Hero height (production build, live Sanity), measured by the A10 gate at 49e3b776: 906px at 768, 937px at 820, 1057px at 1023. The architect's trial build measured 902px at 768; the 4px difference is between two renders, not a change. NOS Design approved a cap of 1100px at every width in 768-1023 with no spacing change.
- Served image: `NosHero` serves `/images/orchid-dark.jpg` with `sizes="100vw"`. Decoded width is 1920 for the 768@2 box (1536 needed), 1920 for 820@2 (1640) and 2048 for 1023@2 (2046). No asset change. The 2048 variant at 1023@2 has a 2px margin.
- Focal point: `--nos-hero-pos` is already inline on the media element, so the 2/1 crop keeps the same focal point as 390.
- Guard: `e2e/nos-hub-tablet-order.spec.ts` measures the photo above the h1 at 768, 1023 and 390, and a 2:1 box within 1% at 768 and 1023.

## LT-1 (P2): light display serifs

Ruling: Brad 10-23, "light display serifs, 300 at >=32px". Any display-serif heading computed at 32px or more has weight 300, set globally rather than per page. Below 32px (h3s at 20-22px) stays 400.

Why the weight was 400: `.nos-theme :is(h1..h6) { font-weight: 400 }` is unlayered and beats every Tailwind weight utility, so `font-light` on section h2s never took effect inside `.nos-theme`.

The rule:

1. `font-weight: 300` inside the existing `.nos-theme h2` rule. Its size clamp floors at 2rem, so every `.nos-theme h2` is 32px or more. It is deliberately not a separate `h2:not(...)` rule: that selector would outrank the class rules that give the sans eyebrow h2s their own weight.
2. `font-weight: 400` restated in the two h2 rules with a sub-32px size: `.nos-card-title` (22px) and `.nk-attendees-title` (24px, `nos-structure.css`).
3. `@media (min-width: 889px)`: `.nos-opsz-fluid` headings (`clamp(28px, 3.6vw, 44px)`) take 300. They reach 32px at 889px.
4. `.nos-theme .nk-head h2` in `nos-structure.css`: 400 to 300.

The h3-h6 base stays 400. The Fraunces face is the variable file (`weight: '100 900'`), so no font file was added.

## Sweep result

The gate is `gate-lt1-sweep.mjs` in the spec's `checks/`. It sweeps every NOS route (required, conditional and discovered) at 1280, 390, 888 and 889 against the production build. Result, run on 49e3b776: 32 routes at each of the 4 widths, 351 display-serif records at 32px or more (all weight 300), 251 serif records under 32px (all weight 400), no Karla heading at weight 300, 0 failures. `/archive` (404, no visible past shows) and `/media-kit` (redirects to the admin login) are reported as NOT SWEPT with reasons. The fluid step is witnessed by the 404 h1 at 888px (31.968px, 400) and 889px (32.004px, 300). The full list is gate evidence outside this PR's diff, in the untracked spec directory of the primary checkout: `.agent/memory/project/specs/nos-hub-tablet-serif/evidence/lt1-sweep.json`. It is not committed to the repo.

## Follow-ups

- If NOS Design wants the hub hero nearer 1000px at 1023px, it needs a change to the hero copy spacing, which the ruling does not cover.
- The sweep is a gate script, not a CI step. The permanent CI guard is the hub order spec only.

## Also in this change

- HB-3: `NosHero` declares the hub photo `sizes` per band from named constants (`max(100vw, 450px)` up to 767px, `100vw` from 768 to 1023, `max(100vw, 1230px)` from 1024px), so the served width covers the painted box.
- TK-404: `app/(nos)/tickets/[slug]/layout.tsx` resolves the ticket type (shared with the page through `lib/data/ticket-type-lookup.ts`) before the shell flushes, so an unknown or hidden-demo slug answers a real 404 despite `loading.tsx`.
- TL-1 (amended): the ticket loader's lede is two `aria-hidden` 1lh boxes, each holding a 0.55lh bar (100% and 70% wide) in the lede colour at 15%, no bone, no pulse.
- TL-2a: below 768px the current-page crumb on `.nk-crumbs` truncates to one line with a CSS ellipsis; the full name stays in the DOM.
