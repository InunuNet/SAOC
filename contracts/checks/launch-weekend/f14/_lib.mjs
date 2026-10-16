// Shared helpers for the launch-weekend F14 (home NavCards + ShowBand design pass) checks.
// Runtime checks: they need a server already running (BASE_URL, default http://localhost:3614; a local
// production build, `pnpm build && pnpm exec next start -p 3614`, is the reference). Exit 2 = cannot
// reach the server (infrastructure), exit 1 = a real finding. cwd = the tree under test (.env.local read from it).
import { chromium } from 'playwright';
import { config as loadDotenv } from 'dotenv';
import { readFileSync } from 'node:fs';

loadDotenv({ path: '.env.local', quiet: true });

export const BASE = (process.env.BASE_URL || 'http://localhost:3614').replace(/\/$/, '');
export const GOLDEN_DIR = '.agent/memory/project/specs/launch-weekend/goldens/f14';
export const VIEWPORTS = [
  { name: '390', width: 390, height: 844, isMobile: true },
  { name: '1280', width: 1280, height: 900, isMobile: false },
  { name: '1920', width: 1920, height: 1080, isMobile: false },
];

// Hooks the dev adds (f14-spec.md section 8).
export const SEL = {
  navSection: '[data-home-section="nav-cards"]',
  navCard: '[data-nav-card]',
  band: '[data-home-section="show-band"]',
  bandImage: '[data-show-band-image]',
  bandContent: '[data-show-band-content]',
  bandFacts: '[data-show-band-facts]',
  bandCountdown: '[data-show-band-countdown]',
  cta: (tier) => `[data-show-band-cta="${tier}"]`,
};

const user = process.env.BETA_BASIC_AUTH_USER;
const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
const httpCredentials = user && pass ? { username: user, password: pass } : undefined;

export function loadGolden(name) {
  return JSON.parse(readFileSync(`${GOLDEN_DIR}/${name}`, 'utf8'));
}

export async function launch() {
  return chromium.launch();
}

export async function newPage(browser, vp, extra = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    httpCredentials,
    ...extra,
  });
  const page = await ctx.newPage();
  return { ctx, page };
}

export async function openHome(page) {
  try {
    const res = await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 45000 });
    if (!res || res.status() >= 400) throw new Error(`HTTP ${res ? res.status() : 'none'}`);
  } catch (e) {
    console.error(`INFRA: cannot load ${BASE}/ (${e.message})`);
    process.exit(2);
  }
}

export function report(problems, okMsg) {
  if (problems.length) {
    console.error(`FAIL (${problems.length}):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`PASS: ${okMsg}`);
}

// A hook the dev was told to add is missing: a finding, never an infrastructure error.
export async function missingHooks(page, selectors, label) {
  const out = [];
  for (const [name, sel] of Object.entries(selectors)) {
    if ((await page.locator(sel).count()) === 0) out.push(`${label}: hook ${name} (${sel}) not found`);
  }
  return out;
}

// In-page colour tools (serialised into page.evaluate as a string). norm() turns ANY computed CSS colour
// (rgb, rgba, oklab, color-mix results) into {r,g,b,a} by painting it on a 1x1 canvas, so assertions are
// not tied to which colour syntax the stylesheet used.
export const COLOR_SRC = `
  const __cv = document.createElement('canvas'); __cv.width = 1; __cv.height = 1;
  const __cx = __cv.getContext('2d', { willReadFrequently: true });
  const norm = (css) => { __cx.clearRect(0, 0, 1, 1); __cx.fillStyle = '#000'; __cx.fillStyle = css; __cx.fillRect(0, 0, 1, 1); const d = __cx.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: Math.round(d[3] / 255 * 100) / 100 }; };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const effectiveBg = (el, base) => { const stack = []; for (let n = el; n; n = n.parentElement) { const c = norm(getComputedStyle(n).backgroundColor); if (c.a > 0) { stack.push(c); if (c.a >= 0.99) break; } } let acc = base || { r: 255, g: 255, b: 255, a: 1 }; for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc); return acc; };
  const same = (css, want, tol) => { const a = norm(css), b = norm(want); const t = tol || 2; return Math.abs(a.r - b.r) <= t && Math.abs(a.g - b.g) <= t && Math.abs(a.b - b.b) <= t && Math.abs(a.a - b.a) <= 0.03; };
`;

// A 150ms hover transition plus slack.
export const SETTLE_MS = 450;

// Every comma-separated duration in a computed transition-duration, in milliseconds.
export const durationsMs = (v) => v.split(',').map((s) => { s = s.trim(); return s.endsWith('ms') ? parseFloat(s) : parseFloat(s) * 1000; });

// In-page: the EFFECTIVE transform of an element, folding the individual `translate` and `scale` properties (which
// Tailwind v4 utilities set, leaving `transform: none`) together with `transform` itself.
export const FX_SRC = `
  const fx = (cs) => { let tx = 0, ty = 0, sx = 1, sy = 1; const m = cs.transform;
    if (m && m !== 'none') { const v = m.match(/matrix\\(([^)]+)\\)/)[1].split(',').map(Number); sx = v[0]; sy = v[3]; tx = v[4]; ty = v[5]; }
    const tr = cs.translate; if (tr && tr !== 'none') { const q = tr.split(' '); tx += parseFloat(q[0]) || 0; ty += parseFloat(q[1] || '0') || 0; }
    const sc = cs.scale; if (sc && sc !== 'none') { const q = sc.split(' '); sx *= parseFloat(q[0]); sy *= parseFloat(q[1] || q[0]); }
    const r = (n) => Math.round(n * 100) / 100; return { tx: r(tx), ty: r(ty), sx: r(sx), sy: r(sy) }; };
`;

// Node-side comparison of an effective transform to a target { tx?, ty?, s? } (unspecified axes must be neutral).
export const fxMatches = (got, want) => {
  const w = { tx: 0, ty: 0, s: 1, ...want };
  return Math.abs(got.tx - w.tx) <= 0.06 && Math.abs(got.ty - w.ty) <= 0.06 && Math.abs(got.sx - w.s) <= 0.006 && Math.abs(got.sy - w.s) <= 0.006;
};
export const fxStr = (f) => `translate(${f.tx},${f.ty}) scale(${f.sx},${f.sy})`;
export const fxNeutral = (f) => fxMatches(f, {});
