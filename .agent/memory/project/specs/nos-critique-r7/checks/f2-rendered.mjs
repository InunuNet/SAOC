// nos-critique-r7 f2 rendered: the NosHero lede wraps with text-wrap: pretty, and at 390 no lede ends on a single-word last line.
import { chromium } from 'playwright';

import { finish } from './_lib.mjs';
import { AUTH } from './_server.mjs';
import { F1_PATHS, F2_PATHS, openMode } from './r7-lib.mjs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './_lib.mjs';

const NAME = 'f2-rendered.mjs';
const failures = [];
// MUST: the motivating case. OPTIONAL: measured wherever a lede renders (what-to-expect public withholds expectIntro by design; some routes have none).
const MUST = ['/national-show/exhibitors'];
const OPTIONAL = ['/national-show', '/national-show/plan-your-visit', '/national-show/what-to-expect', '/national-show/about', '/national-show/programme'];
const ROUTES = [...MUST, ...OPTIONAL];
const sourceFiles = [...F1_PATHS, ...F2_PATHS].filter((rel) => existsSync(path.join(repoRoot, rel)));

const measure = () => {
  const el = document.querySelector('[data-nos-hero-lede]');
  if (!el) return null;
  const cs = getComputedStyle(el);
  const words = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const re = /\S+/g; let m;
    while ((m = re.exec(n.data))) {
      const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      const b = r.getClientRects()[0]; if (b) words.push({ top: b.top, h: b.height });
    }
  }
  const lines = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.top - w.top) < w.h / 2) last.n += 1; else lines.push({ top: w.top, n: 1 });
  }
  return { wrap: cs.textWrapStyle || cs.textWrap, lines: lines.map((l) => l.n) };
};

let browser;
const handles = [];
try {
  browser = await chromium.launch();
  for (const mode of ['public', 'preview']) {
    const h = await openMode(mode, sourceFiles);
    if (h.stale) finish(NAME, h.stale);
    handles.push(h);
    for (const width of [390, 1280]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, extraHTTPHeaders: { authorization: AUTH } });
      const page = await ctx.newPage();
      for (const route of ROUTES) {
        const tag = `[${mode}] ${route} @${width}`;
        const res = await page.goto(`${h.origin}${route}`, { waitUntil: 'networkidle' });
        if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); continue; }
        const m = await page.evaluate(measure);
        if (!m) { if (MUST.includes(route)) failures.push(`${tag}: no [data-nos-hero-lede]`); continue; }
        if (m.wrap !== 'pretty') failures.push(`${tag}: lede text-wrap is "${m.wrap}", want pretty`);
        if (width === 390 && m.lines.length >= 2 && m.lines[m.lines.length - 1] < 2) failures.push(`${tag}: lede ends on a single-word last line (words per line ${m.lines.join('/')})`);
      }
      await ctx.close();
    }
    h.stop();
  }
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  for (const h of handles) h.stop();
  if (browser) await browser.close();
}

finish(NAME, failures, 'every hero lede that renders (exhibitors mandatory) computes text-wrap: pretty in both modes at 390 and 1280; no single-word last line at 390.');
