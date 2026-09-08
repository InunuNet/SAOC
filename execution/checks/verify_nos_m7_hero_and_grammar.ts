/**
 * Contract driver for nos-design-system / M7 (contract-m7.yaml, A1).
 *
 * Commissioned by `.agent/memory/project/specs/nos-design-system/goldens/m7/verifier-contract.golden.md`;
 * the assertions themselves are defined by `hero-dom.golden.md` (D-ids) and
 * `token-grammar.golden.md` (§-ids) in the same directory. Sibling for structure and idiom:
 * `execution/checks/verify_nav_mega_menu.ts` (same dev-server spawn, same readiness poll,
 * same `exit 2` for setup failure).
 *
 * One Playwright run drives every browser-measured M7 check against `/national-show` (plus
 * `/societies` and `/national-show/plan-your-visit` for the two guards) at 390 / 1024 / 1280,
 * and writes two files:
 *
 *   .tmp/sandbox/nos-m7/results.json   flat  { "<ID>": "PASS" | "FAIL" | "BLOCKED" | "ERROR" }
 *                                      plus `_generated_at` and `_commit`; one key per line so
 *                                      the contract's `grep -q '"<ID>": "PASS"'` matches a line.
 *   .tmp/sandbox/nos-m7/detail.json    the measured values / reasons, keyed by the same ids.
 *                                      NEVER merged into results.json (a detail string containing
 *                                      "PASS" on an id's line would satisfy the gate grep).
 *   .tmp/sandbox/nos-m7/shots/*.png    every clip that produced a number, so a failure can be
 *                                      looked at rather than argued about.
 *
 * Status vocabulary — the reason this script exists (QA 2026-09-08 raised seven candidate
 * defects against M7; all seven were harness bugs, six of them "could not find the target"
 * reported as FAIL):
 *
 *   PASS     the property holds.
 *   FAIL     the harness located its target, measured it, and the property does not hold.
 *   BLOCKED  the harness could not locate its target or a precondition (baseline file, a
 *            countdown that only renders when a date is set, keyboard focus that never landed)
 *            — nothing was learned about the code. Never collapsed into FAIL.
 *   ERROR    the check threw. Also never collapsed into FAIL.
 *
 * A gate grep for `"PASS"` still fails on BLOCKED/ERROR, so the contract stays honest; the
 * distinction is for the human deciding whether the *code* or the *harness* is wrong.
 *
 * Exit codes:
 *   0  every check PASS
 *   1  harness ran; at least one check FAIL
 *   2  setup failure — server never ready, Playwright missing, page threw, hero image missing
 *   3  harness ran; no FAIL, but at least one check BLOCKED or ERROR (nothing learned for it)
 *
 * Measurement rules encoded here (each one is a harness bug that already happened once):
 *   - Stable selectors only: `div[aria-label^="Countdown"]`, `img[src*="disa-graminifolia"]`,
 *     `img.object-cover`, `[data-nos-masthead]`, `[data-nos-colophon]`, `h1`. Never a class-name
 *     substring guess, never a page-wide `.first()` for an element with siblings.
 *   - Contrast is read from composited screenshot pixels (pngjs) under the glyph boxes — never
 *     by parsing `getComputedStyle().color` (Tailwind v4 serialises opacity-modified colours
 *     as `oklab()`; InunuNet/SAOC#3). Ground is obtained by re-shooting the same clip with the
 *     element's own `color` made transparent, so the ground under each glyph pixel is real.
 *   - The bloom metric samples an ANNULUS around the emblem (its rect masked out), never a
 *     padded box that contains the emblem — the emblem's own ink is not "bloom". At 390 the
 *     hero stacks, so the check is rect intersection (exact); at 1024/1280 the photograph is a
 *     full-bleed background under every rect, so only composited pixels can answer. The
 *     classifier departs from the golden's HSL formula, which scores near-white as maximally
 *     saturated — see the D2.1 note at the constants.
 *   - Focus-ring checks assert that the focused capture differs from the unfocused one BEFORE
 *     drawing any conclusion; computed outline is read AFTER focus lands; every edge and
 *     corner is a majority vote over ≥7 samples on the ring's expected centreline, never a
 *     single pixel.
 *   - `SCRIM_UNCHANGED` needs a baseline captured from the PRE-M7 build. If the baseline file
 *     is absent the check is BLOCKED with the reason; this script never generates the baseline
 *     from the tree under test (that would compare the change against itself).
 *
 * Run: node_modules/.bin/tsx execution/checks/verify_nos_m7_hero_and_grammar.ts
 *
 * Env (both optional, both for local iteration only — the contract runs without them):
 *   NOS_M7_BASE_URL   use an already-running server instead of spawning one on 3412.
 *   NOS_M7_ONLY       comma-separated id prefixes to run; results go to results.smoke.json /
 *                     detail.smoke.json so a partial run can never satisfy the gate.
 */

import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';

import { PNG } from 'pngjs';
import { chromium, type Browser, type Locator, type Page } from 'playwright';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PORT = 3412;
const BASE_URL = process.env.NOS_M7_BASE_URL ?? `http://localhost:${PORT}`;
const SPAWN_SERVER = process.env.NOS_M7_BASE_URL === undefined;
const ONLY = (process.env.NOS_M7_ONLY ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const SMOKE = ONLY.length > 0;

const SANDBOX_DIR = path.join(REPO_ROOT, '.tmp', 'sandbox', 'nos-m7');
const SHOTS_DIR = path.join(SANDBOX_DIR, 'shots');
const RESULTS_FILE = path.join(SANDBOX_DIR, SMOKE ? 'results.smoke.json' : 'results.json');
const DETAIL_FILE = path.join(SANDBOX_DIR, SMOKE ? 'detail.smoke.json' : 'detail.json');
const SCRIM_BASELINE_FILE = path.join(
  REPO_ROOT,
  '.agent/memory/project/specs/nos-design-system/goldens/m7/scrim-baseline.json',
);

const SERVER_START_TIMEOUT_MS = 120_000;
const SERVER_POLL_INTERVAL_MS = 500;
const PAGE_LOAD_TIMEOUT_MS = 60_000;

const DPR = 2;
const VIEWPORTS = {
  390: { width: 390, height: 844 },
  1024: { width: 1024, height: 768 },
  1280: { width: 1280, height: 900 },
} as const;
type ViewportKey = keyof typeof VIEWPORTS;

const H1_TEXT_EXPECTED = 'The South African National Orchid Show';
const H1_LINES_EXPECTED = 2;
const FONT_SIZE_TOLERANCE_PX = 0.5;
const EMBLEM_MAX_WIDTH_FRACTION_OF_H1 = 0.25;
const ACTION_HREFS_EXPECTED = ['/tickets', '/contact', '/societies'];
const ACTION_RADIUS_EXPECTED = '2px';
const ACTION_HEIGHT_TOLERANCE_PX = 2;
const MIN_VISIBLE_BORDER_PX = 1;
const MIN_CONTRAST_RATIO = 4.5;

// D2.1 bloom metric — DEPARTS from the golden's formula, deliberately (flagged to @architect):
//
//   The golden classifies a pixel as bloom-like when HSL `saturation ≥ 0.35 AND lightness ≥
//   0.35`. HSL saturation is normalised against the distance from white/black, so it blows up
//   at either lightness extreme: the emblem's own ivory, rgb(255,255,240), computes to s=1.0,
//   l=0.97 — "maximally bloom-like" for a near-white pixel. Any bright low-chroma surface
//   misfires the same way. The classifier here uses ABSOLUTE chroma ((max−min)/255) with a
//   lightness floor AND ceiling, so near-white and near-black are excluded by construction.
//
//   Calibration against the live composited hero (2026-09-08, orchid-violet.jpg, focal point
//   51% 37%), fraction bloom-like in a 96px control rect on the focal point vs the 8px annulus
//   around the hero emblem: chroma≥0.08/l≥0.15 → 99%/0% at 1280, 95%/0% at 1024;
//   chroma≥0.08/l≥0.20 → 29%/0%; chroma≥0.12 (any l) → 0%/0%. The focal point sits under all
//   three scrims stacked to roughly 86% opacity at 1280, which is why the composited bloom is
//   this dark and this desaturated — the lightness floor sits on a cliff (0.15 passes, 0.25
//   fails), and NEGCTL_BLOOM_METRIC_DISCRIMINATES is what will say so if the scrim moves.
//   Retuning still requires an implementation note in hero-dom.golden.md AND the control green.
const BLOOM_MIN_CHROMA = 0.08;
const BLOOM_MIN_LIGHTNESS = 0.15;
const BLOOM_MAX_LIGHTNESS = 0.9;
const BLOOM_CLEAR_MAX_FRACTION = 0.02;
const EMBLEM_ANNULUS_PAD_PX = 8;
const BLOOM_CONTROL_RECT_PX = 96;
// The hero brandMark is the 64px EmblemBadge (NosHero.tsx via page.tsx); the masthead carries a
// 56px and a 66px copy. A hero-scoped locator already excludes those, but the width is the
// sanity check that the scope held — measuring 56px means the masthead was picked up.
const HERO_EMBLEM_WIDTH_PX = 64;
const HERO_EMBLEM_WIDTH_TOLERANCE_PX = 2;

// Focus ring geometry. Button.tsx: outline 2px, outline-offset 2px, border-radius 2px.
// The ring's centreline is therefore offset + width/2 = 3px outside the border box, and at a
// corner it is an arc of radius (radius + offset + width/2) = 5px around a centre 2px inside.
const RING_OUTLINE_OFFSET_PX = 2;
const RING_OUTLINE_WIDTH_PX = 2;
const RING_CORNER_RADIUS_PX = 2;
const RING_CENTRELINE_PX = RING_OUTLINE_OFFSET_PX + RING_OUTLINE_WIDTH_PX / 2;
const RING_CORNER_ARC_PX = RING_CORNER_RADIUS_PX + RING_OUTLINE_OFFSET_PX + RING_OUTLINE_WIDTH_PX / 2;
const RING_BAND_PAD_PX = RING_OUTLINE_OFFSET_PX + RING_OUTLINE_WIDTH_PX + 2;
const EDGE_SAMPLES = 8;
const EDGE_END_MARGIN_FRACTION = 0.15;
const EDGE_MAJORITY = 5;
const CORNER_SAMPLES = 7;
const CORNER_MAJORITY = 4;
const PIXEL_CHANGE_THRESHOLD = 24; // 0–255, max channel delta
const SAMPLE_NEIGHBOURHOOD_DEVICE_PX = 1; // 3×3 device-pixel neighbourhood per sample
const MAX_TABS_TO_REACH_ACTION = 12;

// Contrast — glyph pixels are those that change when the element's colour is made
// transparent; "core" glyph pixels are the strongest 40% of that change (anti-aliased edges
// excluded). The reported ratio is the 5th percentile of per-pixel contrast over the core, so a
// bright ground under any real part of the glyph box drags the number down.
const MIN_GLYPH_DIFF = 20;
const GLYPH_CORE_FRACTION = 0.6;
const CONTRAST_PERCENTILE = 0.05;
const NEGCTL_PROBE_COLOR = 'rgba(251, 250, 240, 0.15)';

// Pre-M7 title scale, verbatim from HEAD (24f87e05) `components/nos/NosHero.tsx` — the golden's
// D2.3 requires the other eleven heroes to keep it. Expressed as a function so the expectation
// is derived from the documented clamp, not read back from the tree under test.
const PRE_M7_TITLE_CLAMP = { minPx: 36, vw: 5.6, maxPx: 64 };
// Pre-M7 gradient literals, verbatim from HEAD (24f87e05) `components/nos/NosHero.tsx`, reduced
// to their numeric fingerprints (the engine reserialises whitespace and `to <side>` keywords, so
// string equality against a literal is brittle; the colour stops and opacities are not).
const PRE_M7_SCRIM_FINGERPRINTS = [
  [14, 11, 36, 0.95, 0, 14, 11, 36, 0.82, 30, 14, 11, 36, 0.45, 58, 14, 11, 36, 0, 88],
  [14, 11, 36, 0.85, 0, 14, 11, 36, 0.55, 42, 14, 11, 36, 0.12, 72, 14, 11, 36, 0, 100],
];

const RADIUS_PILL_MAX_PX = 4; // anything above this needs an allowlist reason
const PILL_CHIP_MAX_HEIGHT_PX = 48; // eyebrow pills are chips, not panels
const RAIL_DOT_SIZE_PX = 12; // CycleStep.tsx:41 — h-3 w-3 rounded-full
const RAIL_DOT_TOLERANCE_PX = 1;

const CHECK_IDS = [
  // D1
  'H1_TEXT',
  'H1_FONT_CORMORANT',
  'H1_SENTENCE_CASE',
  'H1_DISPLAY_XL',
  'H1_TWO_LINES_390',
  'H1_TWO_LINES_1024',
  'H1_TWO_LINES_1280',
  'EMBLEM_ABOVE_H1',
  'HERO_NO_LOCKUP',
  'LOCKUP_IN_CHROME',
  'LOCKUP_NOT_GLOBAL',
  // D2
  'HERO_OBJECT_POSITION',
  'BLOOM_CLEAR_OF_EMBLEM_390',
  'BLOOM_CLEAR_OF_EMBLEM_1024',
  'BLOOM_CLEAR_OF_EMBLEM_1280',
  'BLOOM_BELOW_TYPE_390',
  'SCRIM_UNCHANGED',
  'CONTRAST_H1_390',
  'CONTRAST_H1_1024',
  'CONTRAST_H1_1280',
  'CONTRAST_LEDE_1024',
  'CONTRAST_EYEBROW_1024',
  // D3
  'ACTIONS_COUNT_THREE',
  'ACTIONS_RADIUS_2PX',
  'ACTIONS_NO_UNDERLINE',
  'ACTIONS_ONE_FILLED',
  'ACTIONS_EQUAL_WEIGHT',
  'ACTIONS_HREFS',
  'ACTIONS_FOCUS_RING_EDGES',
  'ACTIONS_FOCUS_RING_CORNERS',
  'ACTIONS_FOCUS_NOT_CLIPPED',
  'ACTIONS_FOCUS_IS_OUTLINE',
  'CONTRAST_ACTION_LABELS_1024',
  // D4
  'EYEBROW_MATCHES_COUNTDOWN',
  'EYEBROW_UPPERCASE',
  'EYEBROW_ABOVE_COUNTDOWN',
  // token grammar
  'RADIUS_CARDS_ZERO',
  'RADIUS_PILL_ALLOWLIST',
  'BORDER_PRIMARY_1PX',
  'NO_SHADOWS',
  'SHADOW_TOKEN_GONE',
  // regression guard
  'OTHER_HERO_UNCHANGED',
  // negative controls
  'NEGCTL_CONTRAST_DETECTS_FAILURE',
  'NEGCTL_BLOOM_METRIC_DISCRIMINATES',
] as const;
type CheckId = (typeof CHECK_IDS)[number];
type Status = 'PASS' | 'FAIL' | 'BLOCKED' | 'ERROR';

// ---------------------------------------------------------------------------
// Errors and the recorder
// ---------------------------------------------------------------------------

/** The suite cannot start or continue; exit 2. */
class SetupFailure extends Error {}
/** A check's target or precondition is missing; the check is BLOCKED, not FAIL. */
class Blocked extends Error {}

class Recorder {
  readonly results = new Map<CheckId, Status>();
  readonly detail: Record<string, unknown> = {};

  wants(id: CheckId): boolean {
    return !SMOKE || ONLY.some((prefix) => id.startsWith(prefix));
  }

  set(id: CheckId, status: Status, detail: unknown): void {
    this.results.set(id, status);
    this.detail[id] = detail;
    console.log(`${status}: ${id}`);
  }

  verdict(id: CheckId, ok: boolean, detail: unknown): void {
    this.set(id, ok ? 'PASS' : 'FAIL', detail);
  }

  blocked(id: CheckId, reason: string): void {
    this.set(id, 'BLOCKED', { reason });
  }

  error(id: CheckId, err: unknown): void {
    const text = err instanceof Error ? (err.stack ?? err.message) : String(err);
    this.set(id, 'ERROR', { error: text });
  }
}

/**
 * Runs one check body. A `Blocked` throw marks every listed id not yet recorded as BLOCKED;
 * any other throw marks them ERROR; a SetupFailure propagates. Ids the smoke filter did not
 * select are skipped entirely (and stay absent from the smoke results file).
 */
async function guarded(rec: Recorder, ids: CheckId[], body: () => Promise<void>): Promise<void> {
  if (!ids.some((id) => rec.wants(id))) return;
  try {
    await body();
  } catch (err) {
    if (err instanceof SetupFailure) throw err;
    for (const id of ids) {
      if (rec.results.has(id)) continue;
      if (err instanceof Blocked) rec.blocked(id, err.message);
      else rec.error(id, err);
    }
  }
}

// ---------------------------------------------------------------------------
// Geometry, pixels, colour maths
// ---------------------------------------------------------------------------

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Shot {
  png: PNG;
  /** Page-coordinate origin of the clip, CSS px. */
  clip: { x: number; y: number; width: number; height: number };
  file: string;
}

function expandBox(b: Box, pad: number): Box {
  return { x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad };
}

function boxContains(outer: Box, inner: Box): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

function pointInBox(b: Box, x: number, y: number): boolean {
  return x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
}

function pixelAt(png: PNG, dx: number, dy: number): Rgb | null {
  const x = Math.round(dx);
  const y = Math.round(dy);
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return null;
  const i = (png.width * y + x) << 2;
  return { r: png.data[i], g: png.data[i + 1], b: png.data[i + 2] };
}

/** Device-pixel coordinates inside a shot for a CSS-px page coordinate. */
function toDevice(shot: Shot, x: number, y: number): { dx: number; dy: number } {
  return { dx: (x - shot.clip.x) * DPR, dy: (y - shot.clip.y) * DPR };
}

function channelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(p: Rgb): number {
  return 0.2126 * channelToLinear(p.r) + 0.7152 * channelToLinear(p.g) + 0.0722 * channelToLinear(p.b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Absolute chroma and HSL lightness — never HSL saturation (see the D2.1 note above). */
function chromaLightness(p: Rgb): { chroma: number; lightness: number } {
  const max = Math.max(p.r, p.g, p.b);
  const min = Math.min(p.r, p.g, p.b);
  return { chroma: (max - min) / 255, lightness: (max + min) / 2 / 255 };
}

function isBloomLike(p: Rgb): boolean {
  const { chroma, lightness } = chromaLightness(p);
  return chroma >= BLOOM_MIN_CHROMA && lightness >= BLOOM_MIN_LIGHTNESS && lightness <= BLOOM_MAX_LIGHTNESS;
}

function maxChannelDelta(a: Rgb, b: Rgb): number {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
}

function numericFingerprint(gradient: string): number[] {
  return (gradient.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

function sameNumbers(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------

async function pageBox(loc: Locator): Promise<Box> {
  return loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
  });
}

/** Exactly one match or a Blocked throw naming what could not be located. */
async function exactlyOne(loc: Locator, what: string): Promise<Locator> {
  const n = await loc.count();
  if (n !== 1) throw new Blocked(`could not locate ${what}: expected 1 match, found ${n}`);
  return loc.first();
}

async function blurActive(page: Page): Promise<void> {
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
}

async function shotClip(page: Page, box: Box, name: string): Promise<Shot> {
  const x = Math.floor(box.x);
  const y = Math.floor(box.y);
  const clip = { x, y, width: Math.ceil(box.x + box.w) - x, height: Math.ceil(box.y + box.h) - y };
  if (clip.width < 1 || clip.height < 1) throw new Blocked(`${name}: zero-size clip`);
  const file = path.join(SHOTS_DIR, `${name}.png`);
  const buf = await page.screenshot({ clip, fullPage: true, path: file, animations: 'disabled' });
  return { png: PNG.sync.read(buf), clip, file };
}

async function openPage(browser: Browser, vp: ViewportKey, route: string): Promise<Page> {
  const page = await browser.newPage({ viewport: VIEWPORTS[vp], deviceScaleFactor: DPR });
  page.setDefaultTimeout(PAGE_LOAD_TIMEOUT_MS);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
  if (!response || response.status() >= 400) {
    throw new SetupFailure(`${route} responded ${response?.status() ?? 'no response'}`);
  }
  await page.evaluate(() => document.fonts.ready);
  if (pageErrors.length > 0) {
    throw new SetupFailure(`${route} threw in the page: ${pageErrors.join(' | ')}`);
  }
  return page;
}

/** The hero is the closest `<section>` ancestor of the page's `<h1>`; every hero locator is scoped to it. */
async function heroOf(page: Page): Promise<Locator> {
  const h1 = await exactlyOne(page.locator('h1'), 'the page <h1>');
  return exactlyOne(h1.locator('xpath=ancestor::section[1]'), 'the hero <section> around <h1>');
}

async function waitForHeroImage(hero: Locator, route: string): Promise<Locator> {
  const img = await exactlyOne(hero.locator('img.object-cover'), 'the hero photograph (img.object-cover)');
  const loaded = await img.evaluate(
    (el) =>
      new Promise<boolean>((resolve) => {
        const image = el as HTMLImageElement;
        if (image.complete) return resolve(image.naturalWidth > 0);
        image.addEventListener('load', () => resolve(image.naturalWidth > 0), { once: true });
        image.addEventListener('error', () => resolve(false), { once: true });
      }),
  );
  if (!loaded) throw new SetupFailure(`${route}: hero photograph did not load (404 or decode failure)`);
  return img;
}

// ---------------------------------------------------------------------------
// Measurement primitives
// ---------------------------------------------------------------------------

interface ContrastResult {
  ratioP05: number;
  ratioMedian: number;
  ratioMin: number;
  corePixels: number;
  maxGlyphDelta: number;
  shots: string[];
}

/**
 * Composited-pixel contrast for a text element. Two captures of the same clip: one as
 * rendered, one with the element's own `color` (and its transition) made transparent so only
 * the ground remains. Glyph pixels are where the two differ; the ratio is computed per core
 * glyph pixel against the ground pixel at the same coordinate.
 */
async function measureTextContrast(page: Page, el: Locator, name: string): Promise<ContrastResult> {
  const box = await pageBox(el);
  if (box.w < 1 || box.h < 1) throw new Blocked(`${name}: element has no box`);
  const inked = await shotClip(page, box, `${name}-inked`);
  await el.evaluate((node) => {
    const h = node as HTMLElement;
    h.dataset.m7Color = h.style.color;
    h.dataset.m7Transition = h.style.transition;
    h.style.transition = 'none';
    h.style.color = 'transparent';
  });
  let ground: Shot;
  try {
    ground = await shotClip(page, box, `${name}-ground`);
  } finally {
    await el.evaluate((node) => {
      const h = node as HTMLElement;
      h.style.color = h.dataset.m7Color ?? '';
      h.style.transition = h.dataset.m7Transition ?? '';
      delete h.dataset.m7Color;
      delete h.dataset.m7Transition;
    });
  }
  const { width, height } = inked.png;
  const deltas = new Float64Array(width * height);
  let maxDelta = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = pixelAt(inked.png, x, y);
      const b = pixelAt(ground.png, x, y);
      if (!a || !b) continue;
      const d = maxChannelDelta(a, b);
      deltas[y * width + x] = d;
      if (d > maxDelta) maxDelta = d;
    }
  }
  if (maxDelta < MIN_GLYPH_DIFF) {
    throw new Blocked(`${name}: no glyph pixels detected (max channel delta ${maxDelta})`);
  }
  const coreThreshold = maxDelta * GLYPH_CORE_FRACTION;
  const ratios: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (deltas[y * width + x] < coreThreshold) continue;
      const a = pixelAt(inked.png, x, y);
      const b = pixelAt(ground.png, x, y);
      if (a && b) ratios.push(contrastRatio(a, b));
    }
  }
  ratios.sort((p, q) => p - q);
  const at = (f: number) => ratios[Math.min(ratios.length - 1, Math.floor(f * ratios.length))];
  return {
    ratioP05: round2(at(CONTRAST_PERCENTILE)),
    ratioMedian: round2(at(0.5)),
    ratioMin: round2(ratios[0]),
    corePixels: ratios.length,
    maxGlyphDelta: maxDelta,
    shots: [inked.file, ground.file],
  };
}

interface BloomResult {
  sampled: number;
  bloomLike: number;
  fraction: number;
}

/** D2.1 metric over every device pixel of `rect` (page CSS px), excluding `mask` if given. */
function bloomStats(shot: Shot, rect: Box, mask?: Box): BloomResult {
  let sampled = 0;
  let bloomLike = 0;
  const step = 1 / DPR;
  for (let y = rect.y; y < rect.y + rect.h; y += step) {
    for (let x = rect.x; x < rect.x + rect.w; x += step) {
      if (mask && pointInBox(mask, x, y)) continue;
      const { dx, dy } = toDevice(shot, x, y);
      const p = pixelAt(shot.png, dx, dy);
      if (!p) continue;
      sampled++;
      if (isBloomLike(p)) bloomLike++;
    }
  }
  return { sampled, bloomLike, fraction: sampled === 0 ? 0 : round2(bloomLike / sampled) };
}

/** True when any device pixel in the sample's 3×3 neighbourhood changed between two shots. */
function changedAt(before: Shot, after: Shot, x: number, y: number): boolean {
  const { dx, dy } = toDevice(before, x, y);
  for (let oy = -SAMPLE_NEIGHBOURHOOD_DEVICE_PX; oy <= SAMPLE_NEIGHBOURHOOD_DEVICE_PX; oy++) {
    for (let ox = -SAMPLE_NEIGHBOURHOOD_DEVICE_PX; ox <= SAMPLE_NEIGHBOURHOOD_DEVICE_PX; ox++) {
      const a = pixelAt(before.png, dx + ox, dy + oy);
      const b = pixelAt(after.png, dx + ox, dy + oy);
      if (a && b && maxChannelDelta(a, b) > PIXEL_CHANGE_THRESHOLD) return true;
    }
  }
  return false;
}

function countChangedPixels(before: Shot, after: Shot): number {
  let changed = 0;
  for (let y = 0; y < before.png.height; y++) {
    for (let x = 0; x < before.png.width; x++) {
      const a = pixelAt(before.png, x, y);
      const b = pixelAt(after.png, x, y);
      if (a && b && maxChannelDelta(a, b) > PIXEL_CHANGE_THRESHOLD) changed++;
    }
  }
  return changed;
}

/** Sample points on the ring centreline along one edge, excluding the corner regions. */
function edgeSamples(box: Box, edge: 'top' | 'right' | 'bottom' | 'left'): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < EDGE_SAMPLES; i++) {
    const t = EDGE_END_MARGIN_FRACTION + (i / (EDGE_SAMPLES - 1)) * (1 - 2 * EDGE_END_MARGIN_FRACTION);
    switch (edge) {
      case 'top':
        pts.push([box.x + t * box.w, box.y - RING_CENTRELINE_PX]);
        break;
      case 'bottom':
        pts.push([box.x + t * box.w, box.y + box.h + RING_CENTRELINE_PX]);
        break;
      case 'left':
        pts.push([box.x - RING_CENTRELINE_PX, box.y + t * box.h]);
        break;
      case 'right':
        pts.push([box.x + box.w + RING_CENTRELINE_PX, box.y + t * box.h]);
        break;
    }
  }
  return pts;
}

/** Sample points on the ring's corner arc (radius RING_CORNER_ARC_PX around the corner centre). */
function cornerSamples(box: Box, corner: 'tl' | 'tr' | 'br' | 'bl'): Array<[number, number]> {
  const r = RING_CORNER_RADIUS_PX;
  const centres = {
    tl: { cx: box.x + r, cy: box.y + r, from: 180 },
    tr: { cx: box.x + box.w - r, cy: box.y + r, from: 270 },
    br: { cx: box.x + box.w - r, cy: box.y + box.h - r, from: 0 },
    bl: { cx: box.x + r, cy: box.y + box.h - r, from: 90 },
  } as const;
  const { cx, cy, from } = centres[corner];
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < CORNER_SAMPLES; i++) {
    const deg = from + 5 + (i / (CORNER_SAMPLES - 1)) * 80;
    const rad = (deg * Math.PI) / 180;
    pts.push([cx + RING_CORNER_ARC_PX * Math.cos(rad), cy + RING_CORNER_ARC_PX * Math.sin(rad)]);
  }
  return pts;
}

function majority(before: Shot, after: Shot, pts: Array<[number, number]>, need: number) {
  const hits = pts.filter(([x, y]) => changedAt(before, after, x, y)).length;
  return { hits, of: pts.length, ok: hits >= need };
}

// ---------------------------------------------------------------------------
// Per-viewport hero checks (run at 390, 1024 and 1280)
// ---------------------------------------------------------------------------

async function h1LineCount(h1: Locator): Promise<number> {
  return h1.evaluate((el) => {
    const tops = new Set<number>();
    const range = document.createRange();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      range.selectNodeContents(node);
      for (const r of Array.from(range.getClientRects())) {
        if (r.width > 0 && r.height > 0) tops.add(Math.round(r.top));
      }
      node = walker.nextNode();
    }
    return tops.size;
  });
}

async function heroChecksAtViewport(rec: Recorder, browser: Browser, vp: ViewportKey): Promise<void> {
  const lineId = `H1_TWO_LINES_${vp}` as CheckId;
  const bloomId = `BLOOM_CLEAR_OF_EMBLEM_${vp}` as CheckId;
  const contrastId = `CONTRAST_H1_${vp}` as CheckId;
  const wanted: CheckId[] = [lineId, bloomId, contrastId];
  if (vp === 390) wanted.push('BLOOM_BELOW_TYPE_390');
  if (vp === 1024) {
    wanted.push('CONTRAST_LEDE_1024', 'CONTRAST_EYEBROW_1024', 'CONTRAST_ACTION_LABELS_1024');
  }
  if (!wanted.some((id) => rec.wants(id))) return;

  const page = await openPage(browser, vp, '/national-show');
  try {
    const hero = await heroOf(page);
    const h1 = hero.locator('h1');
    const img = await waitForHeroImage(hero, '/national-show');
    await blurActive(page);

    await guarded(rec, [lineId], async () => {
      const lines = await h1LineCount(h1);
      rec.verdict(lineId, lines === H1_LINES_EXPECTED, { lines, expected: H1_LINES_EXPECTED });
    });

    // One composited hero capture per viewport feeds every bloom measurement at that width.
    const heroBox = await pageBox(hero);
    const heroShot = await shotClip(page, heroBox, `hero-${vp}`);

    await guarded(rec, [bloomId], async () => {
      const emblems = hero.locator('img[src*="disa-graminifolia"]');
      const n = await emblems.count();
      if (n !== 1) throw new Blocked(`expected 1 emblem img[src*="disa-graminifolia"] in the hero, found ${n}`);
      const emblemBox = await pageBox(emblems.first());
      if (Math.abs(emblemBox.w - HERO_EMBLEM_WIDTH_PX) > HERO_EMBLEM_WIDTH_TOLERANCE_PX) {
        throw new Blocked(
          `hero emblem measured ${round2(emblemBox.w)}px wide, expected ${HERO_EMBLEM_WIDTH_PX}px — ` +
            'the locator is probably reading a masthead copy (56px / 66px), not the hero brandMark',
        );
      }
      const padded = expandBox(emblemBox, EMBLEM_ANNULUS_PAD_PX);
      const imgBox = await pageBox(img);
      if (vp === 390) {
        // Below `sm` the hero stacks and the photograph is an in-flow band under the type
        // column, so "does the mark sit over the bloom" is a geometric question with an exact
        // answer: the padded emblem rect and the photograph rect must not intersect at all.
        const intersects =
          padded.x < imgBox.x + imgBox.w &&
          padded.x + padded.w > imgBox.x &&
          padded.y < imgBox.y + imgBox.h &&
          padded.y + padded.h > imgBox.y;
        rec.verdict(bloomId, !intersects, {
          method: 'rect intersection (stacked layout): padded emblem rect vs photograph rect',
          paddedEmblemBox: padded,
          imageBox: imgBox,
          gapPx: round2(imgBox.y - (padded.y + padded.h)),
        });
        return;
      }
      // From `sm` up the photograph is a full-bleed absolute background under the whole text
      // column, so every rect intersects it by layout and only the composited pixels can say
      // whether the mark sits over the lit bloom.
      const stats = bloomStats(heroShot, padded, emblemBox);
      rec.verdict(bloomId, stats.fraction < BLOOM_CLEAR_MAX_FRACTION, {
        ...stats,
        method: `annulus ${EMBLEM_ANNULUS_PAD_PX}px around the emblem rect, emblem pixels masked`,
        classifier: { minChroma: BLOOM_MIN_CHROMA, minLightness: BLOOM_MIN_LIGHTNESS, maxLightness: BLOOM_MAX_LIGHTNESS },
        emblemBox,
        shot: heroShot.file,
      });
    });

    if (vp === 390) {
      await guarded(rec, ['BLOOM_BELOW_TYPE_390'], async () => {
        const column = await exactlyOne(h1.locator('xpath=..'), 'the hero type column (h1 parent)');
        const columnBox = await pageBox(column);
        const imgBox = await pageBox(img);
        rec.verdict('BLOOM_BELOW_TYPE_390', imgBox.y >= columnBox.y + columnBox.h - 0.5, {
          imageTop: round2(imgBox.y),
          typeBlockBottom: round2(columnBox.y + columnBox.h),
        });
      });
    }

    await guarded(rec, [contrastId], async () => {
      const r = await measureTextContrast(page, h1, `h1-${vp}`);
      rec.verdict(contrastId, r.ratioP05 >= MIN_CONTRAST_RATIO, { ...r, threshold: MIN_CONTRAST_RATIO });
    });

    if (vp === 1024) {
      await guarded(rec, ['CONTRAST_LEDE_1024'], async () => {
        const lede = await exactlyOne(hero.locator('h1 + p'), 'the hero lede (h1 + p)');
        const r = await measureTextContrast(page, lede, 'lede-1024');
        rec.verdict('CONTRAST_LEDE_1024', r.ratioP05 >= MIN_CONTRAST_RATIO, r);
      });
      await guarded(rec, ['CONTRAST_EYEBROW_1024'], async () => {
        const eyebrow = await exactlyOne(
          hero.locator('p', { hasText: /^\s*opens in\s*$/i }),
          'the "Opens in" eyebrow <p>',
        );
        const r = await measureTextContrast(page, eyebrow, 'eyebrow-1024');
        rec.verdict('CONTRAST_EYEBROW_1024', r.ratioP05 >= MIN_CONTRAST_RATIO, r);
      });
      await guarded(rec, ['CONTRAST_ACTION_LABELS_1024'], async () => {
        const row = await actionRow(hero);
        const controls = row.locator(':scope > a, :scope > button');
        const n = await controls.count();
        if (n === 0) throw new Blocked('the action row has no controls to measure');
        const per: Record<string, ContrastResult> = {};
        let allOk = true;
        for (let i = 0; i < n; i++) {
          const c = controls.nth(i);
          const href = (await c.getAttribute('href')) ?? `control-${i}`;
          const r = await measureTextContrast(page, c, `action-${i}-1024`);
          per[href] = r;
          if (r.ratioP05 < MIN_CONTRAST_RATIO) allOk = false;
        }
        rec.verdict('CONTRAST_ACTION_LABELS_1024', allOk, per);
      });
    }
  } finally {
    await page.close();
  }
}

/** The hero action row is the element whose direct children include the /tickets control. */
async function actionRow(hero: Locator): Promise<Locator> {
  const tickets = hero.locator('a[href="/tickets"], button[data-href="/tickets"]');
  const n = await tickets.count();
  if (n !== 1) throw new Blocked(`expected 1 a[href="/tickets"] in the hero, found ${n}`);
  return tickets.first().locator('xpath=..');
}

// ---------------------------------------------------------------------------
// Structural checks at 1280 — D1, D2 object-position/scrim, D3, D4, tokens, N2
// ---------------------------------------------------------------------------

async function structuralChecks1280(rec: Recorder, browser: Browser): Promise<void> {
  const ids: CheckId[] = [
    'H1_TEXT', 'H1_FONT_CORMORANT', 'H1_SENTENCE_CASE', 'H1_DISPLAY_XL', 'EMBLEM_ABOVE_H1',
    'HERO_NO_LOCKUP', 'LOCKUP_IN_CHROME', 'HERO_OBJECT_POSITION', 'SCRIM_UNCHANGED',
    'ACTIONS_COUNT_THREE', 'ACTIONS_RADIUS_2PX', 'ACTIONS_NO_UNDERLINE', 'ACTIONS_ONE_FILLED',
    'ACTIONS_EQUAL_WEIGHT', 'ACTIONS_HREFS', 'ACTIONS_FOCUS_RING_EDGES',
    'ACTIONS_FOCUS_RING_CORNERS', 'ACTIONS_FOCUS_NOT_CLIPPED', 'ACTIONS_FOCUS_IS_OUTLINE',
    'EYEBROW_MATCHES_COUNTDOWN', 'EYEBROW_UPPERCASE', 'EYEBROW_ABOVE_COUNTDOWN',
    'RADIUS_CARDS_ZERO', 'RADIUS_PILL_ALLOWLIST', 'BORDER_PRIMARY_1PX', 'NO_SHADOWS',
    'SHADOW_TOKEN_GONE', 'NEGCTL_BLOOM_METRIC_DISCRIMINATES',
  ];
  if (!ids.some((id) => rec.wants(id))) return;

  const page = await openPage(browser, 1280, '/national-show');
  try {
    const hero = await heroOf(page);
    const h1 = hero.locator('h1');
    const img = await waitForHeroImage(hero, '/national-show');
    await blurActive(page);

    await headlineChecks(rec, page, hero, h1);
    await lockupChecks(rec, page, hero);
    await cropChecks(rec, page, hero, img);
    await eyebrowChecks(rec, hero);
    await tokenChecks(rec, page);
    // Focus changes scroll position and paints rings; it runs last on this page.
    await actionChecks(rec, page, hero);
  } finally {
    await page.close();
  }
}

async function headlineChecks(rec: Recorder, page: Page, hero: Locator, h1: Locator): Promise<void> {
  await guarded(rec, ['H1_TEXT', 'H1_FONT_CORMORANT', 'H1_SENTENCE_CASE', 'H1_DISPLAY_XL'], async () => {
    const info = await h1.evaluate((el) => {
      const cs = getComputedStyle(el);
      const probe = document.createElement('div');
      probe.style.width = 'var(--display-xl)';
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      el.parentElement?.appendChild(probe);
      const resolvedDisplayXl = getComputedStyle(probe).width;
      probe.remove();
      return {
        text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
        fontFamily: cs.fontFamily,
        textTransform: cs.textTransform,
        fontSize: cs.fontSize,
        displayXlRaw: cs.getPropertyValue('--display-xl').trim(),
        resolvedDisplayXl,
      };
    });
    rec.verdict('H1_TEXT', info.text === H1_TEXT_EXPECTED, { text: info.text, expected: H1_TEXT_EXPECTED });
    rec.verdict('H1_FONT_CORMORANT', /cormorant/i.test(info.fontFamily), { fontFamily: info.fontFamily });
    const letters = info.text.replace(/[^a-z]/gi, '');
    const allCaps = letters.length > 0 && letters === letters.toUpperCase();
    rec.verdict('H1_SENTENCE_CASE', info.textTransform === 'none' && !allCaps, {
      textTransform: info.textTransform,
      renderedAllUppercase: allCaps,
    });
    const fontPx = parseFloat(info.fontSize);
    const xlPx = parseFloat(info.resolvedDisplayXl);
    const resolvable = Number.isFinite(xlPx) && info.displayXlRaw !== '';
    if (!resolvable) throw new Blocked(`--display-xl did not resolve at the h1 (raw "${info.displayXlRaw}")`);
    rec.verdict('H1_DISPLAY_XL', Math.abs(fontPx - xlPx) <= FONT_SIZE_TOLERANCE_PX, {
      fontSize: info.fontSize,
      displayXl: info.displayXlRaw,
      displayXlResolved: info.resolvedDisplayXl,
    });
  });

  await guarded(rec, ['EMBLEM_ABOVE_H1'], async () => {
    const emblems = hero.locator('img[src*="disa-graminifolia"]');
    const n = await emblems.count();
    if (n === 0) {
      rec.verdict('EMBLEM_ABOVE_H1', false, { reason: 'no img[src*="disa-graminifolia"] inside the hero' });
      return;
    }
    if (n > 1) throw new Blocked(`expected 1 emblem in the hero, found ${n}`);
    const e = await pageBox(emblems.first());
    const t = await pageBox(h1);
    const above = e.y + e.h <= t.y + 0.5;
    const modest = e.w <= EMBLEM_MAX_WIDTH_FRACTION_OF_H1 * t.w;
    rec.verdict('EMBLEM_ABOVE_H1', above && modest, {
      emblemBottom: round2(e.y + e.h),
      h1Top: round2(t.y),
      emblemWidth: round2(e.w),
      h1Width: round2(t.w),
      widthFraction: round2(e.w / t.w),
    });
  });
}

/** A "lockup" is the wordmark text beside the emblem: the two Logo.tsx spans. */
const LOCKUP_TITLE = 'national orchid show';
const LOCKUP_SUBTITLE_RE = /^western cape\s*·\s*\d{4}$/i;

async function lockupChecks(rec: Recorder, page: Page, hero: Locator): Promise<void> {
  await guarded(rec, ['HERO_NO_LOCKUP'], async () => {
    const found = await hero.evaluate((section, titleText) => {
      const hits: string[] = [];
      for (const el of Array.from(section.querySelectorAll('*'))) {
        if (el.closest('h1')) continue;
        if (el.children.length > 0) continue;
        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (text === titleText || /^western cape\s*·\s*\d{4}$/.test(text)) {
          hits.push(`${el.tagName.toLowerCase()}: "${text}"`);
        }
      }
      return hits;
    }, LOCKUP_TITLE);
    rec.verdict('HERO_NO_LOCKUP', found.length === 0, { wordmarkTextInsideHero: found });
  });

  await guarded(rec, ['LOCKUP_IN_CHROME'], async () => {
    const bands = await page.evaluate(
      ({ titleText, subtitleSource }) => {
        const subtitleRe = new RegExp(subtitleSource, 'i');
        const describe = (selector: string) => {
          const band = document.querySelector(selector);
          if (!band) return { present: false, emblemVisible: false, title: false, subtitle: false };
          const emblemVisible = Array.from(band.querySelectorAll('img[src*="disa-graminifolia"]')).some(
            (img) => (img as HTMLElement).getClientRects().length > 0,
          );
          let title = false;
          let subtitle = false;
          for (const el of Array.from(band.querySelectorAll('span'))) {
            if (el.children.length > 0) continue;
            const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
            if (text.toLowerCase() === titleText) title = true;
            if (subtitleRe.test(text)) subtitle = true;
          }
          return { present: true, emblemVisible, title, subtitle };
        };
        return { masthead: describe('[data-nos-masthead]'), colophon: describe('[data-nos-colophon]') };
      },
      { titleText: LOCKUP_TITLE, subtitleSource: LOCKUP_SUBTITLE_RE.source },
    );
    if (!bands.masthead.present && !bands.colophon.present) {
      throw new Blocked('neither [data-nos-masthead] nor [data-nos-colophon] rendered on /national-show');
    }
    const full = (b: typeof bands.masthead) => b.present && b.emblemVisible && b.title && b.subtitle;
    rec.verdict('LOCKUP_IN_CHROME', full(bands.masthead) && full(bands.colophon), bands);
  });
}

async function cropChecks(rec: Recorder, page: Page, hero: Locator, img: Locator): Promise<void> {
  await guarded(rec, ['HERO_OBJECT_POSITION'], async () => {
    const objectPosition = await img.evaluate((el) => getComputedStyle(el).objectPosition);
    rec.verdict('HERO_OBJECT_POSITION', objectPosition !== '50% 50%', { objectPosition });
  });

  await guarded(rec, ['NEGCTL_BLOOM_METRIC_DISCRIMINATES'], async () => {
    const objectPosition = await img.evaluate((el) => getComputedStyle(el).objectPosition);
    const m = objectPosition.match(/^(-?[\d.]+)%\s+(-?[\d.]+)%$/);
    if (!m) throw new Blocked(`object-position "${objectPosition}" is not a percentage pair; cannot place the control rect`);
    const imgBox = await pageBox(img);
    const cx = imgBox.x + (parseFloat(m[1]) / 100) * imgBox.w;
    const cy = imgBox.y + (parseFloat(m[2]) / 100) * imgBox.h;
    const control: Box = {
      x: cx - BLOOM_CONTROL_RECT_PX / 2,
      y: cy - BLOOM_CONTROL_RECT_PX / 2,
      w: BLOOM_CONTROL_RECT_PX,
      h: BLOOM_CONTROL_RECT_PX,
    };
    const heroShot = await shotClip(page, await pageBox(hero), 'hero-1280-control');
    const stats = bloomStats(heroShot, control);
    rec.verdict('NEGCTL_BLOOM_METRIC_DISCRIMINATES', stats.fraction >= BLOOM_CLEAR_MAX_FRACTION, {
      ...stats,
      controlRect: control,
      objectPosition,
      thresholds: {
        minChroma: BLOOM_MIN_CHROMA,
        minLightness: BLOOM_MIN_LIGHTNESS,
        maxLightness: BLOOM_MAX_LIGHTNESS,
        clearBelow: BLOOM_CLEAR_MAX_FRACTION,
      },
      shot: heroShot.file,
    });
  });

  await guarded(rec, ['SCRIM_UNCHANGED'], async () => {
    const layers = await img.evaluate((el) =>
      Array.from(el.parentElement?.querySelectorAll(':scope > div[aria-hidden="true"]') ?? []).map(
        (d) => getComputedStyle(d).backgroundImage,
      ),
    );
    if (!fs.existsSync(SCRIM_BASELINE_FILE)) {
      rec.set('SCRIM_UNCHANGED', 'BLOCKED', {
        reason:
          `baseline ${path.relative(REPO_ROOT, SCRIM_BASELINE_FILE)} is absent. It must be captured from the ` +
          `PRE-M7 build (verifier-contract.golden.md §6); this script does not generate it from the tree ` +
          `under test. Current layers recorded here for the architect.`,
        currentLayers: layers,
      });
      return;
    }
    const baseline = JSON.parse(fs.readFileSync(SCRIM_BASELINE_FILE, 'utf8')) as { layers?: unknown };
    if (!Array.isArray(baseline.layers) || !baseline.layers.every((l) => typeof l === 'string')) {
      throw new Blocked('scrim-baseline.json has no string[] "layers" field');
    }
    const norm = (s: string) => s.replace(/\s+/g, '');
    const expected = (baseline.layers as string[]).map(norm);
    const actual = layers.map(norm);
    const same = expected.length === actual.length && expected.every((l, i) => l === actual[i]);
    rec.verdict('SCRIM_UNCHANGED', same, { baselineLayers: baseline.layers, currentLayers: layers });
  });
}

async function eyebrowChecks(rec: Recorder, hero: Locator): Promise<void> {
  const ids: CheckId[] = ['EYEBROW_MATCHES_COUNTDOWN', 'EYEBROW_UPPERCASE', 'EYEBROW_ABOVE_COUNTDOWN'];
  await guarded(rec, ids, async () => {
    const eyebrow = await exactlyOne(hero.locator('p', { hasText: /^\s*opens in\s*$/i }), 'the "Opens in" eyebrow <p>');
    const countdown = hero.locator('div[aria-label^="Countdown"]');
    if ((await countdown.count()) !== 1) {
      throw new Blocked(
        'no div[aria-label^="Countdown"] in the hero — ShowCountdown renders its unit labels only when a ' +
          'countdown date is set; the "dates to be confirmed" branch has nothing to compare against',
      );
    }
    const label = await exactlyOne(
      countdown.locator(':scope > div').first().locator(':scope > div').nth(1),
      'the first ShowCountdown unit label',
    );
    const read = (loc: Locator) =>
      loc.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
          letterSpacing: cs.letterSpacing,
          color: cs.color,
          textTransform: cs.textTransform,
        };
      });
    const e = await read(eyebrow);
    const c = await read(label);
    const same =
      e.fontFamily === c.fontFamily &&
      e.fontSize === c.fontSize &&
      e.letterSpacing === c.letterSpacing &&
      e.color === c.color;
    rec.verdict('EYEBROW_MATCHES_COUNTDOWN', same, { eyebrow: e, countdownLabel: c });
    rec.verdict('EYEBROW_UPPERCASE', e.textTransform === 'uppercase' && c.textTransform === 'uppercase', {
      eyebrow: e.textTransform,
      countdownLabel: c.textTransform,
    });
    const eb = await pageBox(eyebrow);
    const cb = await pageBox(countdown);
    rec.verdict('EYEBROW_ABOVE_COUNTDOWN', eb.y + eb.h <= cb.y + 0.5, {
      eyebrowBottom: round2(eb.y + eb.h),
      countdownTop: round2(cb.y),
    });
  });
}

async function tokenChecks(rec: Recorder, page: Page): Promise<void> {
  await guarded(rec, ['BORDER_PRIMARY_1PX', 'SHADOW_TOKEN_GONE'], async () => {
    const scope = await exactlyOne(page.locator('.nos-theme'), 'the .nos-theme scope element');
    const t = await scope.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        borderPrimary: cs.getPropertyValue('--border-primary').trim(),
        shadowCard: cs.getPropertyValue('--shadow-card').trim(),
      };
    });
    rec.verdict('BORDER_PRIMARY_1PX', t.borderPrimary === '1px', { borderPrimary: t.borderPrimary });
    rec.verdict('SHADOW_TOKEN_GONE', t.shadowCard === '', { shadowCard: t.shadowCard });
  });

  await guarded(rec, ['RADIUS_CARDS_ZERO'], async () => {
    const cards = await page.evaluate(() => {
      const out: Array<{ tag: string; className: string; radii: string[] }> = [];
      for (const el of Array.from(document.querySelectorAll('.nos-theme *'))) {
        const cls = typeof el.className === 'string' ? el.className : '';
        if (!cls.includes('var(--radius-card)') && !cls.includes('var(--radius-lg)')) continue;
        const cs = getComputedStyle(el);
        out.push({
          tag: el.tagName.toLowerCase(),
          className: cls,
          radii: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius],
        });
      }
      return out;
    });
    if (cards.length === 0) throw new Blocked('no element on /national-show consumes --radius-card or --radius-lg');
    const offenders = cards.filter((c) => c.radii.some((r) => r !== '0px'));
    rec.verdict('RADIUS_CARDS_ZERO', offenders.length === 0, { surfaces: cards.length, offenders });
  });

  await guarded(rec, ['RADIUS_PILL_ALLOWLIST'], async () => {
    const offenders = await page.evaluate(
      ({ maxPx, chipMaxHeight, dotSize, dotTolerance }) => {
        const out: Array<{ tag: string; className: string; radius: number; w: number; h: number }> = [];
        const toPx = (value: string, w: number, h: number) => {
          const n = parseFloat(value);
          if (!Number.isFinite(n)) return 0;
          return value.trim().endsWith('%') ? (n / 100) * Math.min(w, h) : n;
        };
        for (const el of Array.from(document.querySelectorAll('.nos-theme *'))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const cs = getComputedStyle(el);
          const radius = Math.max(
            ...[cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(
              (v) => toPx(v, r.width, r.height),
            ),
          );
          if (radius <= maxPx) continue;
          const cls = typeof el.className === 'string' ? el.className : '';
          const isEyebrowPill = cls.includes('var(--radius-pill)') && r.height <= chipMaxHeight;
          const isRailDot =
            cls.includes('rounded-full') &&
            Math.abs(r.width - dotSize) <= dotTolerance &&
            Math.abs(r.height - dotSize) <= dotTolerance;
          if (isEyebrowPill || isRailDot) continue;
          out.push({ tag: el.tagName.toLowerCase(), className: cls, radius, w: r.width, h: r.height });
        }
        return out;
      },
      { maxPx: RADIUS_PILL_MAX_PX, chipMaxHeight: PILL_CHIP_MAX_HEIGHT_PX, dotSize: RAIL_DOT_SIZE_PX, dotTolerance: RAIL_DOT_TOLERANCE_PX },
    );
    rec.verdict('RADIUS_PILL_ALLOWLIST', offenders.length === 0, { offenders });
  });

  await guarded(rec, ['NO_SHADOWS'], async () => {
    await blurActive(page);
    const offenders = await page.evaluate(() => {
      const out: Array<{ tag: string; className: string; boxShadow: string }> = [];
      for (const el of Array.from(document.querySelectorAll('.nos-theme *'))) {
        if (el.matches(':focus-visible')) continue;
        const boxShadow = getComputedStyle(el).boxShadow;
        if (boxShadow === 'none') continue;
        out.push({ tag: el.tagName.toLowerCase(), className: typeof el.className === 'string' ? el.className : '', boxShadow });
      }
      return out;
    });
    rec.verdict('NO_SHADOWS', offenders.length === 0, { offenders });
  });
}

// ---------------------------------------------------------------------------
// D3 — the three hero actions, static properties then the measured focus ring
// ---------------------------------------------------------------------------

interface ControlInfo {
  href: string | null;
  tag: string;
  radii: string[];
  textDecorationLine: string;
  backgroundColor: string;
  borderWidths: number[];
  borderStyle: string;
  borderColor: string;
  fontSize: string;
  paddingLeft: string;
  paddingRight: string;
  height: number;
}

function isTransparentColor(value: string): boolean {
  // Classification only — never channel extraction. Chromium serialises a fully transparent
  // colour as `rgba(0, 0, 0, 0)` or `transparent`; anything else paints.
  const v = value.replace(/\s+/g, '');
  return v === 'transparent' || v === 'rgba(0,0,0,0)';
}

async function actionChecks(rec: Recorder, page: Page, hero: Locator): Promise<void> {
  const staticIds: CheckId[] = [
    'ACTIONS_COUNT_THREE', 'ACTIONS_RADIUS_2PX', 'ACTIONS_NO_UNDERLINE', 'ACTIONS_ONE_FILLED',
    'ACTIONS_EQUAL_WEIGHT', 'ACTIONS_HREFS', 'ACTIONS_FOCUS_NOT_CLIPPED',
  ];
  const ringIds: CheckId[] = ['ACTIONS_FOCUS_RING_EDGES', 'ACTIONS_FOCUS_RING_CORNERS', 'ACTIONS_FOCUS_IS_OUTLINE'];
  if (![...staticIds, ...ringIds].some((id) => rec.wants(id))) return;

  let row: Locator;
  try {
    row = await actionRow(hero);
  } catch (err) {
    if (err instanceof Blocked) {
      // A hero with no /tickets control has an action count that is not three; that is a
      // measured fact about the code, not a harness gap. Everything else needs the row.
      if (rec.wants('ACTIONS_COUNT_THREE')) rec.verdict('ACTIONS_COUNT_THREE', false, { reason: err.message });
      for (const id of [...staticIds, ...ringIds]) if (id !== 'ACTIONS_COUNT_THREE' && rec.wants(id)) rec.blocked(id, err.message);
      return;
    }
    throw err;
  }
  const controls = row.locator(':scope > a, :scope > button');

  await guarded(rec, staticIds, async () => {
    const infos: ControlInfo[] = await controls.evaluateAll((els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        return {
          href: el.getAttribute('href'),
          tag: el.tagName.toLowerCase(),
          radii: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius],
          textDecorationLine: cs.textDecorationLine,
          backgroundColor: cs.backgroundColor,
          borderWidths: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].map(parseFloat),
          borderStyle: cs.borderTopStyle,
          borderColor: cs.borderTopColor,
          fontSize: cs.fontSize,
          paddingLeft: cs.paddingLeft,
          paddingRight: cs.paddingRight,
          height: el.getBoundingClientRect().height,
        };
      }),
    );
    rec.verdict('ACTIONS_COUNT_THREE', infos.length === 3, { count: infos.length, controls: infos.map((i) => i.href) });
    if (infos.length === 0) throw new Blocked('the action row has no controls');

    rec.verdict('ACTIONS_RADIUS_2PX', infos.every((i) => i.radii.every((r) => r === ACTION_RADIUS_EXPECTED)), {
      radii: infos.map((i) => i.radii),
    });
    rec.verdict('ACTIONS_NO_UNDERLINE', infos.every((i) => i.textDecorationLine === 'none'), {
      textDecorationLine: infos.map((i) => i.textDecorationLine),
    });

    const filled = infos.filter((i) => !isTransparentColor(i.backgroundColor));
    const outlined = infos.filter(
      (i) =>
        isTransparentColor(i.backgroundColor) &&
        i.borderStyle !== 'none' &&
        !isTransparentColor(i.borderColor) &&
        i.borderWidths.every((w) => w >= MIN_VISIBLE_BORDER_PX),
    );
    rec.verdict('ACTIONS_ONE_FILLED', filled.length === 1 && outlined.length === 2, {
      filled: filled.map((i) => i.href),
      outlined: outlined.map((i) => i.href),
      backgrounds: infos.map((i) => i.backgroundColor),
      borders: infos.map((i) => ({ style: i.borderStyle, widths: i.borderWidths, color: i.borderColor })),
    });

    const heights = infos.map((i) => i.height);
    const equalWeight =
      new Set(infos.map((i) => i.fontSize)).size === 1 &&
      new Set(infos.map((i) => i.paddingLeft)).size === 1 &&
      new Set(infos.map((i) => i.paddingRight)).size === 1 &&
      Math.max(...heights) - Math.min(...heights) <= ACTION_HEIGHT_TOLERANCE_PX;
    rec.verdict('ACTIONS_EQUAL_WEIGHT', equalWeight, {
      fontSize: infos.map((i) => i.fontSize),
      paddingLeft: infos.map((i) => i.paddingLeft),
      paddingRight: infos.map((i) => i.paddingRight),
      heights: heights.map(round2),
    });

    const hrefs = infos.map((i) => i.href ?? '').sort();
    rec.verdict('ACTIONS_HREFS', JSON.stringify(hrefs) === JSON.stringify([...ACTION_HREFS_EXPECTED].sort()), {
      hrefs,
      expected: ACTION_HREFS_EXPECTED,
    });

    const clipping = await row.evaluate((rowEl, pad) => {
      const out: Array<{ tag: string; className: string; overflow: string }> = [];
      const buttons = Array.from(rowEl.children).map((c) => c.getBoundingClientRect());
      let a: HTMLElement | null = rowEl.parentElement;
      while (a && a !== document.body) {
        const cs = getComputedStyle(a);
        const clips = [cs.overflowX, cs.overflowY].some((o) => o === 'hidden' || o === 'clip' || o === 'scroll' || o === 'auto');
        if (clips) {
          const ar = a.getBoundingClientRect();
          const crops = buttons.some(
            (b) => b.left - pad < ar.left || b.top - pad < ar.top || b.right + pad > ar.right || b.bottom + pad > ar.bottom,
          );
          if (crops) out.push({ tag: a.tagName.toLowerCase(), className: a.className, overflow: `${cs.overflowX}/${cs.overflowY}` });
        }
        a = a.parentElement;
      }
      return out;
    }, RING_OUTLINE_OFFSET_PX + RING_OUTLINE_WIDTH_PX);
    rec.verdict('ACTIONS_FOCUS_NOT_CLIPPED', clipping.length === 0, { croppingAncestors: clipping });
  });

  await guarded(rec, ringIds, async () => {
    const n = await controls.count();
    if (n === 0) throw new Blocked('the action row has no controls');
    const perControl: Record<string, unknown> = {};
    let edgesOk = true;
    let cornersOk = true;
    let outlineOk = true;
    for (let i = 0; i < n; i++) {
      const control = controls.nth(i);
      const href = (await control.getAttribute('href')) ?? `control-${i}`;
      const result = await measureFocusRing(page, control, `action-${i}-1280`);
      perControl[href] = result;
      if (result.status === 'blocked') throw new Blocked(`${href}: ${result.reason}`);
      if (!result.edgesOk) edgesOk = false;
      if (!result.cornersOk) cornersOk = false;
      if (!result.outlineOk) outlineOk = false;
    }
    rec.verdict('ACTIONS_FOCUS_RING_EDGES', edgesOk, perControl);
    rec.verdict('ACTIONS_FOCUS_RING_CORNERS', cornersOk, perControl);
    rec.verdict('ACTIONS_FOCUS_IS_OUTLINE', outlineOk, perControl);
  });
}

type FocusRingResult =
  | { status: 'blocked'; reason: string }
  | {
      status: 'measured';
      edgesOk: boolean;
      cornersOk: boolean;
      outlineOk: boolean;
      changedPixels: number;
      focusVisible: boolean;
      outline: { style: string; width: string; offset: string };
      edges: Record<string, { hits: number; of: number; ok: boolean }>;
      corners: Record<string, { hits: number; of: number; ok: boolean }>;
      shots: string[];
    };

/** Keyboard-focus one control from a known earlier tab stop; returns whether it landed. */
async function keyboardFocus(page: Page, control: Locator): Promise<boolean> {
  // Start from the NOS masthead link (the last tab stop before the hero) when present, else
  // from the body, and Tab forward until the control has focus. Tab-driven focus is what makes
  // `:focus-visible` apply — programmatic `.focus()` does not reliably.
  const start = page.locator('[data-nos-masthead] a');
  if ((await start.count()) > 0) await start.first().focus();
  else await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let i = 0; i < MAX_TABS_TO_REACH_ACTION; i++) {
    await page.keyboard.press('Tab');
    if (await control.evaluate((el) => document.activeElement === el)) return true;
  }
  return false;
}

async function measureFocusRing(page: Page, control: Locator, name: string): Promise<FocusRingResult> {
  await blurActive(page);
  const box = await pageBox(control);
  const band = expandBox(box, RING_BAND_PAD_PX);
  const before = await shotClip(page, band, `${name}-unfocused`);

  const landed = await keyboardFocus(page, control);
  if (!landed) return { status: 'blocked', reason: `keyboard focus never reached the control after ${MAX_TABS_TO_REACH_ACTION} Tabs` };

  // Computed outline is read AFTER focus lands — an earlier read reports the unfocused state.
  const state = await control.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      focusVisible: el.matches(':focus-visible'),
      outline: { style: cs.outlineStyle, width: cs.outlineWidth, offset: cs.outlineOffset },
    };
  });
  // Focus may have scrolled the page; the band is in page coordinates, so re-derive it.
  const boxAfter = await pageBox(control);
  const bandAfter = expandBox(boxAfter, RING_BAND_PAD_PX);
  const after = await shotClip(page, bandAfter, `${name}-focused`);
  await blurActive(page);

  const changedPixels = countChangedPixels(before, after);
  if (changedPixels === 0 && !state.focusVisible) {
    return { status: 'blocked', reason: 'focus landed but :focus-visible did not apply and nothing repainted — no ring state to measure' };
  }
  // Both shots share the same band geometry relative to the control, so sample against the
  // "before" shot's coordinate frame using the pre-focus box.
  const edges = {
    top: majority(before, after, edgeSamples(box, 'top'), EDGE_MAJORITY),
    right: majority(before, after, edgeSamples(box, 'right'), EDGE_MAJORITY),
    bottom: majority(before, after, edgeSamples(box, 'bottom'), EDGE_MAJORITY),
    left: majority(before, after, edgeSamples(box, 'left'), EDGE_MAJORITY),
  };
  const corners = {
    tl: majority(before, after, cornerSamples(box, 'tl'), CORNER_MAJORITY),
    tr: majority(before, after, cornerSamples(box, 'tr'), CORNER_MAJORITY),
    br: majority(before, after, cornerSamples(box, 'br'), CORNER_MAJORITY),
    bl: majority(before, after, cornerSamples(box, 'bl'), CORNER_MAJORITY),
  };
  const outlineOk = state.outline.style !== 'none' && parseFloat(state.outline.width) > 0;
  return {
    status: 'measured',
    edgesOk: changedPixels > 0 && Object.values(edges).every((e) => e.ok),
    cornersOk: changedPixels > 0 && Object.values(corners).every((c) => c.ok),
    outlineOk,
    changedPixels,
    focusVisible: state.focusVisible,
    outline: state.outline,
    edges,
    corners,
    shots: [before.file, after.file],
  };
}

// ---------------------------------------------------------------------------
// Guards on other routes, and the contrast negative control
// ---------------------------------------------------------------------------

async function lockupNotGlobalCheck(rec: Recorder, browser: Browser): Promise<void> {
  await guarded(rec, ['LOCKUP_NOT_GLOBAL'], async () => {
    const page = await openPage(browser, 1280, '/societies');
    try {
      const found = await page.evaluate((subtitleSource) => {
        const subtitleRe = new RegExp(subtitleSource, 'i');
        const wordmark = Array.from(document.querySelectorAll('span')).filter(
          (el) => el.children.length === 0 && subtitleRe.test((el.textContent ?? '').trim()),
        ).length;
        return {
          masthead: document.querySelectorAll('[data-nos-masthead]').length,
          colophon: document.querySelectorAll('[data-nos-colophon]').length,
          emblems: document.querySelectorAll('img[src*="disa-graminifolia"]').length,
          wordmarkSubtitles: wordmark,
        };
      }, LOCKUP_SUBTITLE_RE.source);
      const absent = found.masthead === 0 && found.colophon === 0 && found.emblems === 0 && found.wordmarkSubtitles === 0;
      rec.verdict('LOCKUP_NOT_GLOBAL', absent, found);
    } finally {
      await page.close();
    }
  });
}

async function otherHeroUnchangedCheck(rec: Recorder, browser: Browser): Promise<void> {
  await guarded(rec, ['OTHER_HERO_UNCHANGED'], async () => {
    const page = await openPage(browser, 1280, '/national-show/plan-your-visit');
    try {
      const hero = await heroOf(page);
      const img = await waitForHeroImage(hero, '/national-show/plan-your-visit');
      const fontSize = parseFloat(await hero.locator('h1').evaluate((el) => getComputedStyle(el).fontSize));
      const vw = VIEWPORTS[1280].width;
      const expectedPx = Math.min(PRE_M7_TITLE_CLAMP.maxPx, Math.max(PRE_M7_TITLE_CLAMP.minPx, (PRE_M7_TITLE_CLAMP.vw / 100) * vw));
      const layers = await img.evaluate((el) =>
        Array.from(el.parentElement?.querySelectorAll(':scope > div[aria-hidden="true"]') ?? []).map(
          (d) => getComputedStyle(d).backgroundImage,
        ),
      );
      const fingerprints = layers.map(numericFingerprint);
      const scrimSame =
        fingerprints.length === PRE_M7_SCRIM_FINGERPRINTS.length &&
        fingerprints.every((f, i) => sameNumbers(f, PRE_M7_SCRIM_FINGERPRINTS[i]));
      const sizeSame = Math.abs(fontSize - expectedPx) <= FONT_SIZE_TOLERANCE_PX;
      rec.verdict('OTHER_HERO_UNCHANGED', scrimSame && sizeSame, {
        fontSize,
        expectedPreM7FontSize: expectedPx,
        layerCount: layers.length,
        expectedLayerCount: PRE_M7_SCRIM_FINGERPRINTS.length,
        layers,
        baselineSource: 'HEAD 24f87e05 components/nos/NosHero.tsx (pre-M7)',
      });
    } finally {
      await page.close();
    }
  });
}

async function contrastNegativeControl(rec: Recorder, browser: Browser): Promise<void> {
  await guarded(rec, ['NEGCTL_CONTRAST_DETECTS_FAILURE'], async () => {
    // A dedicated page load: the probe never coexists with a real measurement.
    const page = await openPage(browser, 1024, '/national-show');
    try {
      const hero = await heroOf(page);
      await waitForHeroImage(hero, '/national-show');
      await hero.evaluate((section, color) => {
        const probe = document.createElement('span');
        probe.setAttribute('data-m7-probe', '');
        probe.textContent = 'NEGATIVE CONTROL';
        Object.assign(probe.style, {
          position: 'absolute',
          left: '32px',
          top: '32px',
          zIndex: '50',
          font: '700 32px sans-serif',
          color,
          whiteSpace: 'nowrap',
        });
        section.appendChild(probe);
      }, NEGCTL_PROBE_COLOR);
      const probe = await exactlyOne(hero.locator('[data-m7-probe]'), 'the injected contrast probe');
      let r: ContrastResult;
      try {
        r = await measureTextContrast(page, probe, 'negctl-probe-1024');
      } finally {
        await hero.evaluate((section) => section.querySelector('[data-m7-probe]')?.remove());
      }
      rec.verdict('NEGCTL_CONTRAST_DETECTS_FAILURE', r.ratioP05 < MIN_CONTRAST_RATIO, {
        ...r,
        probeColor: NEGCTL_PROBE_COLOR,
        meaning: 'PASS = the harness scored a known-bad probe below 4.5:1',
      });
    } finally {
      await page.close();
    }
  });
}

// ---------------------------------------------------------------------------
// Server lifecycle, results files, exit codes
// ---------------------------------------------------------------------------

function waitForServer(): Promise<void> {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const poll = () => {
      const req = http.get(BASE_URL, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error(`server did not respond on ${BASE_URL} within timeout`));
        else setTimeout(poll, SERVER_POLL_INTERVAL_MS);
      });
    };
    poll();
  });
}

function stopServer(server: ChildProcess | undefined): void {
  if (!server || server.killed || server.pid === undefined) return;
  try {
    // `next dev` forks workers; signal the whole process group so nothing lingers on 3412.
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    server.kill('SIGTERM');
  }
}

function currentCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function writeJsonAtomically(file: string, value: unknown): void {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

/** Meta-only results file written at start: a stale run can never satisfy today's gate. */
function writePlaceholder(commit: string): void {
  writeJsonAtomically(RESULTS_FILE, { _generated_at: new Date().toISOString(), _commit: commit, _state: 'IN_PROGRESS' });
}

function writeResults(rec: Recorder, commit: string, setupFailure?: string): void {
  const results: Record<string, string> = { _generated_at: new Date().toISOString(), _commit: commit };
  if (setupFailure) results._setup_failure = 'see detail.json';
  for (const id of CHECK_IDS) {
    if (!rec.wants(id)) continue;
    const status = rec.results.get(id);
    if (status) {
      results[id] = status;
    } else {
      results[id] = 'ERROR';
      rec.detail[id] = { error: setupFailure ? `setup failure: ${setupFailure}` : 'check never ran' };
    }
  }
  writeJsonAtomically(RESULTS_FILE, results);
  writeJsonAtomically(DETAIL_FILE, { _generated_at: results._generated_at, _commit: commit, _setup_failure: setupFailure ?? null, ...rec.detail });
}

function exitCodeFor(rec: Recorder): number {
  const statuses = Array.from(rec.results.values());
  if (statuses.includes('FAIL')) return 1;
  if (statuses.includes('BLOCKED') || statuses.includes('ERROR')) return 3;
  return 0;
}

async function main(): Promise<number> {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  const commit = currentCommit();
  const rec = new Recorder();
  writePlaceholder(commit);
  if (SMOKE) console.log(`SMOKE RUN — only ids matching [${ONLY.join(', ')}]; writing ${path.basename(RESULTS_FILE)}`);

  let server: ChildProcess | undefined;
  let browser: Browser | undefined;
  const onSignal = () => {
    stopServer(server);
    process.exit(2);
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  try {
    if (SPAWN_SERVER) {
      server = spawn('node_modules/.bin/next', ['dev', '--port', String(PORT)], {
        cwd: REPO_ROOT,
        env: process.env,
        stdio: 'ignore',
        detached: true,
      });
    }
    try {
      await waitForServer();
    } catch (err) {
      throw new SetupFailure((err as Error).message);
    }
    browser = await chromium.launch();

    await structuralChecks1280(rec, browser);
    for (const vp of [390, 1024, 1280] as ViewportKey[]) await heroChecksAtViewport(rec, browser, vp);
    await lockupNotGlobalCheck(rec, browser);
    await otherHeroUnchangedCheck(rec, browser);
    await contrastNegativeControl(rec, browser);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`SETUP FAILURE: ${message}`);
    writeResults(rec, commit, message);
    return 2;
  } finally {
    if (browser) await browser.close();
    stopServer(server);
  }

  writeResults(rec, commit);
  const code = exitCodeFor(rec);
  const counts = { PASS: 0, FAIL: 0, BLOCKED: 0, ERROR: 0 };
  for (const s of rec.results.values()) counts[s]++;
  console.log(`\n${JSON.stringify(counts)} → ${path.relative(REPO_ROOT, RESULTS_FILE)} (exit ${code})`);
  return code;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('SETUP FAILURE:', err);
    process.exit(2);
  });
