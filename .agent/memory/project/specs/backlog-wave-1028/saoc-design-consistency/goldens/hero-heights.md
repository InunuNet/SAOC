# SA-6 inner PageHero heights (origin/main 48d74378, Chromium, localhost, fixture mode)

Source: `.tmp/sandbox/dc/measure-heroes2.mjs`. `[data-page-hero]` bounding height in px. Non-exempt routes: /about /judging /sponsors /members /memorandum-of-incorporation /privacy /terms /refunds.

| width | /about | all other non-exempt | spread |
|---|---|---|---|
| 768 | 480 | 480 | 0 |
| 1024 | 496 | 480 | 16 (FAIL) |
| 1280 | 545 | 480 | 65 (FAIL) |
| 1440 | 480 | 480 | 0 |
| 2056 | 480 | 480 | 0 |

LOCKED values for NOS Design: **1440 -> 480, 2056 -> 480** (md min-h 480, `HERO_MIN_HEIGHT_CLASS` in components/ui/PageHero.tsx). Exempt routes (Events list, Societies grid, Contact) also measure 480 at every wide width.

Cause of the failures: /about carries `dl[data-hero-facts]`; at 1024 and 1280 the 48% copy column is narrow enough that h1 + lede + facts exceed 480, so min-height is overridden. Fix by equal anatomy (facts layout and h1 scale fit the 480 box at every width 768-2056), never by per-route padding or per-route height. The copy block padding (py-16 md+) is identical across routes today and must stay so (the check asserts it).

Below 768 (stacked: 2/1 photo band + copy on sage) height is content-driven and varies by anatomy at 390: /about 577, /judging 434, /sponsors 484, /members 271, MOI 168, /privacy 238, /terms 168, /refunds 168. Typographic routes have no band and no lede/facts. Equal anatomy cannot be forced there without inventing copy or imagery. NOT gated; reported as a gap for NOS Design (see report).

/media-kit has no PageHero at all (measured `data-page-hero` absent at every width) and is not in the ruled exception list. Gap, not asserted.

## NOS Design confirmation (2026-10-28, relayed by team-lead)
- LOCKED: 480 +-4 at 1440 and at 2056 across the 8 non-exempt routes (check-hero-heights A2).
- 1024 and 1280: report-only (A8, check-hero-heights-report.mjs) after the /about facts-dl fix; NOS Design locks them once all 8 routes agree within +-4.
- Mobile (<768): no equal-height gate (content-driven). Gated instead (A7, check-hero-mobile-anatomy.mjs): the photo band uses one aspect-ratio on every route, currently `aspect-[2/1]` in components/ui/PageHero.tsx (media wrapper), and the copy block uses one padding on every route, currently `py-10` (40px) below 768 and `md:py-16` from 768 (both with `px-[var(--container-pad)]`).
- /media-kit joins the exception list with Home, Events list, Societies grid, Contact and 404: it is a gated tool page with a typographic header and no photo hero. It is not asserted to have a PageHero.
Honesty note: on main the hero-height lock and the mobile-anatomy gate already pass (480 at 1440/2056; 2/1 and 40px everywhere); only the 1024/1280 report shows the /about defect (496, 545). They are locks and guards, not red-on-main checks. F1c's red-on-main assertion is the h2 role check (A1).

## NOS Design ruling "SA-6: /about hero at 1024 and 1280" (2026-10-28)
Ruling: /about is 480 +-4 at 1024 and 1280 through one facts row, no copy change, no facts moved out of the hero. Cause (553fe5e9): the copy column is 48% (about 570px at 1280, 450px at 1024); the three facts need about 600px (dt 26ch, gap 40, dd 32px), so the row wraps to 545 and 496.
Levers, global in `.hero-facts` at 768-1439, in this order, never per route: (1) column gap 40 to 24; (2) dt max-width 26ch to 18ch, balanced, <=3 lines; (3) dd floor 24px at 1024 with the weight band (300 at >=32px, 400 at 24-31.99; today dd is 300 at every size, fixed on every SAOC hero regardless); (4) dd nowrap.
Not allowed: widening the 48% copy column or shrinking the scrim (clear to 44%, full by 52%, alpha 0.8).
Gate: A9 (one row, no overflow, levers, column and scrim unchanged), A10 (weight band), A11 (global only), A8 (the lock; prints CASE A or CASE B).
Current main CSS (app/globals.css .hero-facts): gap `20px 40px` (24px 40px from 640), dt max-width 26ch, dd clamp(1.5rem, 1.2rem + 1vw, 2rem) at weight 300, no nowrap.
