// nos-ticket-day-stub (r45) non-regression (fresh PUBLIC and PREVIEW production builds on live Sanity, next start 3010-3019 minus 3002,
// 3013 and 3016). QA input, hash-locked; the rHB pattern. Widths 1280 and 390. r45 changes only the Day Pass: its hub card and its fan
// mini (f1-rendered.mjs owns both), so those two are masked on the hub; every other ticket card, the programme cards and the checkout
// screens must still match BASE, including the Day Pass checkout with a ?day. (Amended for F2, r45b: the Day Pass checkout without
// ?day changes by ruling and is f2-rendered.mjs's; its route and baseline entries are gone.)
//   N1  geometry: main's top-level blocks [tag, top, height] and the last footer's top equal the BASE capture (+-1px).
//   N2  screenshot: a full-page capture (lazy images forced, animations disabled, the two Day Pass masks) reduced to 32px block means
//       equals the BASE capture: at most `tolerance.blocks` blocks may differ by more than `tolerance.level` (0-255) in any channel.
//   N3  no horizontal overflow.
// `--capture` prints goldens/nonreg-baseline.json (captured by @architect on BASE 1a7479f1, both modes). The checkout slugs are the live
// ones the hub linked on 2026-10-22 (the Day Pass is the early-bird SKU while its pool lasts).
import { deflateSync, inflateSync } from 'node:zlib';

import { BASE, finish, golden } from './_lib.mjs';
import { MODES, authorize, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'nonreg.mjs';
const CAPTURE = process.argv.includes('--capture');
const WIDTHS = [1280, 390];
const BLOCK = 32;
const TOL = { level: 16, blocks: 6 };
const ROUTES = ['/national-show/tickets', '/national-show/programme', '/tickets/vip?quantity=1', '/tickets/sunset-cocktails-single?quantity=1', '/tickets/weekend-pass-early-bird?quantity=1', '/tickets/saoc-symposium?quantity=1', '/tickets/wosa-conference?quantity=1', '/tickets/early-bird?quantity=1&day=2027-09-25'];
const MASKS = ['article#ticket-day', '[data-fan-link][href="#ticket-day"]'];
const failures = [];
const got = {};

for (const mode of MODES) {
const srv = await serve(mode);
if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
const browser = await chromium.launch();
try {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await authorize(ctx, srv);
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
        const feet = document.querySelectorAll('footer');
        const foot = feet[feet.length - 1];
        return { blocks, footTop: foot ? Math.round(foot.getBoundingClientRect().top + scrollY) : document.documentElement.scrollHeight, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      const png = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide', mask: MASKS.map((m) => page.locator(m)), maskColor: '#ff00ff' });
      const fp = await page.evaluate(async ({ b64, block }) => {
        const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        const bw = Math.ceil(c.width / block); const bh = Math.ceil(c.height / block);
        const out = new Array(bw * bh * 3).fill(0); const n = new Array(bw * bh).fill(0);
        for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) {
          const b = Math.floor(yy / block) * bw + Math.floor(xx / block); const i = (yy * c.width + xx) * 4;
          out[b * 3] += d[i]; out[b * 3 + 1] += d[i + 1]; out[b * 3 + 2] += d[i + 2]; n[b] += 1;
        }
        return { w: c.width, h: c.height, bw, bh, means: out.map((v, k) => Math.round(v / n[Math.floor(k / 3)])) };
      }, { b64: png.toString('base64'), block: BLOCK });
      got[`${mode} ${route} @${width}`] = { ...geo, shot: fp };
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
  for (const [k, m] of Object.entries(got)) out[k] = { blocks: m.blocks, footTop: m.footTop, shot: { w: m.shot.w, h: m.shot.h, bw: m.shot.bw, bh: m.shot.bh, means: pack(m.shot.means) } };
  process.stdout.write(`${JSON.stringify({ recorded: `${MODES.join(' and ')} builds of BASE ${BASE}; ${BLOCK}px block means (deflate+base64) of full-page captures, Day Pass card and fan mini masked`, got: out })}\n`);
  process.exit(0);
}
const baseline = JSON.parse(golden('nonreg-baseline.json')).got;
const near = (a, b) => a.length === b.length && a.every((v, i) => (typeof v === 'number' ? Math.abs(v - b[i]) <= 1 : v === b[i]));
for (const [key, m] of Object.entries(got)) {
  if (m.overflow > 0) failures.push(`${key}: scrolls horizontally by ${m.overflow}px (N3)`);
  const b = baseline[key];
  if (!b) { failures.push(`${key}: no baseline`); continue; }
  if (m.blocks.length !== b.blocks.length || !m.blocks.every((x, i) => near(x, b.blocks[i]))) failures.push(`${key}: main blocks moved: ${JSON.stringify(m.blocks)}, BASE ${JSON.stringify(b.blocks)} (N1)`);
  if (Math.abs(m.footTop - b.footTop) > 1) failures.push(`${key}: footer top ${m.footTop}, BASE ${b.footTop} (N1)`);
  if (m.shot.w !== b.shot.w || m.shot.bh !== b.shot.bh) { failures.push(`${key}: capture ${m.shot.w}x${m.shot.h}, BASE ${b.shot.w}x${b.shot.h} (N2)`); continue; }
  const base = unpack(b.shot.means);
  const diff = [];
  for (let blk = 0; blk < m.shot.bw * m.shot.bh; blk++) {
    const d = Math.max(...[0, 1, 2].map((c) => Math.abs(m.shot.means[blk * 3 + c] - base[blk * 3 + c])));
    if (d > TOL.level) diff.push(`(${(blk % m.shot.bw) * BLOCK},${Math.floor(blk / m.shot.bw) * BLOCK}) d${d}`);
  }
  if (diff.length > TOL.blocks) failures.push(`${key}: ${diff.length} screenshot blocks changed (> ${TOL.blocks}): ${diff.slice(0, 8).join(' ')} (N2)`);
}
for (const key of Object.keys(baseline)) if (!got[key]) failures.push(`${key}: in the baseline but not measured`);
finish(NAME, failures, `${Object.keys(got).length} ticket captures (${MODES.join('/')}) keep their geometry and screenshot (Day Pass card and fan mini masked) with no horizontal overflow.`);
