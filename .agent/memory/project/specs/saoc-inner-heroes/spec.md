# saoc-inner-heroes: NOS Design rulings, re-targeted (2026-10-26)

Base: NOS Site's spec `spec-base.md` (origin/spec/saoc-pagehero-mirror at 70068980: D1-D11, file plan, gates). This file is the delta. Where the two differ, the NOS Design rulings of 2026-10-26 (comms.md "#109 beta pass: hero FAIL (HM-2..4)") win.

## Re-targeting
- Per-route photograph, position and typographic flag live in `lib/data/saoc-hero-photos.ts`, applied by `components/ui/RouteHero.tsx`. Pages are not edited for crop. `RouteHero.tsx` passes `imagePosition` to PageHero; with no `src` (typographic) it renders `variant="type"`.
- `RouteHero.module.css`: delete the `--hero-src-w` width cap and the `translate: -50% 0` re-centre (HM-1: no native-cap exception; every source now meets box x DPR).
- PageHero is shared: change it only for the D1 markup, D2 left-aligned copy from 52% at >=768, D3 local scrim, D4 2/1 band below 768, D5 solid ivory lede, D6 aspect-derived `sizes`, optional eyebrow.
- Build-time derived cuts only (D8): `lib/hero-derived-sources.json` + `scripts/generate-image-variants.mjs` with sharp `.flop()`. No CSS flip. `@0/40` = object-position `0% 40%`.
- Typographic ground is solid `--primary-800` = sage rgb(34 40 31) (the same colour; spec.md of the base says "sage" and "--primary-800" interchangeably, consistent).

## Conflicts resolved for the 10-26 table
1. Copy contrast: base had eyebrow and h1 >= 3, lede >= 4.5. 10-26: copy >= 4.5. Golden thresholds set to 4.5 for all.
2. Gate environment: base ran with the beta wall up. 10-26 brief: SANITY_FIXTURE_MODE=replay and BETA_PASSWORD_WALL_OFF=true. `_lib.mjs` sets both; its dummy basic-auth values are unchanged and never point at real beta.
3. Legal pages: base typographic hero had an eyebrow. LG-RF: no eyebrow. Legal pages pass no eyebrow (LegalHero must not forward it on the SAOC branch).
4. Route name: base `/constitution`; main serves `/memorandum-of-incorporation`.
5. Base rules per-page `image`/`imagePosition` props; on main they are in saoc-hero-photos.ts, so the diff-scope and static checks were retargeted.
6. The six ruled routes (/judging, /societies, /events, /sponsors, /contact, /about) match the 10-26 table exactly (rects, flips, positions).

## Rulings in the base not re-ruled on 10-26 (kept, flagged)
/societies/[slug] violet cut `0,400-4112,2600 @0% 50%`; /media-kit and /memorandum-of-incorporation typographic; HS-1 home carousel (dark then orchid-purple-home); ShowBand G9 dark cut and 42/58 event split; /about PhotoBand purple band cut. The lead keeps all of these in this contract (SAOC owns all of HM-1).

## Open gaps (gated on HM-2, HM-3 and overflow only)
/404, /events/[slug], /events/submit crops. LG-RF h2-gap measurement point (see gate-lgrf.mjs header).
