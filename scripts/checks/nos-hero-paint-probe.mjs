// =============================================================================
// scripts/checks/nos-hero-paint-probe.mjs — gated cold-load paint check for
// the /national-show hero's h1 lockup image (nos-hero-lockup F2, item 9).
//
// Spec: .agent/memory/project/specs/nos-hero-lockup/goldens/f2-page-deltas.md
// §7. Codi's audit found the h1 lockup failed to paint in 6/7, then 7/8, cold
// foreground automated loads. Escalated from a one-time diagnostic to a real
// gate: this script is that gate, re-run on every future change to the hero.
//
// Method: N=8 loads per viewport, each a FRESH browser context (a real cold
// load, never a warm reuse) with the network cache disabled via CDP, in a
// real FOREGROUND browser window (`headless: false`) — the golden specifies
// a foreground load and a background-tab paint artefact was the original
// artefact theory, so a headless run (which never has a background/foreground
// distinction at all) cannot stand in for it. If this ever has to run
// somewhere with no display server, that is a real limitation to report, not
// something to silently paper over with `headless: true`.
//
// Per load: wait for document.fonts.ready and the lockup <img>'s naturalWidth
// > 0, then take TWO screenshots of the <img>'s own box — once as rendered,
// once with the same <img> set to `visibility: hidden` (layout unchanged,
// nothing else on the page touched) — and diff them. A pixel comparison
// against a uniform-fill check alone is not enough: the box also contains the
// hero photo + scrim behind the <img>, which is never a uniform fill, so a
// transparent-PNG lockup that failed to paint at all would still "pass" a
// bare uniform-fill check (the false-pass QA caught). Hiding the <img> and
// diffing isolates exactly the pixels the <img> itself is responsible for,
// regardless of what is behind it. The comparison is scored only inside the
// artwork's own ink region — its alpha bounding box, read once from the
// served PNG masters and scaled into the rendered box's CSS coordinates —
// so a mostly-transparent lockup (this artwork has wide clear-space margins)
// doesn't get diluted by counting its own transparent margin as "no diff".
//
// Reuses nos-hero-contrast.mjs's reachability probe and SKIP-as-fail
// convention (F1, hero-structure.md §10) rather than inventing new tooling.
//
// Usage: node scripts/checks/nos-hero-paint-probe.mjs
//   env NOS_HERO_CONTRAST_URL      default http://localhost:3002/national-show
//   env NOS_HERO_PAINT_NEGCTL      negative control only: forces the lockup
//                                  invisible (opacity 0) before the "as
//                                  loaded" screenshot, so the probe must
//                                  report a miss. Never set in the gate.
// Exit: 0 only if every load at every viewport painted · 1 with the table on
// any miss (also the diagnosis report, not just the gate's own output).
// =============================================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const DEFAULT_URL = 'http://localhost:3002/national-show';
const REACHABILITY_TIMEOUT_MS = 3_000;
const NAV_TIMEOUT_MS = 60_000;
const IMG_READY_TIMEOUT_MS = 15_000;
const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
];
const LOADS_PER_VIEWPORT = 8;
const LOCKUP_SELECTOR = '[data-nos-hero-lockup] img';
// The Next.js dev-tools badge floats over the hero's bottom-left corner in dev.
const HIDE_DEV_OVERLAY_CSS = 'nextjs-portal { display: none !important; }';
const NEGCTL_ENV = 'NOS_HERO_PAINT_NEGCTL';

// Local masters HeroLockup() actually serves at each viewport (page.tsx's
// `<picture>`: the vertical file below 620px, the horizontal file at/above
// it) — read once, not per load, to find each file's own alpha bounding
// box. Real files on disk, not the network response: the optimiser may
// re-encode format (avif/webp) depending on the request's Accept header, and
// reading the source master sidesteps that entirely.
const LOCKUP_SOURCE_BY_VIEWPORT = {
  1280: 'public/images/nos/lockup/NOS-2027-logo-full-colour-reversed-horizontal.png',
  390: 'public/images/nos/lockup/NOS-2027-logo-full-colour-reversed-vertical.png',
};
// Alpha below this (0-255) is treated as "not ink" when finding the bbox —
// a few units of headroom for the PNG's own soft/antialiased edge pixels.
const ALPHA_INK_THRESHOLD = 10;
// A pixel counts as "changed" between the visible/hidden screenshots when its
// per-channel (RGB) distance exceeds this — headroom for GPU/compositor
// antialiasing noise between two otherwise-identical renders.
const PIXEL_DIFF_THRESHOLD = 24;
// The ink region must show a real difference, not a handful of edge pixels —
// both a fraction of the ink region AND an absolute floor, so a tiny lockup
// at some future breakpoint can't pass on a handful of coincidental pixels.
const DIFF_FRACTION_FLOOR = 0.005;
const DIFF_PIXEL_FLOOR = 150;

async function assertReachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REACHABILITY_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch {
    process.stderr.write(`SKIP-AS-FAIL: no server reachable at ${url} — hero paint not verified\n`);
    process.exit(1);
  }
}

/** Bounding box (source-pixel space, half-open [x0,x1)/[y0,y1)) of every pixel whose alpha clears the ink threshold. */
function computeInkBBox(pngPath) {
  const png = PNG.sync.read(readFileSync(pngPath));
  let x0 = png.width;
  let y0 = png.height;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const alpha = png.data[(y * png.width + x) * 4 + 3];
      if (alpha > ALPHA_INK_THRESHOLD) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x + 1 > x1) x1 = x + 1;
        if (y + 1 > y1) y1 = y + 1;
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) {
    throw new Error(`${pngPath}: no pixel cleared the ink alpha threshold — every pixel is fully transparent`);
  }
  return { x0, y0, x1, y1, naturalWidth: png.width, naturalHeight: png.height };
}

function loadInkBBoxes() {
  const bboxes = {};
  for (const [viewportWidth, relativePath] of Object.entries(LOCKUP_SOURCE_BY_VIEWPORT)) {
    bboxes[viewportWidth] = computeInkBBox(resolve(relativePath));
  }
  return bboxes;
}

function pixelAt(png, x, y) {
  const i = (y * png.width + x) * 4;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}

/** Count of pixels inside `region` (local to both PNGs, already clamped) whose RGB differs beyond PIXEL_DIFF_THRESHOLD. */
function countDiffPixels(pngA, pngB, region) {
  let diff = 0;
  for (let y = region.y0; y < region.y1; y += 1) {
    for (let x = region.x0; x < region.x1; x += 1) {
      const [ar, ag, ab] = pixelAt(pngA, x, y);
      const [br, bg, bb] = pixelAt(pngB, x, y);
      if (
        Math.abs(ar - br) > PIXEL_DIFF_THRESHOLD ||
        Math.abs(ag - bg) > PIXEL_DIFF_THRESHOLD ||
        Math.abs(ab - bb) > PIXEL_DIFF_THRESHOLD
      ) {
        diff += 1;
      }
    }
  }
  return diff;
}

async function loadOnce(browser, url, viewport, loadIndex, inkBBox) {
  // A fresh context per load — never a warm reuse — is the "cold load"
  // Codi's own reproduction and this probe both require.
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

  try {
    await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await page.addStyleTag({ content: HIDE_DEV_OVERLAY_CSS });
    await page.evaluate(() => document.fonts.ready);
    await page
      .waitForFunction(
        (selector) => {
          const img = document.querySelector(selector);
          return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0;
        },
        LOCKUP_SELECTOR,
        { timeout: IMG_READY_TIMEOUT_MS },
      )
      .catch(() => {});

    const domInfo = await page.evaluate((selector) => {
      const img = document.querySelector(selector);
      if (!(img instanceof HTMLImageElement)) return { found: false };
      const rect = img.getBoundingClientRect();
      return {
        found: true,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        currentSrc: img.currentSrc,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    }, LOCKUP_SELECTOR);

    if (!domInfo.found || domInfo.rect.width <= 0 || domInfo.rect.height <= 0) {
      return { viewport: viewport.width, loadIndex, painted: false, domInfo, diffPixels: 0, inkPixels: 0 };
    }

    const clip = {
      x: Math.max(0, domInfo.rect.x),
      y: Math.max(0, domInfo.rect.y),
      width: Math.max(1, domInfo.rect.width),
      height: Math.max(1, domInfo.rect.height),
    };

    // Negative control: force the lockup invisible before the "as loaded"
    // shot, so the two screenshots below end up identical and the probe must
    // report a miss. Never set in the real gate.
    if (process.env[NEGCTL_ENV]) {
      await page.evaluate((selector) => {
        const img = document.querySelector(selector);
        if (img) img.style.opacity = '0';
      }, LOCKUP_SELECTOR);
    }
    const visibleBuffer = await page.screenshot({ clip });

    await page.evaluate((selector) => {
      const img = document.querySelector(selector);
      if (img) img.style.visibility = 'hidden';
    }, LOCKUP_SELECTOR);
    const hiddenBuffer = await page.screenshot({ clip });

    const pngVisible = PNG.sync.read(visibleBuffer);
    const pngHidden = PNG.sync.read(hiddenBuffer);

    // Map the source PNG's ink bbox into this screenshot's local pixel space:
    // scale by rendered-size / natural-size, offset by the clip's own clamp
    // (rect.x/y might have been negative and clamped to 0 above).
    const scaleX = domInfo.rect.width / domInfo.naturalWidth;
    const scaleY = domInfo.rect.height / domInfo.naturalHeight;
    const clipOffsetX = clip.x - domInfo.rect.x;
    const clipOffsetY = clip.y - domInfo.rect.y;
    const region = {
      x0: Math.max(0, Math.floor(inkBBox.x0 * scaleX - clipOffsetX)),
      y0: Math.max(0, Math.floor(inkBBox.y0 * scaleY - clipOffsetY)),
      x1: Math.min(pngVisible.width, Math.ceil(inkBBox.x1 * scaleX - clipOffsetX)),
      y1: Math.min(pngVisible.height, Math.ceil(inkBBox.y1 * scaleY - clipOffsetY)),
    };
    const inkPixels = Math.max(0, region.x1 - region.x0) * Math.max(0, region.y1 - region.y0);
    const diffPixels = inkPixels > 0 ? countDiffPixels(pngVisible, pngHidden, region) : 0;

    const meaningfulDiff = diffPixels >= DIFF_PIXEL_FLOOR && diffPixels / Math.max(1, inkPixels) >= DIFF_FRACTION_FLOOR;
    const painted = domInfo.complete && domInfo.naturalWidth > 0 && meaningfulDiff;

    return { viewport: viewport.width, loadIndex, painted, domInfo, diffPixels, inkPixels };
  } finally {
    await context.close();
  }
}

function report(results) {
  const header = ['viewport', 'load', 'painted', 'diff/ink px', 'currentSrc'];
  const rows = [header];
  for (const r of results) {
    const src = r.domInfo?.currentSrc ?? '—';
    rows.push([`${r.viewport}`, `${r.loadIndex}`, r.painted ? 'yes' : 'NO', `${r.diffPixels}/${r.inkPixels}`, src]);
  }
  const widths = header.map((_, i) => Math.max(...rows.map((row) => row[i].length)));
  for (const row of rows) {
    process.stdout.write(`${row.map((c, i) => c.padEnd(widths[i])).join(' | ')}\n`);
  }
}

async function main() {
  const url = process.env.NOS_HERO_CONTRAST_URL || DEFAULT_URL;
  await assertReachable(url);
  const inkBBoxes = loadInkBBoxes();
  // `headless: false` — a real foreground window, per the golden. A headless
  // launch has no foreground/background distinction at all, so it cannot
  // stand in for the "cold foreground load" this probe is required to test.
  const browser = await chromium.launch({ headless: false });
  const results = [];
  try {
    for (const viewport of VIEWPORTS) {
      const inkBBox = inkBBoxes[viewport.width];
      for (let loadIndex = 0; loadIndex < LOADS_PER_VIEWPORT; loadIndex += 1) {
        results.push(await loadOnce(browser, url, viewport, loadIndex, inkBBox));
      }
    }
  } finally {
    await browser.close();
  }
  report(results);
  const misses = results.filter((r) => !r.painted);
  if (misses.length > 0) {
    process.stderr.write(
      `FAIL: ${misses.length}/${results.length} load(s) did not paint the hero lockup\n`,
    );
    process.exit(1);
  }
  process.stdout.write(
    `PASS: all ${results.length} loads (${LOADS_PER_VIEWPORT} per viewport x ${VIEWPORTS.length} viewports) painted the hero lockup\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`ERROR: nos-hero-paint-probe failed — ${error?.name ?? 'Error'}: ${error?.message ?? error}\n`);
  process.exit(1);
});
