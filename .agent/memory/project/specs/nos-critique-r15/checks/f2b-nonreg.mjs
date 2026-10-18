// nos-critique-r15 F2b non-regression (PUBLIC production build, next start 3010-3019 minus 3013). QA input, hash-locked. Widths 1280 and 390.
// F2b changes only focus-visible ring colours, which do not paint at rest, so every capture equals the BASE capture (taken on 7bb4064b) with nothing masked. The
// routes are r15's set (nonreg.mjs), which includes the F2b form routes /contact and /members; the header (MegaMenu and MobileMenu closed)
// and footer are on every capture.
//   N1  geometry: main's top-level blocks [tag, top, height] and the document height equal the BASE capture (+-1px).
//   N2  screenshot: a full-page capture (lazy images forced, animations disabled; height within 2px) reduced to 32px block means equals the
//       BASE capture over the shared full block rows: at most `tolerance.blocks` blocks may differ by more than `tolerance.level` (0-255) in
//       any channel (live content such as the home countdown).
//   N3  no horizontal overflow.
// `--capture` prints goldens/f2b-nonreg-baseline.json (captured by @architect on BASE 7bb4064b).
import { deflateSync, inflateSync } from 'node:zlib';

import { BASE, finish, golden } from './_f2b.mjs';

const { require, serve } = await import('./_server.mjs');

const { chromium } = require('playwright');
const NAME = 'f2b-nonreg.mjs';
const CAPTURE = process.argv.includes('--capture');
const WIDTHS = [1280, 390];
const BLOCK = 32;
const TOL = { level: 16, blocks: 6 };
const ROUTES = ['/', '/about', '/judging', '/events', '/media-kit', '/sponsors', '/constitution', '/privacy', '/terms', '/refunds', '/contact', '/members', '/this-page-does-not-exist', '/national-show', '/national-show/tickets'];
const failures = [];
const got = {};

const srv = await serve('public');
if (srv.failures) finish(NAME, srv.failures);
const browser = await chromium.launch();
try {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    for (const route of ROUTES) {
      const res = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
      const status = res ? res.status() : 0;
      if (status !== 200 && !(route === '/this-page-does-not-exist' && status === 404)) { failures.push(`${route} @${width}: HTTP ${status}`); continue; }
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
      const png = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
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
      got[`${route} @${width}`] = { ...geo, shot: { w: fp.w, h: fp.h, bw: fp.bw, bh: fp.bh, means: fp.means } };
    }
    await ctx.close();
  }
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  await browser.close();
  await srv.stop();
}

const pack = (arr) => deflateSync(Buffer.from(arr)).toString('base64');
const unpack = (s) => [...inflateSync(Buffer.from(s, 'base64'))];
if (CAPTURE) {
  if (failures.length) finish(NAME, failures);
  const out = {};
  for (const [k, m] of Object.entries(got)) out[k] = { blocks: m.blocks, docHeight: m.docHeight, shot: { w: m.shot.w, h: m.shot.h, bw: m.shot.bw, bh: m.shot.bh, means: pack(m.shot.means) } };
  process.stdout.write(`${JSON.stringify({ recorded: `public build of BASE ${BASE}; ${BLOCK}px block means (deflate+base64) of full-page captures`, got: out })}\n`);
  process.exit(0);
}
const baseline = JSON.parse(golden('f2b-nonreg-baseline.json')).got;
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
finish(NAME, failures, `${Object.keys(got).length} SAOC/NOS captures keep their BASE geometry and screenshot (nothing masked) with no horizontal overflow.`);
