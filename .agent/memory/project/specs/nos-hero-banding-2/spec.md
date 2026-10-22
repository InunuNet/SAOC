# nos-hero-banding-2 (rHB2): the home hero's parchment pull, smootherstep

Mission nos-hero-banding-2, M1/F1. BASE origin/main c6702259 (rPL, #34). Branch fix/hero-banding-2.

## Report

Brad, from his own browser: the SAOC home hero still bands after rHB (#27) and rPL (#34). His capture
(`goldens/fixtures/brad-slide3.png`, 2000x489, DPR 1) is beta preview, slide 3 of 4 (the violet orchid, asset 1adbddbb). It shows
visible steps in the bottom ~100-150px, where the parchment pull runs from purple to ivory.

## Root cause (architect, measured)

- The pull was piecewise linear in alpha: C0 continuous, but with slope breaks at its stops, and it arrived on parchment at full slope.
  Rendered alone over a flat violet it reproduces both lines Brad sees, across the full width. The L* slope breaks are 0.41/px at the
  seam (slope ~0.45 -> 0) and 0.18/px at the 24px stop. Brad's PNG reads 0.48 and 0.18 at the same rows. Those are Mach bands.
- The veil and the diagonal measure <= 0.02 on their own. The photo's own texture breaks are local only. No 8-bit quantisation: Brad's
  per-column code runs are 1-4 px.
- The parchment over saturated violet passes near neutral (OKLCH C 0.042 -> 0.005, hue 315 -> 99) close to parchment (L 0.88-0.92).
  It reads as a grey-lilac band only because the Mach lines frame it.
- Why rHB/rPL passed it: R2 bounded row-mean C0 steps, and a slope break has no step. Brad's PNG reads smoothed 2.10-2.66 against a
  limit of 4.3. R3 bounded the seam's value, not its slope. R7 bounded joints only at the top and at >= 46px, exempting the 16/24px joint
  and the seam. No viewport went above 1920.

## Rulings (verbatim)

Codi, first ruling (2026-10-22):

> Reproduced in Canary at 2056 CSS px, DPR 2: slide 3 goes violet → flat grey-lilac stripe → parchment, and slide 4 has the same fog band. My 1280 PASS was too narrow.
> Cause: (a) the pull is a fixed 126px while the hero is 850px tall at 2056; (b) the alpha slope isn't monotonic (0.0075/px on 0–24, then 0.0107 on 24–54, a 43% jump, then falling), and those kinks are Mach bands; (c) parchment alpha over saturated violet passes through grey.
> Ruling on the options, before you send them: oklab alone won't fix it (single-colour alpha stops, sRGB compositing). A mask fade is the same blend. Dither stays out unless you show me, because it fixes quantisation, not Mach bands.
> REQUIRED: (1) a smooth ease with continuous, monotonic slope (smootherstep at ≥12 stops, no adjacent-segment slope change >20%); (2) height clamp(126px, 9vw, 220px), about 185px at 2056; (3) end exactly on --parchment rgb(244,243,236). Only if grey still shows: one short mid-pull tint toward the slide's own dark veil hue, with screenshots.
> Accept: 4 slides × {1280@1, 2056@2, 390@3} screenshots, no stripe or step by eye (I'll check in Canary), a column luminance profile with no slope jump >25% per 4px, and no seam with the next section. (craft-floor gradients, H8)

Codi, contract locks:

> C1 at both ends and at every stop joint, not just row-mean steps. Zero-slope entry from the photo at the top and zero-slope arrival on parchment at the seam. Fail on any adjacent-4px slope change >25%, or a seam slope >0.05 L*/px.
> The sweep includes 2056@2 and 2560@1 for all 4 slides, plus 390@3.
> The failing fixture is preview slide 3 at 2056@2 (good). Keep it as the regression guard.

saoc-82: the check must FAIL on current main at 2056@2 and on Brad's case (the replica of brad-slide3.png counts); a contract
assertion runs `pnpm exec prettier --check` on every touched file; saoc-82 merges the PR.

Codi, final ruling on the height (after the architect measured the clamp putting the pager dots at 1.0-1.93:1 at >= 2000px, against
2.59-3.17:1 on c6702259):

> (B). A fixed 126px with 24-segment smootherstep, and the clamp dropped. It meets every C1 lock, adds no colour, and makes the dots no worse. Conditions: 1. My by-eye gate is final. I'll check slide 3 and 4 at 2056@2 in Canary. If 0.33 is still visible as a line, we reopen with a dot change rather than more pull tuning. 2. Contract floor as you wrote it: dots ≥ min(3, today's value) on every slide and width, copy ≥5.57:1, seam slope 0. 3. New P2, separate ticket, not this round: the pager dots are already below 3:1 ...

REQUIRED (2), the clamp, is withdrawn by that ruling. The pager dots P2 is out of scope here; the lead logs it separately.

## What @dev implements

One rule in `app/globals.css`: `[data-hero-scrim='bone']` becomes exactly `goldens/pull.css`. That is a 24-segment smootherstep
(25 stops, alpha = 1 - (6p^5 - 15p^4 + 10p^3), p = distance above the seam / 126px). It starts on `var(--parchment)` at 0% and ends on
alpha 0 at 100%, and every stop is `rgb(244 243 236 / a)`, so there is no new colour. The tile is sized `100% 126px`, anchored
`bottom`, `no-repeat`.
- Why a sized background tile (not a pseudo-element or a new element): the stops are percentages of the tile, so they scale with
  whatever height the tile has (a later height change is one value). There is no DOM or Hero.tsx change and no new stacking context.
  The aria-hidden layer stays as it is. The element is still `absolute inset-0`, and the tile paints only its bottom 126px.
- Update the comment above the rule (it describes rPL's stops) to say rHB2: smootherstep, 24 segments, 126px, C1 at both ends; Codi
  2026-10-22. Leave the veil and the diagonal alone.
- `docs/nos-hero-banding.md`: add an rHB2 section with the cause (Mach bands at the stop joints and the seam), the fix, and why the
  clamp was dropped (the pager dots).
- Nothing else. Do not touch any check, golden or fixture (hash-locked).

## Checks (QA inputs; @dev must not edit)

- `checks/static.mjs`: footprint, the rule equals the golden, the veil/diagonal unchanged, the golden's own maths (smootherstep,
  unimodal slope, adjacent slope change <= 0.2 of peak, parchment only).
- `checks/brad.mjs`: the new metric flags Brad's own capture (check of the check).
- `checks/rendered.mjs`: P1 full-width slope break (block median) and seam slope over the photo, P2 seam, P3 the pull alone (4px slope
  jump <= 0.25 of peak, seam slope), P4 the pull's profile against the golden alpha, P5 copy, P6 dots, P7 slides. `--guard` re-injects
  c6702259's pull on preview 2056@2 slide 1adbddbb and must still FAIL there.
- `checks/shots.mjs`: Codi's shot set (preview, 4 slides × 1280@1, 2056@2, 2560@1, 390@3, hero bottom + 80px) into
  `.tmp/sandbox/hb2-out/`. Not an assertion: Codi's eye in Canary is the final gate.
