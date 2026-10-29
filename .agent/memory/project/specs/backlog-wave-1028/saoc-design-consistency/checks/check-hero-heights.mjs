// F1c A2 (SA-6, NOS Design HM-8 ruling): hero band lock at 768, 1440 and 2056. 768: all 8 routes 480 +-4 (unchanged, typographic keep their 480 minimum). 1440 and 2056: the 480 +-4 lock holds for the photographic heroes only
// (/about, /judging, /sponsors); typographic heroes size to content: band = copy + 2 x clamp(64px, 6vw, 96px) +-2. See lib-hero-bands.mjs. 1024 and 1280 are A8 (check-hero-heights-report.mjs).
import { withSite, finish } from './lib.mjs';
import { gateWidths } from './lib-hero-bands.mjs';
await withSite((site) => gateWidths(site, [768, 1440, 2056]));
finish('hero-heights');
