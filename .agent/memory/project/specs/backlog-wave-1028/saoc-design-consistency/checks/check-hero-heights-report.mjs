// F1c A8 (NOS Design HM-8 ruling, amended): the same hero-band gate as A2 at 1024 and 1280. Photographic heroes (/about, /judging, /sponsors) 480 +-4, /about included (14ch facts band accepted by eye);
// typographic heroes size to content: band = copy + 2 x clamp(64px, 6vw, 96px) +-2. Prints a REPORT line per width. See lib-hero-bands.mjs.
import { withSite, finish } from './lib.mjs';
import { gateWidths } from './lib-hero-bands.mjs';
await withSite((site) => gateWidths(site, [1024, 1280]));
finish('hero-heights-report');
