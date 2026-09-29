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
// load, never a warm reuse) with the network cache disabled via CDP. Per
// load: wait for document.fonts.ready and the lockup <img>'s naturalWidth >
// 0, then screenshot the <h1> box and confirm it is not a uniform blank/
// transparent fill (a real paint miss, not just "the DOM says it loaded").
//
// Reuses nos-hero-contrast.mjs's reachability probe and SKIP-as-fail
// convention (F1, hero-structure.md §10) rather than inventing new tooling.
//
// Usage: node scripts/checks/nos-hero-paint-probe.mjs
//   env NOS_HERO_CONTRAST_URL  default http://localhost:3002/national-show
// Exit: 0 only if every load at every viewport painted · 1 with the table on
// any miss (also the diagnosis report, not just the gate's own output).
// =============================================================================

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
const LOCKUP_NETWORK_MATCH = '/images/nos/lockup/';
// The Next.js dev-tools badge floats over the hero's bottom-left corner in dev.
const HIDE_DEV_OVERLAY_CSS = 'nextjs-portal { display: none !important; }';

async function assertReachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REACHABILITY_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch {
    process.stderr.write(`SKIP-AS-FAIL: no server reachable at ${url} — hero paint not verified\n`);
    process.exit(1);
  }
}

/** True when every pixel in the PNG is identical — a uniform blank/transparent fill. */
function isUniformFill(png) {
  const [r0, g0, b0, a0] = png.data;
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i] !== r0 || png.data[i + 1] !== g0 || png.data[i + 2] !== b0 || png.data[i + 3] !== a0) {
      return false;
    }
  }
  return true;
}

async function loadOnce(browser, url, viewport, loadIndex) {
  // A fresh context per load — never a warm reuse — is the "cold load"
  // Codi's own reproduction and this probe both require.
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

  const lockupRequests = [];
  page.on('response', (response) => {
    // Next's image optimiser proxies through `/_next/image?url=<percent-encoded>`,
    // so the lockup's own path is encoded inside the query string, not literal
    // in the request URL — decode before matching.
    if (decodeURIComponent(response.url()).includes(LOCKUP_NETWORK_MATCH)) {
      lockupRequests.push({ url: response.url(), status: response.status() });
    }
  });

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
        currentSrc: img.currentSrc,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    }, LOCKUP_SELECTOR);

    const lastRequest = lockupRequests[lockupRequests.length - 1] ?? null;

    if (!domInfo.found || domInfo.rect.width <= 0 || domInfo.rect.height <= 0) {
      return { viewport: viewport.width, loadIndex, painted: false, domInfo, lastRequest };
    }

    const clip = {
      x: Math.max(0, domInfo.rect.x),
      y: Math.max(0, domInfo.rect.y),
      width: Math.max(1, domInfo.rect.width),
      height: Math.max(1, domInfo.rect.height),
    };
    const buffer = await page.screenshot({ clip });
    const png = PNG.sync.read(buffer);
    const painted = domInfo.complete && domInfo.naturalWidth > 0 && !isUniformFill(png);

    return { viewport: viewport.width, loadIndex, painted, domInfo, lastRequest };
  } finally {
    await context.close();
  }
}

function report(results) {
  const header = ['viewport', 'load', 'painted', 'currentSrc', 'network'];
  const rows = [header];
  for (const r of results) {
    const src = r.domInfo?.currentSrc ?? '—';
    const network = r.lastRequest ? `${r.lastRequest.status}` : 'no request seen';
    rows.push([`${r.viewport}`, `${r.loadIndex}`, r.painted ? 'yes' : 'NO', src, network]);
  }
  const widths = header.map((_, i) => Math.max(...rows.map((row) => row[i].length)));
  for (const row of rows) {
    process.stdout.write(`${row.map((c, i) => c.padEnd(widths[i])).join(' | ')}\n`);
  }
}

async function main() {
  const url = process.env.NOS_HERO_CONTRAST_URL || DEFAULT_URL;
  await assertReachable(url);
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const viewport of VIEWPORTS) {
      for (let loadIndex = 0; loadIndex < LOADS_PER_VIEWPORT; loadIndex += 1) {
        results.push(await loadOnce(browser, url, viewport, loadIndex));
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
