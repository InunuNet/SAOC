// nos-critique-r16 non-regression (fresh PUBLIC and PREVIEW production builds, next start 3010-3019 minus 3013). QA input, hash-locked.
// Widths 1280 and 390. The SAOC and NOS routes r16 does not target keep their screenshot and geometry; the r16 targets that also show on
// them are masked: the event rows on / and /events (F3 item 9, their href and accessible name change, not their look) and any link
// reading the nav-config "Exhibitors and Vendors" label in either case (F1 item 3). /media-kit, /sponsors, the 404s and the vendor,
// exhibitor, programme and confirmation pages are F1-F3's own (f1/f2/f3-rendered.mjs).
//   N1  geometry: main's top-level blocks [tag, top, height] and the document height equal the BASE capture (+-1px).
//   N2  screenshot: a full-page capture (lazy images forced, animations disabled, targets masked; height within 2px) reduced to 32px
//       block means equals the BASE capture over the shared full block rows: at most `tolerance.blocks` blocks may differ by more than
//       `tolerance.level` (0-255) in any channel (live content such as the home countdown).
//   N3  no horizontal overflow.
// `--capture` prints goldens/nonreg-baseline.json (captured by @architect on BASE cea06daf, both modes).
import { deflateSync, inflateSync } from 'node:zlib';

import { BASE, finish, golden, goldenJson } from './_lib.mjs';
import { MODES, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'nonreg.mjs';
const CAPTURE = process.argv.includes('--capture');
const WIDTHS = [1280, 390];
const BLOCK = 32;
const TOL = { level: 16, blocks: 6 };
const ROUTES = ['/', '/about', '/judging', '/events', '/constitution', '/privacy', '/terms', '/refunds', '/contact', '/members', '/societies', '/national-show', '/national-show/tickets', '/national-show/about', '/national-show/wosa-conference', '/national-show/symposium', '/national-show/workshops', '/national-show/faq'];
const E = goldenJson('f3-events.json');
const ROW_MASK = (route) => E.rows.find((r) => r.route === route);
const LABEL = /^\s*Exhibitors and vendors\s*$/i;
// The home yearbook cover (not an r16 target) settles in one of two states on the preview build at 1280 (one 32px row, d18-22, measured
// on BASE cea06daf across a capture and two runs of the same build), so it is masked rather than compared.
const YEARBOOK_IMG = '[data-home-section="yearbook"] img';
const failures = [];
const got = {};

for (const mode of MODES) {
const srv = await serve(mode);
if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
const browser = await chromium.launch();
try {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', extraHTTPHeaders: srv.headers ?? {} });
    const page = await ctx.newPage();
    for (const route of ROUTES) {
      const res = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
      const status = res ? res.status() : 0;
      if (status !== 200) { failures.push(`${mode} ${route} @${width}: HTTP ${status}`); continue; }
      await page.evaluate(async () => {
        document.querySelectorAll('img[loading="lazy"]').forEach((i) => i.setAttribute('loading', 'eager'));
        for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); }
        scrollTo(0, 0);
        await document.fonts.ready;
        await Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => null))));
      });
      await page.waitForLoadState('networkidle');
      const geo = await page.evaluate(() => {
        const main = document.querySelector('main');
        const blocks = main ? [...main.children].map((c) => { const r = c.getBoundingClientRect(); return [c.tagName.toLowerCase(), Math.round(r.top + scrollY), Math.round(r.height)]; }) : [];
        return { blocks, docHeight: document.documentElement.scrollHeight, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      const rows = ROW_MASK(route);
      const mask = [page.locator('a').filter({ hasText: LABEL }), page.locator(YEARBOOK_IMG), ...(rows ? [page.locator(`${rows.scope} article`), page.locator(`${rows.scope} a[href^="/events/"]`)] : [])];
      const png = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide', mask, maskColor: '#ff00ff' });
      const fp = await page.evaluate(async ({ b64, block }) => {
        const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        const bw = Math.ceil(c.width / block); const bh = Math.ceil(c.height / block);
        const out = new Array(bw * bh * 3).fill(0); const n = new Array(bw * bh).fill(0);
        for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) {
          const b = Math.floor(yy / block) * bw + Math.floor(xx / block); const i = (yy * c.width + xx) * 4;
          out[b * 3] += d[i]; out[b * 3 + 1] += d[i + 1]; out[b * 3 + 2] += d[i + 2]; n[b] += 1;
        }
        return { w: c.width, h: c.height, bw, bh, means: out.map((v, k) => Math.round(v / n[Math.floor(k / 3)])) };
      }, { b64: png.toString('base64'), block: BLOCK });
      got[`${mode} ${route} @${width}`] = { ...geo, shot: { w: fp.w, h: fp.h, bw: fp.bw, bh: fp.bh, means: fp.means } };
    }
    await ctx.close();
  }
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  await browser.close();
  await srv.stop();
}
}

const pack = (arr) => deflateSync(Buffer.from(arr)).toString('base64');
const unpack = (s) => [...inflateSync(Buffer.from(s, 'base64'))];
if (CAPTURE) {
  if (failures.length) finish(NAME, failures);
  const out = {};
  for (const [k, m] of Object.entries(got)) out[k] = { blocks: m.blocks, docHeight: m.docHeight, shot: { w: m.shot.w, h: m.shot.h, bw: m.shot.bw, bh: m.shot.bh, means: pack(m.shot.means) } };
  process.stdout.write(`${JSON.stringify({ recorded: `${MODES.join(' and ')} builds of BASE ${BASE}; ${BLOCK}px block means (deflate+base64) of masked full-page captures`, got: out })}\n`);
  process.exit(0);
}
const baseline = JSON.parse(golden('nonreg-baseline.json')).got;
const near = (a, b) => a.length === b.length && a.every((v, i) => (typeof v === 'number' ? Math.abs(v - b[i]) <= 1 : v === b[i]));
for (const [key, m] of Object.entries(got)) {
  if (m.overflow > 0) failures.push(`${key}: scrolls horizontally by ${m.overflow}px (N3)`);
  const b = baseline[key];
  if (!b) { failures.push(`${key}: no baseline`); continue; }
  if (m.blocks.length !== b.blocks.length || !m.blocks.every((x, i) => near(x, b.blocks[i]))) failures.push(`${key}: main blocks moved: ${JSON.stringify(m.blocks)}, BASE ${JSON.stringify(b.blocks)} (N1)`);
  if (Math.abs(m.docHeight - b.docHeight) > 1) failures.push(`${key}: document height ${m.docHeight}, BASE ${b.docHeight} (N1)`);
  if (m.shot.w !== b.shot.w || Math.abs(m.shot.h - b.shot.h) > 2) { failures.push(`${key}: capture ${m.shot.w}x${m.shot.h}, BASE ${b.shot.w}x${b.shot.h} (N2)`); continue; }
  const base = unpack(b.shot.means);
  const diff = [];
  // A +-2px full-page height wobble (sub-pixel layout: /about and /terms at 390 vary by 1px between two runs of the same build) compares
  // only the full 32px block rows both captures share; the partial bottom row would swing with the wobble itself.
  for (let blk = 0; blk < m.shot.bw * Math.floor(Math.min(m.shot.h, b.shot.h) / BLOCK); blk++) {
    const d = Math.max(...[0, 1, 2].map((c) => Math.abs(m.shot.means[blk * 3 + c] - base[blk * 3 + c])));
    if (d > TOL.level) diff.push(`(${(blk % m.shot.bw) * BLOCK},${Math.floor(blk / m.shot.bw) * BLOCK}) d${d}`);
  }
  if (diff.length > TOL.blocks) failures.push(`${key}: ${diff.length} screenshot blocks changed (> ${TOL.blocks}): ${diff.slice(0, 8).join(' ')} (N2)`);
}
for (const key of Object.keys(baseline)) if (!got[key]) failures.push(`${key}: in the baseline but not measured`);
finish(NAME, failures, `${Object.keys(got).length} SAOC/NOS captures (${MODES.join('/')}) keep their geometry and screenshot (targets masked) with no horizontal overflow.`);
