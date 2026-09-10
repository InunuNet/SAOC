// =============================================================================
// nos_scrim_probe.mjs — the R10 hero-scrim probe (nos-design-system, M9 / F25).
//
// The same instrument Codi used to issue R10 (.tmp/sandbox/codi-evidence/scrim-probe.mjs:
// normal composite, flat-grey photograph swap via page.route, luminance columns at 25/50/75%
// width every 8px), made fit to gate on. Three changes, each closing a hole the original had:
//
//   1. Two grey swaps, not one. With the photograph replaced by #808080 and again by #C0C0C0
//      the overlay alpha at every pixel is 1 - (B - A) / (0xC0 - 0x80), independent of the
//      scrim's colour. The original inferred alpha from luminance against an assumed overlay
//      colour, which breaks the moment @dev changes the tint.
//   2. The type block is hidden (visibility only, layout intact) in every measurement pass.
//      Codi's x = 25% column ran straight through the <h1>; an ivory glyph pixel read as
//      "alpha -1.08" and the column was no longer measuring the scrim.
//   3. Element screenshots, not viewport ones. At 1280x900 the hero's bottom third sits
//      below the fold; the original clamped those rows to the last visible one.
//
// It also measures what R10/1 actually says — "the bloom reads as shot: warm petals in their
// own colour, not violet" — by comparing the composited right quarter against the same
// pixels with the scrim layers hidden (hue shift and chroma retention), and carries two
// negative controls that prove the alpha solver and the cast detector can each return the
// failing answer.
//
// Usage (repo root is the cwd; absolute paths inside are resolved from this file):
//   node execution/checks/nos_scrim_probe.mjs --label after                   # spawns next dev on 3415
//   node execution/checks/nos_scrim_probe.mjs --label before --base http://localhost:3416 \
//        --tree .tmp/sandbox/nos-m9/before-tree                               # pre-fix worktree
//   options: --viewport 390|1280|all (default all)  --out <dir>  --before <dir>  --route <path>
//
// Writes, per viewport, into --out (default .tmp/sandbox/nos-m9/evidence):
//   scrim-profile-<label>-<vp>.json   measurements + one-key-per-line verdicts (PASS/FAIL/BLOCKED)
//   scrim-normal-<label>-<vp>.png     the hero as shipped (type visible)
//   scrim-grey-<label>-<vp>.png       the #808080 swap, type hidden — the scrim alone
//   scrim-raw-<label>-<vp>.png        scrims hidden, type hidden — the photograph alone
//
// Exit codes (same vocabulary as verify_nos_m7_hero_and_grammar.ts):
//   0 every verdict PASS · 1 at least one FAIL · 2 setup failure · 3 no FAIL but BLOCKED/ERROR
// =============================================================================

import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROBE_ID = 'execution/checks/nos_scrim_probe.mjs';
const DEFAULT_PORT = 3415;
const DEFAULT_OUT = '.tmp/sandbox/nos-m9/evidence';
const DEFAULT_ROUTE = '/national-show';
const DPR = 2;
const VIEWPORTS = { 390: { width: 390, height: 844 }, 1280: { width: 1280, height: 900 } };
const SERVER_START_TIMEOUT_MS = 180_000;
const SERVER_POLL_INTERVAL_MS = 1_000;
const NAV_TIMEOUT_MS = 60_000;

// Swap greys. Their difference is the denominator of the alpha solver.
const GREY_A = 0x80;
const GREY_B = 0xc0;
const SWAP_IMAGE_PX = 2400;
const SWAP_EFFECTIVE_MAX_DEVIATION = 3; // mean |pixel - GREY_A| with scrims hidden, 0-255

// Sampling geometry — Codi's: columns at quarter widths, rows every 8 CSS px. x = 90% is
// recorded for review only; no verdict reads it.
const COLUMNS = { x25: 0.25, x50: 0.5, x75: 0.75, x90: 0.9 };
const ROW_STEP_CSS = 8;
const ROW_INSET_CSS = 4;
const MIDDLE_HALF = [0.25, 0.75];
const BOTTOM_THIRD_FROM = 2 / 3;

// R10/4 windows. Both are two-sided so neither is a tuning surface.
const X75_MID_ALPHA_WINDOW = [-0.03, 0.25]; // R10/1 — "0.25 or lower"; -0.03 is solver noise
const X25_MID_ALPHA_WINDOW = [0.75, 0.88]; // R10/2 + R10/4 — "0.75 or over", "about 0.85"
const X25_MID_ALPHA_CEILING = 0.88; // asserted alone at 390, where no type sits on the photo
const LATERAL_MIN_STEP = 0.02; // x25 > x50 > x75 at mid-height, each step at least this
const NEVER_DARKER_TOLERANCE = 0.03; // R10/3 — after <= before + tol at every sample

// R10/1 "petals in their own colour, not violet" — composited vs scrim-hidden pixels in the
// region right of x = 75%, middle half of the height. Chromatic mask taken on the RAW pixels.
const BLOOM_REGION = { x: [0.75, 1.0], y: [0.25, 0.75] };
const BLOOM_MIN_CHROMA = 0.08;
const BLOOM_LIGHTNESS = [0.15, 0.9];
const BLOOM_MIN_CHROMATIC_FRACTION = 0.05; // below this the region has no bloom to measure
const HUE_SHIFT_WINDOW_DEG = [0, 15];
const CHROMA_RETENTION_WINDOW = [0.6, 1.05];
const NEGCTL_CAST_OVERLAY = { rgb: [14, 11, 36], alpha: 0.8 };

// Negative control for the solver: an injected overlay of known alpha.
const NEGCTL_ALPHA = 0.5;
const SOLVER_TOLERANCE = 0.03;
const SOLVER_MIN_AGREEING_FRACTION = 0.95;

const VERDICT_IDS = [
  'PROBE_SWAP_EFFECTIVE',
  'SCRIM_X75_MID_ALPHA',
  'SCRIM_X25_MID_ALPHA_WINDOW',
  'SCRIM_X25_MID_ALPHA_CEILING',
  'SCRIM_LATERAL_MONOTONE_MID',
  'SCRIM_NEVER_DARKER_THAN_BEFORE',
  'BLOOM_OWN_COLOUR_X75_OUTWARD',
  'NEGCTL_ALPHA_SOLVER_LINEAR',
  'NEGCTL_HUE_DETECTS_CAST',
];

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { label: null, base: null, viewport: 'all', out: DEFAULT_OUT, before: null, route: DEFAULT_ROUTE, tree: REPO_ROOT };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    switch (key) {
      case '--label': args.label = value; i += 1; break;
      case '--base': args.base = value; i += 1; break;
      case '--viewport': args.viewport = value; i += 1; break;
      case '--out': args.out = value; i += 1; break;
      case '--before': args.before = value; i += 1; break;
      case '--route': args.route = value; i += 1; break;
      case '--tree': args.tree = value; i += 1; break;
      default: throw new Error(`unknown argument ${key}`);
    }
  }
  if (!args.label || !/^[a-z0-9-]+$/.test(args.label)) throw new Error('--label <before|after|...> is required (lowercase, digits, hyphen)');
  if (!['390', '1280', 'all'].includes(args.viewport)) throw new Error('--viewport must be 390, 1280 or all');
  args.out = path.resolve(REPO_ROOT, args.out);
  args.before = args.before ? path.resolve(REPO_ROOT, args.before) : args.out;
  args.tree = path.resolve(REPO_ROOT, args.tree);
  return args;
}

// -----------------------------------------------------------------------------
// Colour maths
// -----------------------------------------------------------------------------

function greyPng(size, value) {
  const png = new PNG({ width: size, height: size });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = value;
    png.data[i + 1] = value;
    png.data[i + 2] = value;
    png.data[i + 3] = 0xff;
  }
  return PNG.sync.write(png);
}

function readPixel(png, x, y) {
  const cx = Math.max(0, Math.min(png.width - 1, Math.round(x)));
  const cy = Math.max(0, Math.min(png.height - 1, Math.round(y)));
  const idx = (png.width * cy + cx) << 2;
  return [png.data[idx], png.data[idx + 1], png.data[idx + 2]];
}

/** Overlay alpha from two composites of the same scrim over two known flat greys. */
function solveAlpha(rgbA, rgbB) {
  const denom = GREY_B - GREY_A;
  const perChannel = [0, 1, 2].map((c) => 1 - (rgbB[c] - rgbA[c]) / denom);
  return perChannel.reduce((s, v) => s + v, 0) / 3;
}

function overlayColour(rgbA, alpha) {
  if (alpha <= 0.05) return null;
  return [0, 1, 2].map((c) => Math.round((rgbA[c] - (1 - alpha) * GREY_A) / alpha));
}

function hsl([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = (max - min) / 255;
  const lightness = (max + min) / 510;
  let hue = 0;
  if (max !== min) {
    if (max === r) hue = ((g - b) / (max - min)) % 6;
    else if (max === g) hue = (b - r) / (max - min) + 2;
    else hue = (r - g) / (max - min) + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { hue, chroma, lightness };
}

function circularMeanDeg(degrees) {
  let sx = 0;
  let sy = 0;
  for (const d of degrees) {
    sx += Math.cos((d * Math.PI) / 180);
    sy += Math.sin((d * Math.PI) / 180);
  }
  const mean = (Math.atan2(sy, sx) * 180) / Math.PI;
  return mean < 0 ? mean + 360 : mean;
}

function hueDistanceDeg(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function blend(rgb, overlay) {
  return rgb.map((v, i) => Math.round(v * (1 - overlay.alpha) + overlay.rgb[i] * overlay.alpha));
}

function inWindow(value, [lo, hi]) {
  return Number.isFinite(value) && value >= lo && value <= hi;
}

function round(value, places = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(places)) : null;
}

// -----------------------------------------------------------------------------
// Page driving
// -----------------------------------------------------------------------------

async function openPage(browser, vp, base, route) {
  const page = await browser.newPage({ viewport: VIEWPORTS[vp], deviceScaleFactor: DPR, reducedMotion: 'reduce' });
  page.setDefaultTimeout(NAV_TIMEOUT_MS);
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  return page;
}

/** Route interception that replaces every hero photograph request with a flat grey. */
async function installGreySwap(page, value) {
  const body = greyPng(SWAP_IMAGE_PX, value);
  let fulfilled = 0;
  const handler = (route) => {
    fulfilled += 1;
    return route.fulfill({ status: 200, contentType: 'image/png', body });
  };
  await page.route('**/_next/image**', handler);
  await page.route('**/images/orchid-*.jpg', handler);
  return () => fulfilled;
}

/** Locate the hero and its image box; hide the sticky header and (optionally) the type column. */
async function prepareHero(page, { hideType }) {
  const ok = await page.evaluate(({ hideType: hide }) => {
    const h1 = document.querySelector('h1');
    const section = h1?.closest('section');
    const img = section?.querySelector('img.object-cover');
    if (!h1 || !section || !img || !img.parentElement) return false;
    for (const header of document.querySelectorAll('header')) header.style.visibility = 'hidden';
    if (hide) {
      const column = Array.from(section.children).find((c) => c.contains(h1));
      if (column) column.style.visibility = 'hidden';
    }
    section.setAttribute('data-nos-probe-hero', '');
    img.parentElement.setAttribute('data-nos-probe-imagebox', '');
    return true;
  }, { hideType });
  if (!ok) throw new SetupFailure('hero <section> with an h1 and img.object-cover not found');
  await page.waitForFunction(() => {
    const img = document.querySelector('[data-nos-probe-imagebox] img.object-cover');
    return Boolean(img && img.complete && img.naturalWidth > 0);
  });
}

async function heroGeometry(page) {
  return page.evaluate(() => {
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
    };
    const section = document.querySelector('[data-nos-probe-hero]');
    const box = document.querySelector('[data-nos-probe-imagebox]');
    const img = box.querySelector('img.object-cover');
    const h1 = section.querySelector('h1');
    const layers = Array.from(box.querySelectorAll(':scope > div[aria-hidden="true"]')).map((d) => getComputedStyle(d).backgroundImage);
    const imgRect = rect(img);
    const h1Rect = rect(h1);
    return {
      heroBox: rect(section),
      imageBox: rect(box),
      h1Box: h1Rect,
      layout: imgRect.y >= h1Rect.y + h1Rect.height ? 'stacked' : 'overlay',
      objectPosition: getComputedStyle(img).objectPosition,
      currentSrc: img.currentSrc,
      layersRendered: layers.length,
      layerBackgrounds: layers,
    };
  });
}

async function shootImageBox(page, file) {
  await page.locator('[data-nos-probe-imagebox]').screenshot({ path: file });
  return PNG.sync.read(fs.readFileSync(file));
}

async function hideScrims(page) {
  await page.evaluate(() => {
    const box = document.querySelector('[data-nos-probe-imagebox]');
    for (const child of box.children) if (child.tagName !== 'IMG') child.style.visibility = 'hidden';
  });
}

async function injectKnownOverlay(page, alpha) {
  await page.evaluate((a) => {
    const box = document.querySelector('[data-nos-probe-imagebox]');
    const div = document.createElement('div');
    div.setAttribute('data-nos-probe-negctl', '');
    div.style.cssText = `position:absolute;inset:0;pointer-events:none;background:rgba(14,11,36,${a})`;
    box.appendChild(div);
  }, alpha);
}

// -----------------------------------------------------------------------------
// Measurement
// -----------------------------------------------------------------------------

class SetupFailure extends Error {}

function sampleGrid(imageBox) {
  const rows = [];
  for (let y = ROW_INSET_CSS; y <= imageBox.height - ROW_INSET_CSS; y += ROW_STEP_CSS) rows.push(y);
  return rows;
}

function profileColumns(pngA, pngB, imageBox) {
  const rows = sampleGrid(imageBox);
  const profile = {};
  for (const [name, frac] of Object.entries(COLUMNS)) {
    const xDev = imageBox.width * frac * DPR;
    profile[name] = rows.map((yCss) => {
      const rgbA = readPixel(pngA, xDev, yCss * DPR);
      const rgbB = readPixel(pngB, xDev, yCss * DPR);
      const alpha = solveAlpha(rgbA, rgbB);
      return { yCss, yFrac: round(yCss / imageBox.height), alpha: round(alpha), rgbA, rgbB, overlay: overlayColour(rgbA, alpha) };
    });
  }
  return profile;
}

function nearest(samples, yFrac) {
  return samples.reduce((best, s) => (Math.abs(s.yFrac - yFrac) < Math.abs(best.yFrac - yFrac) ? s : best), samples[0]);
}

function summarise(profile) {
  const mid = (col) => nearest(profile[col], 0.5).alpha;
  const x75 = profile.x75;
  const middle = x75.filter((s) => s.yFrac >= MIDDLE_HALF[0] && s.yFrac <= MIDDLE_HALF[1]);
  const bottom = x75.filter((s) => s.yFrac >= BOTTOM_THIRD_FROM);
  const all = Object.values(profile).flat();
  const opaque = all.filter((s) => s.alpha > 0.05 && s.overlay);
  const overlay = opaque.length
    ? [0, 1, 2].map((c) => Math.round(opaque.reduce((sum, s) => sum + s.overlay[c], 0) / opaque.length))
    : null;
  return {
    x25MidAlpha: mid('x25'),
    x50MidAlpha: mid('x50'),
    x75MidAlpha: mid('x75'),
    x90MidAlpha: mid('x90'),
    x75MaxAlphaMiddleHalf: round(Math.max(...middle.map((s) => s.alpha))),
    x75MaxAlpha: round(Math.max(...x75.map((s) => s.alpha))),
    x75BottomThirdMeanAlpha: round(bottom.reduce((sum, s) => sum + s.alpha, 0) / Math.max(1, bottom.length)),
    maxAlphaAnywhere: round(Math.max(...all.map((s) => s.alpha))),
    minAlphaAnywhere: round(Math.min(...all.map((s) => s.alpha))),
    overlayColourEstimate: overlay,
  };
}

function bloomColour(rawPng, compositePng, imageBox, region = BLOOM_REGION) {
  const x0 = Math.floor(imageBox.width * region.x[0] * DPR);
  const x1 = Math.floor(imageBox.width * region.x[1] * DPR);
  const y0 = Math.floor(imageBox.height * region.y[0] * DPR);
  const y1 = Math.floor(imageBox.height * region.y[1] * DPR);
  const rawHues = [];
  const compHues = [];
  let rawChroma = 0;
  let compChroma = 0;
  let total = 0;
  let chromatic = 0;
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      total += 1;
      const raw = hsl(readPixel(rawPng, x, y));
      if (raw.chroma < BLOOM_MIN_CHROMA || raw.lightness < BLOOM_LIGHTNESS[0] || raw.lightness > BLOOM_LIGHTNESS[1]) continue;
      chromatic += 1;
      const comp = hsl(readPixel(compositePng, x, y));
      rawHues.push(raw.hue);
      compHues.push(comp.hue);
      rawChroma += raw.chroma;
      compChroma += comp.chroma;
    }
  }
  const fraction = total ? chromatic / total : 0;
  if (fraction < BLOOM_MIN_CHROMATIC_FRACTION) return { chromaticFraction: round(fraction), measurable: false };
  const rawHue = circularMeanDeg(rawHues);
  const compHue = circularMeanDeg(compHues);
  return {
    chromaticFraction: round(fraction),
    measurable: true,
    rawMeanHueDeg: round(rawHue, 1),
    compositeMeanHueDeg: round(compHue, 1),
    hueShiftDeg: round(hueDistanceDeg(rawHue, compHue), 1),
    rawMeanChroma: round(rawChroma / chromatic),
    compositeMeanChroma: round(compChroma / chromatic),
    chromaRetention: round(compChroma / rawChroma),
  };
}

/** Numerical negative control: the cast detector must flag a heavy purple overlay. */
function castDetectorControl(rawPng, imageBox) {
  const x0 = Math.floor(imageBox.width * BLOOM_REGION.x[0] * DPR);
  const x1 = Math.floor(imageBox.width * BLOOM_REGION.x[1] * DPR);
  const y0 = Math.floor(imageBox.height * BLOOM_REGION.y[0] * DPR);
  const y1 = Math.floor(imageBox.height * BLOOM_REGION.y[1] * DPR);
  const hues = { raw: [], cast: [] };
  let rawChroma = 0;
  let castChroma = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const rgb = readPixel(rawPng, x, y);
      const raw = hsl(rgb);
      if (raw.chroma < BLOOM_MIN_CHROMA || raw.lightness < BLOOM_LIGHTNESS[0] || raw.lightness > BLOOM_LIGHTNESS[1]) continue;
      const cast = hsl(blend(rgb, NEGCTL_CAST_OVERLAY));
      hues.raw.push(raw.hue);
      hues.cast.push(cast.hue);
      rawChroma += raw.chroma;
      castChroma += cast.chroma;
      n += 1;
    }
  }
  if (n === 0) return { measurable: false };
  const shift = hueDistanceDeg(circularMeanDeg(hues.raw), circularMeanDeg(hues.cast));
  const retention = castChroma / rawChroma;
  return { measurable: true, hueShiftDeg: round(shift, 1), chromaRetention: round(retention), detected: !inWindow(shift, HUE_SHIFT_WINDOW_DEG) || !inWindow(retention, CHROMA_RETENTION_WINDOW) };
}

function solverControl(baseProfile, controlProfile) {
  let agree = 0;
  let total = 0;
  let worst = 0;
  for (const col of Object.keys(COLUMNS)) {
    baseProfile[col].forEach((s, i) => {
      const predicted = 1 - (1 - s.alpha) * (1 - NEGCTL_ALPHA);
      const observed = controlProfile[col][i].alpha;
      const err = Math.abs(observed - predicted);
      worst = Math.max(worst, err);
      total += 1;
      if (err <= SOLVER_TOLERANCE) agree += 1;
    });
  }
  return { agreeingFraction: round(agree / total), worstError: round(worst), samples: total };
}

function neverDarker(afterProfile, beforeProfile) {
  let worst = -Infinity;
  let violations = 0;
  let compared = 0;
  const worstSample = {};
  for (const col of Object.keys(COLUMNS)) {
    if (!beforeProfile[col]) continue;
    for (const s of afterProfile[col]) {
      const b = nearest(beforeProfile[col], s.yFrac);
      const delta = s.alpha - b.alpha;
      compared += 1;
      if (delta > worst) {
        worst = delta;
        Object.assign(worstSample, { column: col, yFrac: s.yFrac, before: b.alpha, after: s.alpha });
      }
      if (delta > NEVER_DARKER_TOLERANCE) violations += 1;
    }
  }
  return { compared, violations, worstIncrease: round(worst), worstSample };
}

function meanDeviationFromGrey(png, imageBox) {
  let sum = 0;
  let n = 0;
  for (let y = ROW_INSET_CSS * DPR; y < (imageBox.height - ROW_INSET_CSS) * DPR; y += 8) {
    for (let x = ROW_INSET_CSS * DPR; x < (imageBox.width - ROW_INSET_CSS) * DPR; x += 8) {
      const rgb = readPixel(png, x, y);
      sum += (Math.abs(rgb[0] - GREY_A) + Math.abs(rgb[1] - GREY_A) + Math.abs(rgb[2] - GREY_A)) / 3;
      n += 1;
    }
  }
  return n ? sum / n : Infinity;
}

// -----------------------------------------------------------------------------
// One viewport
// -----------------------------------------------------------------------------

async function probeViewport(browser, vp, args, commit) {
  const file = (kind, ext) => path.join(args.out, `scrim-${kind}-${args.label}-${vp}.${ext}`);
  const verdicts = {};
  const reasons = {};
  const verdict = (id, pass, reason) => {
    verdicts[id] = pass ? 'PASS' : 'FAIL';
    if (reason) reasons[`${id}__reason`] = reason;
  };
  const blocked = (id, reason) => {
    verdicts[id] = 'BLOCKED';
    reasons[`${id}__reason`] = reason;
  };

  // Pass 1 — the hero as shipped, for the eye.
  let page = await openPage(browser, vp, args.base, args.route);
  await prepareHero(page, { hideType: false });
  const geometry = await heroGeometry(page);
  await page.locator('[data-nos-probe-hero]').screenshot({ path: file('normal', 'png') });
  // Same page, type hidden: the composite the bloom-colour check reads.
  await page.evaluate(() => {
    const section = document.querySelector('[data-nos-probe-hero]');
    const h1 = section.querySelector('h1');
    const column = Array.from(section.children).find((c) => c.contains(h1));
    if (column) column.style.visibility = 'hidden';
  });
  const compositePng = await shootImageBox(page, path.join(args.out, `_scrim-composite-notext-${args.label}-${vp}.png`));
  // Same page, scrims hidden: the photograph alone.
  await hideScrims(page);
  const rawPng = await shootImageBox(page, file('raw', 'png'));
  await page.close();

  // Pass 2 — grey A swap (+ known overlay, + scrims hidden for the swap check).
  page = await openPage(browser, vp, args.base, args.route);
  const countA = await installGreySwap(page, GREY_A);
  await page.reload({ waitUntil: 'networkidle' });
  await prepareHero(page, { hideType: true });
  const greyGeometry = await heroGeometry(page);
  const pngA = await shootImageBox(page, file('grey', 'png'));
  await injectKnownOverlay(page, NEGCTL_ALPHA);
  const pngAControl = await shootImageBox(page, path.join(args.out, `_scrim-greyA-negctl-${args.label}-${vp}.png`));
  await page.evaluate(() => document.querySelector('[data-nos-probe-negctl]')?.remove());
  await hideScrims(page);
  const pngASwapCheck = await shootImageBox(page, path.join(args.out, `_scrim-greyA-noscrim-${args.label}-${vp}.png`));
  const fulfilledA = countA();
  await page.close();

  // Pass 3 — grey B swap (+ known overlay).
  page = await openPage(browser, vp, args.base, args.route);
  const countB = await installGreySwap(page, GREY_B);
  await page.reload({ waitUntil: 'networkidle' });
  await prepareHero(page, { hideType: true });
  const pngB = await shootImageBox(page, path.join(args.out, `_scrim-greyB-${args.label}-${vp}.png`));
  await injectKnownOverlay(page, NEGCTL_ALPHA);
  const pngBControl = await shootImageBox(page, path.join(args.out, `_scrim-greyB-negctl-${args.label}-${vp}.png`));
  const fulfilledB = countB();
  await page.close();

  const imageBox = greyGeometry.imageBox;
  const sameGeometry = Math.abs(imageBox.width - geometry.imageBox.width) < 1 && Math.abs(imageBox.height - geometry.imageBox.height) < 1;
  const swapDeviation = meanDeviationFromGrey(pngASwapCheck, imageBox);
  const swapEffective = fulfilledA > 0 && fulfilledB > 0 && swapDeviation <= SWAP_EFFECTIVE_MAX_DEVIATION && sameGeometry;
  verdict('PROBE_SWAP_EFFECTIVE', swapEffective,
    `routes fulfilled A=${fulfilledA} B=${fulfilledB}; scrim-hidden grey deviation ${round(swapDeviation, 2)} (max ${SWAP_EFFECTIVE_MAX_DEVIATION}); geometry ${sameGeometry ? 'stable' : 'CHANGED between passes'}`);

  const profile = profileColumns(pngA, pngB, imageBox);
  const controlProfile = profileColumns(pngAControl, pngBControl, imageBox);
  const summary = summarise(profile);
  const bloom = bloomColour(rawPng, compositePng, geometry.imageBox);
  const cast = castDetectorControl(rawPng, geometry.imageBox);
  const solver = solverControl(profile, controlProfile);

  if (!swapEffective) {
    for (const id of ['SCRIM_X75_MID_ALPHA', 'SCRIM_X25_MID_ALPHA_WINDOW', 'SCRIM_X25_MID_ALPHA_CEILING', 'SCRIM_LATERAL_MONOTONE_MID', 'SCRIM_NEVER_DARKER_THAN_BEFORE', 'NEGCTL_ALPHA_SOLVER_LINEAR']) {
      blocked(id, 'grey swap not effective — nothing learned about the scrim');
    }
  } else {
    verdict('SCRIM_X75_MID_ALPHA', inWindow(summary.x75MidAlpha, X75_MID_ALPHA_WINDOW),
      `x75 mid-height alpha ${summary.x75MidAlpha}, window [${X75_MID_ALPHA_WINDOW}] (R10/1)`);
    verdict('SCRIM_X25_MID_ALPHA_WINDOW', inWindow(summary.x25MidAlpha, X25_MID_ALPHA_WINDOW),
      `x25 mid-height alpha ${summary.x25MidAlpha}, window [${X25_MID_ALPHA_WINDOW}] (R10/2, R10/4) — asserted by the contract at 1280 only`);
    verdict('SCRIM_X25_MID_ALPHA_CEILING', inWindow(summary.x25MidAlpha, [-0.03, X25_MID_ALPHA_CEILING]),
      `x25 mid-height alpha ${summary.x25MidAlpha}, ceiling ${X25_MID_ALPHA_CEILING} (R10/2 "about 0.85")`);
    const monotone = summary.x25MidAlpha - summary.x50MidAlpha >= LATERAL_MIN_STEP && summary.x50MidAlpha - summary.x75MidAlpha >= LATERAL_MIN_STEP;
    verdict('SCRIM_LATERAL_MONOTONE_MID', monotone,
      `mid-height x25 ${summary.x25MidAlpha} > x50 ${summary.x50MidAlpha} > x75 ${summary.x75MidAlpha}, min step ${LATERAL_MIN_STEP} (R10/2 "must fall away by the midline")`);
    verdict('NEGCTL_ALPHA_SOLVER_LINEAR', solver.agreeingFraction >= SOLVER_MIN_AGREEING_FRACTION,
      `injected rgba(14,11,36,${NEGCTL_ALPHA}): ${solver.agreeingFraction} of ${solver.samples} samples within ${SOLVER_TOLERANCE} of prediction, worst ${solver.worstError}`);

    const beforeFile = path.join(args.before, `scrim-profile-before-${vp}.json`);
    if (args.label === 'before') {
      blocked('SCRIM_NEVER_DARKER_THAN_BEFORE', 'this IS the before run — nothing to compare against');
    } else if (!fs.existsSync(beforeFile)) {
      blocked('SCRIM_NEVER_DARKER_THAN_BEFORE', `before profile ${path.relative(REPO_ROOT, beforeFile)} is absent; capture it from the pre-fix tree first`);
    } else {
      const before = JSON.parse(fs.readFileSync(beforeFile, 'utf8'));
      if (!before.profile) {
        blocked('SCRIM_NEVER_DARKER_THAN_BEFORE', 'before profile has no "profile" field');
      } else {
        const nd = neverDarker(profile, before.profile);
        verdict('SCRIM_NEVER_DARKER_THAN_BEFORE', nd.violations === 0,
          `${nd.violations} of ${nd.compared} samples darker than before by more than ${NEVER_DARKER_TOLERANCE}; worst increase ${nd.worstIncrease} at ${JSON.stringify(nd.worstSample)} (R10/3 "alpha does not climb back"); before captured at ${before._head ?? 'unknown'}`);
      }
    }
  }

  if (!bloom.measurable) {
    blocked('BLOOM_OWN_COLOUR_X75_OUTWARD', `only ${bloom.chromaticFraction} of the right-quarter middle band is chromatic in the raw photograph (min ${BLOOM_MIN_CHROMATIC_FRACTION}) — no bloom there to measure; R4/1 says the focal point shifts right`);
  } else {
    const ok = inWindow(bloom.hueShiftDeg, HUE_SHIFT_WINDOW_DEG) && inWindow(bloom.chromaRetention, CHROMA_RETENTION_WINDOW);
    verdict('BLOOM_OWN_COLOUR_X75_OUTWARD', ok,
      `hue shift ${bloom.hueShiftDeg}° (window [${HUE_SHIFT_WINDOW_DEG}]), chroma retention ${bloom.chromaRetention} (window [${CHROMA_RETENTION_WINDOW}]) over ${bloom.chromaticFraction} chromatic pixels (R10/1 "petals in their own colour, not violet")`);
  }
  if (!cast.measurable) blocked('NEGCTL_HUE_DETECTS_CAST', 'no chromatic raw pixels to synthesise a cast over');
  else verdict('NEGCTL_HUE_DETECTS_CAST', cast.detected, `synthetic rgba(14,11,36,${NEGCTL_CAST_OVERLAY.alpha}) cast: hue shift ${cast.hueShiftDeg}°, chroma retention ${cast.chromaRetention} — ${cast.detected ? 'flagged' : 'NOT flagged'}`);

  const result = {
    _probe: PROBE_ID,
    _label: args.label,
    _viewport: vp,
    _captured_at: new Date().toISOString(),
    _head_full: commit.full,
    _head: commit.short,
    _tree: path.relative(REPO_ROOT, args.tree) || '.',
    _base_url: args.base,
    route: args.route,
    verdicts,
    verdict_reasons: reasons,
    summary,
    bloom,
    negctl: { alphaSolver: solver, castDetector: cast },
    geometry,
    greySwapGeometry: { imageBox, currentSrc: greyGeometry.currentSrc, layersRendered: greyGeometry.layersRendered },
    profile,
  };
  fs.writeFileSync(file('profile', 'json'), `${JSON.stringify(result, null, 2)}\n`);
  return verdicts;
}

// -----------------------------------------------------------------------------
// Server lifecycle and main
// -----------------------------------------------------------------------------

function waitForServer(base) {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const poll = () => {
      const req = http.get(base, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new SetupFailure(`server did not respond on ${base} within ${SERVER_START_TIMEOUT_MS}ms`));
        else setTimeout(poll, SERVER_POLL_INTERVAL_MS);
      });
    };
    poll();
  });
}

function stopServer(server) {
  if (!server || server.killed || server.pid === undefined) return;
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    server.kill('SIGTERM');
  }
}

function commitOf(tree) {
  const full = execFileSync('git', ['-C', tree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  return { full, short: full.slice(0, 8) };
}

function exitCodeFor(allVerdicts) {
  const statuses = allVerdicts.flatMap((v) => Object.values(v));
  if (statuses.includes('FAIL')) return 1;
  if (statuses.includes('BLOCKED') || statuses.includes('ERROR')) return 3;
  return 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.out, { recursive: true });
  const commit = commitOf(args.tree);
  const viewports = args.viewport === 'all' ? [390, 1280] : [Number(args.viewport)];

  let server;
  let browser;
  const onSignal = () => {
    stopServer(server);
    process.exit(2);
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  const all = [];
  try {
    if (!args.base) {
      args.base = `http://localhost:${DEFAULT_PORT}`;
      server = spawn('node_modules/.bin/next', ['dev', '--port', String(DEFAULT_PORT)], { cwd: REPO_ROOT, env: process.env, stdio: 'ignore', detached: true });
    }
    await waitForServer(args.base);
    browser = await chromium.launch();
    for (const vp of viewports) {
      const verdicts = await probeViewport(browser, vp, args, commit);
      all.push(verdicts);
      console.log(`${vp}: ${JSON.stringify(verdicts)}`);
    }
  } catch (err) {
    console.error(`SETUP FAILURE: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  } finally {
    if (browser) await browser.close();
    stopServer(server);
  }
  const code = exitCodeFor(all);
  console.log(`label=${args.label} head=${commit.short} → ${path.relative(REPO_ROOT, args.out)} (exit ${code})`);
  return code;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('SETUP FAILURE:', err);
    process.exit(2);
  });
