// =============================================================================
// scripts/checks/nos-hero-contrast.mjs — gated legibility acceptance for the
// /national-show display hero (nos-hero-lockup F1, Amendment 2026-09-29b).
//
// Spec: .agent/memory/project/specs/nos-hero-lockup/goldens/hero-structure.md §10.
// Codi's ruling: "sample the composited pixels behind every hero text element
// and its button border; report worst-case contrast ratio per element".
//
// Method (after execution/checks/nos_scrim_probe.mjs — Playwright + pngjs, DPR 2):
//   1. Every [data-nos-hero-text] element's CSS colour and every
//      [data-nos-hero-button]'s edge colour is resolved by a 1×1 canvas fill,
//      so the browser — not a regex — interprets Tailwind v4's oklab() output.
//   2. The text is then made transparent (layout, fills and borders intact)
//      and the hero is screenshotted: what remains behind each element is the
//      real photo + scrim (+ button fill) composite.
//   3. Text: the colour, alpha-composited over each background pixel in the
//      element's box, against that pixel — the minimum over the box is the
//      element's ratio. Button edge: the edge colour against every pixel in a
//      ring just outside the border box. A borderless (filled) button's edge
//      is its fill (WCAG 1.4.11).
//   4. Per element, the worst ratio across the three viewports is compared to
//      its floor: text 4.5:1, button edge 3:1.
//
// Assumes a server is already running; it never spawns one. An unreachable
// server is a failure (exit 1), never a pass.
//
// Usage: node scripts/checks/nos-hero-contrast.mjs
//   env NOS_HERO_CONTRAST_URL   default http://localhost:3002/national-show
// Exit: 0 every element clears its floor at every viewport · 1 otherwise.
// =============================================================================

import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const DEFAULT_URL = 'http://localhost:3002/national-show';
const REACHABILITY_TIMEOUT_MS = 3_000;
const NAV_TIMEOUT_MS = 60_000;
const DPR = 2;
const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 1714, height: 1000 },
  { width: 390, height: 844 },
];
const TEXT_FLOOR = 4.5;
const BUTTON_EDGE_FLOOR = 3;
// Ring sampled outside a button's border box, in CSS px: from just past the
// edge to this far out.
const EDGE_RING_INNER_CSS = 1;
const EDGE_RING_OUTER_CSS = 3;
const HIDE_TEXT_CSS = [
  '[data-nos-hero-text], [data-nos-hero-text] * {',
  '  color: transparent !important;',
  '  -webkit-text-fill-color: transparent !important;',
  '  text-shadow: none !important;',
  '}',
].join('\n');
// The Next.js dev-tools badge floats over the hero's bottom-left corner in dev.
const HIDE_DEV_OVERLAY_CSS = 'nextjs-portal { display: none !important; }';

// -----------------------------------------------------------------------------
// Colour maths — WCAG 2.x relative luminance and contrast ratio.
// -----------------------------------------------------------------------------

function channelToLinear(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]) {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `fg` is [r, g, b, a] with a in 0-255, composited over an opaque `bg`. */
function compositeOver(fg, bg) {
  const alpha = fg[3] / 255;
  return [0, 1, 2].map((i) => fg[i] * alpha + bg[i] * (1 - alpha));
}

// -----------------------------------------------------------------------------
// Pixel sampling
// -----------------------------------------------------------------------------

function pixelAt(png, x, y) {
  const i = (y * png.width + x) * 4;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}

/** Device-pixel bounds of a CSS rect relative to the screenshot's origin, clamped. */
function deviceBounds(png, rect, origin) {
  return {
    x0: Math.max(0, Math.floor((rect.left - origin.left) * DPR)),
    y0: Math.max(0, Math.floor((rect.top - origin.top) * DPR)),
    x1: Math.min(png.width, Math.ceil((rect.right - origin.left) * DPR)),
    y1: Math.min(png.height, Math.ceil((rect.bottom - origin.top) * DPR)),
  };
}

function worstTextRatio(png, origin, element) {
  let worst = Infinity;
  for (const rect of element.lineRects) {
    const { x0, y0, x1, y1 } = deviceBounds(png, rect, origin);
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const bg = pixelAt(png, x, y);
        worst = Math.min(worst, contrastRatio(compositeOver(element.color, bg), bg));
      }
    }
  }
  return worst;
}

function worstEdgeRatio(png, origin, button) {
  const outer = {
    left: button.rect.left - EDGE_RING_OUTER_CSS,
    top: button.rect.top - EDGE_RING_OUTER_CSS,
    right: button.rect.right + EDGE_RING_OUTER_CSS,
    bottom: button.rect.bottom + EDGE_RING_OUTER_CSS,
  };
  const inner = deviceBounds(png, {
    left: button.rect.left - EDGE_RING_INNER_CSS,
    top: button.rect.top - EDGE_RING_INNER_CSS,
    right: button.rect.right + EDGE_RING_INNER_CSS,
    bottom: button.rect.bottom + EDGE_RING_INNER_CSS,
  }, origin);
  const { x0, y0, x1, y1 } = deviceBounds(png, outer, origin);
  let worst = Infinity;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const insideInner = x >= inner.x0 && x < inner.x1 && y >= inner.y0 && y < inner.y1;
      if (insideInner) continue;
      const bg = pixelAt(png, x, y);
      worst = Math.min(worst, contrastRatio(compositeOver(button.color, bg), bg));
    }
  }
  return worst;
}

// -----------------------------------------------------------------------------
// In-page collection (runs in the browser)
// -----------------------------------------------------------------------------

function collectTargets() {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const resolveColor = (css) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  };
  const toPage = (r) => ({ left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY });
  const pageRect = (el) => toPage(el.getBoundingClientRect());

  const hero = document.querySelector('h1').closest('section');
  const text = [...hero.querySelectorAll('[data-nos-hero-text]')].map((el) => {
    // A `display: contents` wrapper has no box; its rendered child carries it.
    const target = getComputedStyle(el).display === 'contents' ? el.firstElementChild : el;
    const label = el.getAttribute('data-nos-hero-text');
    if (!target) return { label, rendered: false };
    // Line boxes of the text itself, not the element box: a flex item stretches
    // to the column width, far past where its glyphs end.
    const range = document.createRange();
    range.selectNodeContents(target);
    const lineRects = [...range.getClientRects()]
      .filter((r) => r.width > 0 && r.height > 0)
      .map(toPage);
    if (lineRects.length === 0) return { label, rendered: false };
    return { label, rendered: true, lineRects, color: resolveColor(getComputedStyle(target).color) };
  });
  const buttons = [...hero.querySelectorAll('[data-nos-hero-button]')].map((el, index) => {
    const style = getComputedStyle(el);
    const hasBorder = parseFloat(style.borderTopWidth) > 0;
    return {
      label: `button-${index}-${hasBorder ? 'border' : 'fill'}`,
      rendered: true,
      rect: pageRect(el),
      color: resolveColor(hasBorder ? style.borderTopColor : style.backgroundColor),
    };
  });
  return { heroRect: pageRect(hero), text, buttons };
}

// -----------------------------------------------------------------------------
// Run
// -----------------------------------------------------------------------------

async function assertReachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REACHABILITY_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch {
    process.stderr.write(`SKIP-AS-FAIL: no server reachable at ${url} — hero contrast not verified\n`);
    process.exit(1);
  }
}

async function measureViewport(browser, url, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: DPR });
  try {
    await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await page.addStyleTag({ content: HIDE_DEV_OVERLAY_CSS });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(
      () => {
        const hero = document.querySelector('h1')?.closest('section');
        const imgs = hero ? [...hero.querySelectorAll('img')] : [];
        // The countdown is a client component behind Suspense — wait for its
        // digits too, or a cold first load measures a hero without them.
        const countdownReady =
          hero?.querySelector('[data-nos-hero-text^="countdown-"]:not([data-nos-hero-text="countdown-opens-in"])') !==
          null;
        return countdownReady && imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 0);
      },
      null,
      { timeout: NAV_TIMEOUT_MS },
    );
    const { heroRect, text, buttons } = await page.evaluate(collectTargets);
    await page.addStyleTag({ content: HIDE_TEXT_CSS });
    const clip = {
      x: heroRect.left,
      y: heroRect.top,
      width: heroRect.right - heroRect.left,
      height: heroRect.bottom - heroRect.top,
    };
    const png = PNG.sync.read(await page.screenshot({ fullPage: true, clip }));
    const results = new Map();
    for (const element of text) {
      if (!element.rendered) continue;
      results.set(element.label, { ratio: worstTextRatio(png, heroRect, element), floor: TEXT_FLOOR });
    }
    for (const button of buttons) {
      results.set(button.label, { ratio: worstEdgeRatio(png, heroRect, button), floor: BUTTON_EDGE_FLOOR });
    }
    return results;
  } finally {
    await page.close();
  }
}

function report(byViewport) {
  const labels = [...new Set([...byViewport.values()].flatMap((m) => [...m.keys()]))];
  const vpNames = [...byViewport.keys()];
  const header = ['element', ...vpNames, 'worst', 'floor', 'verdict'];
  const rows = [header];
  const failures = [];
  for (const label of labels) {
    const cells = vpNames.map((vp) => byViewport.get(vp).get(label));
    const present = cells.filter(Boolean);
    const worst = Math.min(...present.map((c) => c.ratio));
    const floor = present[0].floor;
    const pass = worst >= floor;
    vpNames.forEach((vp, i) => {
      if (cells[i] && cells[i].ratio < floor) failures.push(`${label} @ ${vp}: ${cells[i].ratio.toFixed(2)}:1 < ${floor}:1`);
    });
    rows.push([label, ...cells.map((c) => (c ? c.ratio.toFixed(2) : '—')), worst.toFixed(2), `${floor}`, pass ? 'PASS' : 'FAIL']);
  }
  const widths = header.map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  for (const row of rows) process.stdout.write(`${row.map((c, i) => c.padEnd(widths[i])).join(' | ')}\n`);
  return failures;
}

async function main() {
  const url = process.env.NOS_HERO_CONTRAST_URL || DEFAULT_URL;
  await assertReachable(url);
  const browser = await chromium.launch();
  const byViewport = new Map();
  try {
    for (const viewport of VIEWPORTS) {
      byViewport.set(`${viewport.width}`, await measureViewport(browser, url, viewport));
    }
  } finally {
    await browser.close();
  }
  const failures = report(byViewport);
  if (failures.length > 0) {
    process.stderr.write(`FAIL: ${failures.length} below floor\n${failures.join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('PASS: every hero text element and button edge clears its floor at every viewport\n');
}

main().catch((error) => {
  process.stderr.write(`ERROR: nos-hero-contrast failed — ${error?.name ?? 'Error'}: ${error?.message ?? error}\n`);
  process.exit(1);
});
