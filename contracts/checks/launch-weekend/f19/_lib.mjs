// Shared helpers for the launch-weekend F19 (SAOC design pass) checks.
// Runtime checks need a server already running (BASE_URL, default http://localhost:3619; a local production
// build, `pnpm build && pnpm exec next start -p 3619`, is the reference). Exit 2 = cannot reach the server
// (infrastructure), exit 1 = a real finding. cwd = the tree under test (.env.local read from it).
// F19_SIMULATE=1 injects the golden patch goldens/f19/simulate.js (an UNTOUCHED main build, patched in the page) before measuring: it proves a
// check CAN go green against the intended design and is used only by the architect's self-test, never by the gate.
import { chromium } from 'playwright';
import { config as loadDotenv } from 'dotenv';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ROOT is the tree this check file lives in (the implementation worktree at gate time), so the checks do not depend on cwd.
export const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
loadDotenv({ path: existsSync(`${ROOT}.env.local`) ? `${ROOT}.env.local` : '.env.local', quiet: true });

export const BASE = (process.env.BASE_URL || 'http://localhost:3619').replace(/\/$/, '');
export const GOLDEN_DIR = `${ROOT}.agent/memory/project/specs/launch-weekend/goldens/f19`;
export const VIEWPORTS = [
  { name: '390', width: 390, height: 844, isMobile: true },
  { name: '1280', width: 1280, height: 900, isMobile: false },
];
export const WIDE = { name: '2056', width: 2056, height: 1100, isMobile: false };

const user = process.env.BETA_BASIC_AUTH_USER;
const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
const httpCredentials = user && pass ? { username: user, password: pass } : undefined;

export const loadGolden = (name) => JSON.parse(readFileSync(`${GOLDEN_DIR}/${name}`, 'utf8'));
export const launch = () => chromium.launch();

export async function newPage(browser, vp, extra = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    httpCredentials,
    ...extra,
  });
  return { ctx, page: await ctx.newPage() };
}

export async function open(page, path = '/') {
  try {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 45000 });
    if (!res || res.status() >= 400) throw new Error(`HTTP ${res ? res.status() : 'none'}`);
  } catch (e) {
    console.error(`INFRA: cannot load ${BASE}${path} (${e.message})`);
    process.exit(2);
  }
  if (process.env.F19_SIMULATE === '1') await page.evaluate(readFileSync(`${GOLDEN_DIR}/simulate.js`, 'utf8'));
}

export function report(problems, okMsg) {
  if (problems.length) {
    console.error(`FAIL (${problems.length}):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`PASS: ${okMsg}`);
}

// In-page colour tools (a string, serialised into page.evaluate). norm() turns any computed CSS colour
// (rgb, rgba, oklab, color-mix) into {r,g,b,a} by painting it on a 1x1 canvas.
export const COLOR_SRC = `
  const __cv = document.createElement('canvas'); __cv.width = 1; __cv.height = 1;
  const __cx = __cv.getContext('2d', { willReadFrequently: true });
  const norm = (css) => { __cx.clearRect(0, 0, 1, 1); __cx.fillStyle = '#000'; __cx.fillStyle = css; __cx.fillRect(0, 0, 1, 1); const d = __cx.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: Math.round(d[3] / 255 * 100) / 100 }; };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
`;

// Hero contrast, measured on rendered pixels. For each carousel slide (dot buttons, autoplay paused) the page
// is photographed with every hero glyph made transparent, so the pixels under each text line (and inside each
// CTA box, own fill included) are exactly what the glyphs sit on. Each target's text colour is composited over
// every sampled pixel; the reported ratio is the 2nd percentile (lowest) so one stray pixel cannot fail it and
// a bright petal under a word cannot hide.
// Returns [{ slide, targets: [{ name, ratio, size, colour }] }].
export async function measureHeroContrast(page) {
  const slideCount = await page.locator('section[aria-roledescription="carousel"] [role="group"][aria-roledescription="slide"]').count();
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  if (await pause.count()) await pause.first().click();
  const out = [];
  for (let i = 0; i < slideCount; i++) {
    await page.locator('section[aria-roledescription="carousel"] button[aria-label^="Show slide"]').nth(i).click();
    await page.waitForTimeout(1900); // 1400ms crossfade plus slack
    await page.evaluate(() => window.scrollTo(0, 0));
    const spec = await page.evaluate(`(() => {
      ${COLOR_SRC}
      const hero = document.querySelector('section[aria-roledescription="carousel"]');
      const hr = hero.getBoundingClientRect();
      const sy = window.scrollY, sx = window.scrollX;
      const items = [];
      const add = (name, el, boxMode) => {
        if (!el) return;
        const cs = getComputedStyle(el);
        let rects;
        if (boxMode) { const r = el.getBoundingClientRect(); rects = [{ left: r.left + 4, top: r.top + 4, width: r.width - 8, height: r.height - 8 }]; }
        else { const rg = document.createRange(); rg.selectNodeContents(el); rects = [...rg.getClientRects()].filter((r) => r.width > 2 && r.height > 2); }
        items.push({ name, size: parseFloat(cs.fontSize), colour: norm(cs.color), rects: rects.map((r) => ({ x: r.left + sx - (hr.left + sx), y: r.top + sy - (hr.top + sy), w: r.width, h: r.height })) });
      };
      add('h1', hero.querySelector('h1'));
      add('h1 em', hero.querySelector('h1 em'));
      add('lede', hero.querySelector('p'));
      const ctas = [...hero.querySelectorAll('a[href]')];
      ctas.forEach((a, k) => add('cta' + (k + 1) + ' ' + a.textContent.trim().slice(0, 28), a, true));
      return { clip: { x: hr.left + sx, y: hr.top + sy, width: hr.width, height: hr.height }, items };
    })()`);
    await page.addStyleTag({ content: 'section[aria-roledescription="carousel"] * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; } section[aria-roledescription="carousel"] svg { visibility: hidden !important; }' });
    const png = await page.screenshot({ clip: spec.clip, fullPage: true });
    await page.evaluate(() => { document.querySelectorAll('style').forEach((s) => { if (s.textContent.startsWith('section[aria-roledescription="carousel"] * { color: transparent')) s.remove(); }); });
    const targets = await page.evaluate(`(async () => {
      ${COLOR_SRC}
      const spec = ${JSON.stringify(spec)};
      const img = new Image(); img.src = 'data:image/png;base64,${png.toString('base64')}';
      await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
      const k = img.width / spec.clip.width;
      return spec.items.map((it) => {
        const ratios = [];
        for (const r of it.rects) {
          const x0 = Math.max(0, Math.floor(r.x * k)), y0 = Math.max(0, Math.floor(r.y * k));
          const w = Math.min(img.width - x0, Math.ceil(r.w * k)), h = Math.min(img.height - y0, Math.ceil(r.h * k));
          if (w <= 0 || h <= 0) continue;
          const d = cx.getImageData(x0, y0, w, h).data;
          for (let p = 0; p < d.length; p += 4 * 3) ratios.push(ratio(over(it.colour, { r: d[p], g: d[p + 1], b: d[p + 2], a: 1 }), { r: d[p], g: d[p + 1], b: d[p + 2], a: 1 }));
        }
        ratios.sort((a, b) => a - b);
        const idx = Math.floor(ratios.length * 0.02);
        return { name: it.name, size: it.size, colour: it.colour, samples: ratios.length, ratio: ratios.length ? Math.round(ratios[idx] * 100) / 100 : null };
      });
    })()`);
    out.push({ slide: i + 1, targets });
  }
  return out;
}
