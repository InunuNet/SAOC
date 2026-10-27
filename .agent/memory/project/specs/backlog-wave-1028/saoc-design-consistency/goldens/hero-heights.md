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
