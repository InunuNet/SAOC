# nos-critique-r12 F5 [P1 → guard]: one header and one footer lockup per fresh load

Source: Codi's report (lead 2026-10-18). On phones, both art-directed lockups at ≤700 appeared to download: header 828 + 1080, footer vertical 750 + horizontal 1080, about 62KB. BASE main 26fde668.

## Cause: not a defect on a real load

- **Dev's measurements** (.agent/memory/scratch/measure-26f/: summary.txt, results.json, resize.json) cover fresh loads at:
  - 390 at DPR 1, 2 and 3;
  - 405 at DPR 2;
  - 700, 701 and 1280.

  Each gives exactly one header and one footer request, from the correct source. There is no preload and no re-mount.
- **Where Codi's set comes from.** The set {1080, 828, 750} appears only when the page loads at 1280 (DPR 2) and is then resized to 405. That is standard <picture> re-selection: the wide files are already loaded, and the narrow sources are fetched on resize. Codi's tooling did exactly this, an iframe/device-toggle resize, so the report came from the measurement method, not from what phones download.
- **Architect run.** f5-rendered on 26fde668 in Chromium, with phone emulation (isMobile, hasTouch, device-width viewport) and fresh contexts, PASSES.

## Decision (lead ruling 2026-10-18): regression guard only

- **No app code.** goldens/f5-footprint.json is empty, so F5 contributes nothing to the allowlist; only checks and docs move.
- **Which build.** f5-rendered must PASS at 26fde668 and at the r12 tip. There is no negative test at BASE, because there is no defect.
- **Contexts.** f5-rendered runs in Chromium, public mode, on /national-show and /national-show/tickets, with a fresh context each:
  - 390 as a phone at DPR 1, 2 and 3;
  - 405 as a phone at DPR 2;
  - 1280 at DPR 1 and 2;
  - 699, 700 and 701 at DPR 1 and 2.
- **What each context must show** after a full scroll and network idle:
  - exactly ONE header (full-colour) and ONE footer (reversed) lockup request, counted on the request, so an abandoned fetch still counts;
  - never an original PNG;
  - art direction: the header narrow `<source>` at ≤699, the footer vertical at ≤700, and the other variant never requested;
  - the requested file is the displayed one (currentSrc);
  - r9's 2x cap (header 1080/828, footer 1080/750; a candidate ≥2x its box at DPR ≥2).

  Bytes are REPORT lines. r9's 80KB DPR-1 budget stays r9's.

## Logged, not gated: post-launch investigation

Both lockup `<img>` elements carry `src` = the 1080 candidate as the no-srcset fallback. An engine whose preload scanner fetched `src` before the `<picture>` selection would show exactly Codi's set. Nobody has observed that on a real load, and WebKit is not installed here; installing it writes to ~/Library/Caches, outside the project, and the operator is away. It is a post-launch check on a real iPhone. A possible mitigation is pointing `src` at the 1x candidate.
