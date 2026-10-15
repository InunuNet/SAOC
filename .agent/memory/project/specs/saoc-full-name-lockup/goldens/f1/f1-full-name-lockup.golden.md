# Golden: SAOC lockup with the full name (saoc-full-name-lockup F1)

Instruction (Lee-Ann, relayed by Brad 2026-10-15), verbatim: "use the SAOC Branding logo with the full name South African Orchid Council".

## Source of truth (docs/rules/no-invention.md)
Brad's approved lockup explorer, `scripts/lockup-export-harness/app.js`.
`WORDMARKS` (line 36 region): W1 'SA Orchid Council' is index 0 (state `WM:0`, the
default the site shipped); W2 'South African Orchid Council' is index 1 (`WM:1`).
NOTE the id/index off-by-one: "W0" in conversation = id W1 = index 0. The change is
`WM:0 -> WM:1`. W2 has no second line (`.b` undefined), so `metrics()` n2 = 0 and
ruleH is unchanged.

## Parameters that MUST NOT change (state at app.js:46)
P:2 palette P3 "Lapis & Sun" (name #172a5c / tag #5a5f70 / rule #c9a200; dark
#fbf8ea / #f0d35a / rgba(255,255,255,0.35)); N:7 Lora nw:500; F:0 JetBrains Mono
fw:500; T:0 tagline "Making a difference since 1968"; rule:true rs:100;
es:140 ns:110 tsz:140. Every literal px class in SaocLockup.tsx stays (A3 lists them).

## Decision: header and mobile drawer use the PNG route (regenerated at W2)
- Header.tsx and MobileMenu.tsx keep the raster; regenerate it from the harness at
  WM:1 via `scripts/export-saoc-lockup.mjs` (add `WM:1` to HORIZONTAL; add a `WM`
  query-param line to `scripts/lockup-export-harness/index.html` beside the E/G/
  transparent lines; add `SAOC_LOCKUP_OUT_DIR` env override for the output dir).
  app.js is NOT edited. Never switch the header to live SaocLockup: Header.tsx's own
  comment records that the live version widened the zone enough to wrap the primary
  nav at 1280px, and W2 widens the wordmark ~1.6x again. The raster reproduces the
  artifact exactly with no new sizing decisions inside the lockup itself.
- New filename `public/images/saoc-lockup-horizontal-full-name.png`; delete the W0
  `saoc-lockup-horizontal.png`. Same-URL replacement would be served stale by the
  next/image optimiser cache and the App Hosting CDN. The vertical-dark PNG the
  exporter also writes is untracked and unreferenced (footer uses the live
  lockup): do not stage it. Write the exporter's vertical variant with WM:1 too, for
  consistency, but do not commit its output.
- Display sizing is the only judgement left to dev; assertion A8 arbitrates.
  Starting points. The PNG aspect will be ~7.5-8 (was 5.507), so at the old 64px
  height the lockup would be ~490px wide and starve the nav at >=1240px.
  Keep the SAME box height-driven logic: <640px ~190px wide (drawer: ~210 wide,
  height from the aspect, never distorted); 640-1239px (hamburger mode, plenty of
  room) up to ~460px wide; >=1240px (inline nav) constrain to <=380px wide so the
  nav does not wrap (it was 352 with W0). Header <Image> width/height props must
  carry the PNG's true aspect (A5). The logo link must be `shrink` (min-w-0) at
  <=390px so 360px viewports do not overflow.
- Header/MobileMenu comments must be updated to say W2 and the new filename.

## Footer (live SaocLockup, vertical)
Only `WORDMARK` changes, plus whatever is needed so the ~1.6x wider wordmark never
wraps, clips or overflows its footer column at any width. The artifact itself does
this with `data-fit` (shrink-to-parent: zoom = min(1, parentWidth / contentWidth));
reproduce that in CSS (e.g. parent `[container-type:inline-size]`, wordmark font-size
`min(30px, <n>cqw)`) rather than choosing a smaller fixed size. Emblem 166x160,
rule 133px, tagline 9px stay literal. Desktop/narrow horizontal tiers in
SaocLockup.tsx stay literal (currently unused by Header; keep working).

## Other user-visible 'SA Orchid Council' uses (grep of app/ components/ lib/ sanity/ public/ emails)
None beyond the three above: `SaocLockup.tsx` (WORDMARK + header comment),
`Header.tsx`, `MobileMenu.tsx`. Already full-name and unchanged: `app/layout.tsx`
(metadata/OG), `app/og/route.tsx` (renders text 'South African Orchid Council'),
`ACCESSIBLE_LABEL`, Header aria-label, MobileMenu alt. The media-kit emblem download
is emblem-only (no wordmark). `/downloads/media-kit/*` and `public/images/nos/lockup/*`
(National Show lockups) are out of scope.

## Accessible label (unchanged)
`South African Orchid Council — Making a difference since 1968` (Header, SaocLockup);
MobileMenu alt `South African Orchid Council`.

## Execution notes for the checks
Branch `fix/saoc-full-name-lockup` from `integ/vendor-flow-fixes` (f5622860), in a
worktree. A7 needs network (web fonts). A8 needs `pnpm build && pnpm start -p 3002`
in that worktree (or BASE_URL).
