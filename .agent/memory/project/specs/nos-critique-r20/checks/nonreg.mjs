// nos-critique-r20 non-regression (fresh PUBLIC and PREVIEW production builds, next start 3010-3019 minus 3013). QA input, hash-locked.
// Widths 1280 and 390. r20 changes the NOS footer on every NOS page (f1-rendered.mjs and f3-rendered.mjs own it; f3 also holds the SAOC
// footer to BASE), so each capture is compared only down to the top of the page's last <footer>. r20 F2 removes the padding-top of the
// follower in a same-tone section.nos-section pair (f2-rendered.mjs owns which): this check puts each removed band back (its BASE
// height, the follower's own ground) before comparing, so everything else on the page must still match BASE exactly.
//   N0  every adjacent section.nos-section follower keeps its BASE padding-top, or (F2) drops it to 0; nothing else.
//   N1  geometry: main's top-level blocks [tag, top, height] and the last footer's top equal the BASE capture (+-1px) once the removed
//       bands are put back.
//   N2  screenshot: a full-page capture (lazy images forced, animations disabled, the home yearbook cover masked - it settles in one of
//       two states on preview, r16) with the removed bands put back, reduced to 32px block means, equals the BASE capture over the full
//       block rows above the footer: at most `tolerance.blocks` blocks may differ by more than `tolerance.level` (0-255) in any channel.
//   N3  no horizontal overflow.
// `--capture` prints goldens/nonreg-baseline.json (captured by @architect on BASE 7fb251a1, both modes).
import { deflateSync, inflateSync } from 'node:zlib';

import { BASE, finish, golden } from './_lib.mjs';
import { MODES, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'nonreg.mjs';
const CAPTURE = process.argv.includes('--capture');
const WIDTHS = [1280, 390];
const BLOCK = 32;
const TOL = { level: 16, blocks: 6 };
const ROUTES = ['/', '/about', '/events', '/media-kit', '/sponsors', '/terms', '/contact', '/societies', '/national-show', '/national-show/about', '/national-show/wosa-conference', '/national-show/symposium', '/national-show/workshops', '/national-show/faq', '/national-show/exhibitors', '/national-show/vendors', '/national-show/programme', '/national-show/tickets', '/national-show/what-to-expect'];
// The home yearbook cover (not an r20 target) settles in one of two states on the preview build at 1280 (one 32px row, d18-22, measured
// in r16 on cea06daf across a capture and two runs of the same build), so it is masked rather than compared.
const YEARBOOK_IMG = '[data-home-section="yearbook"] img';
const failures = [];
const got = {};
const BASELINE = CAPTURE ? null : JSON.parse(golden('nonreg-baseline.json')).got;
const baselineOf = (key) => (BASELINE ? BASELINE[key] ?? null : null);
// The padding bands F2 removed: a follower whose BASE padding-top was > 0 and is now 0. `at` is its current top (page px).
function bandsOf(geo, b) {
  if (!b || !b.followers || b.followers.length !== geo.followers.length) return [];
  return geo.followers.flatMap((f, k) => (b.followers[k][1] > 0 && f[1] === 0 ? [{ at: f[0], h: b.followers[k][1], ground: f[2] }] : []));
}
// Moves a current y back to BASE coordinates: every band that started above it was removed (a band sits at its follower's top, so the
// follower's own top maps to where its BASE padding began).
const unshift = (y, bands) => y + bands.filter((b) => b.at < y).reduce((t, b) => t + b.h, 0);

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
        const feet = document.querySelectorAll('footer');
        const foot = feet[feet.length - 1];
        // Followers of adjacent section.nos-section pairs, in document order: [top, padding-top, ground].
        const followers = [...document.querySelectorAll('section.nos-section')].filter((x) => x.previousElementSibling && x.previousElementSibling.matches('section.nos-section')).map((x) => { const cs = getComputedStyle(x); return [Math.round(x.getBoundingClientRect().top + scrollY), Math.round(parseFloat(cs.paddingTop)), cs.backgroundColor]; });
        return { blocks, followers, footTop: foot ? Math.round(foot.getBoundingClientRect().top + scrollY) : document.documentElement.scrollHeight, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      const mask = [page.locator(YEARBOOK_IMG)];
      const png = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide', mask, maskColor: '#ff00ff' });
      const bands = CAPTURE ? [] : bandsOf(geo, baselineOf(`${mode} ${route} @${width}`));
      const fp = await page.evaluate(async ({ b64, block, bands }) => {
        const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
        // Put each removed band back: the rows above it, then the band in its ground, then the rest, shifted down.
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height + bands.reduce((t, b) => t + b.h, 0);
        const x = c.getContext('2d', { willReadFrequently: true });
        let src = 0; let dst = 0;
        for (const b of [...bands].sort((p, q) => p.at - q.at)) {
          x.drawImage(img, 0, src, img.width, b.at - src, 0, dst, img.width, b.at - src);
          dst += b.at - src; src = b.at;
          x.fillStyle = b.ground; x.fillRect(0, dst, img.width, b.h); dst += b.h;
        }
        x.drawImage(img, 0, src, img.width, img.height - src, 0, dst, img.width, img.height - src);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        const bw = Math.ceil(c.width / block); const bh = Math.ceil(c.height / block);
        const out = new Array(bw * bh * 3).fill(0); const n = new Array(bw * bh).fill(0);
        for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) {
          const b = Math.floor(yy / block) * bw + Math.floor(xx / block); const i = (yy * c.width + xx) * 4;
          out[b * 3] += d[i]; out[b * 3 + 1] += d[i + 1]; out[b * 3 + 2] += d[i + 2]; n[b] += 1;
        }
        return { w: c.width, h: c.height, bw, bh, means: out.map((v, k) => Math.round(v / n[Math.floor(k / 3)])) };
      }, { b64: png.toString('base64'), block: BLOCK, bands });
      got[`${mode} ${route} @${width}`] = { ...geo, bands, shot: { w: fp.w, h: fp.h, bw: fp.bw, bh: fp.bh, means: fp.means } };
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
  for (const [k, m] of Object.entries(got)) out[k] = { blocks: m.blocks, followers: m.followers, footTop: m.footTop, shot: { w: m.shot.w, h: m.shot.h, bw: m.shot.bw, bh: m.shot.bh, means: pack(m.shot.means) } };
  process.stdout.write(`${JSON.stringify({ recorded: `${MODES.join(' and ')} builds of BASE ${BASE}; ${BLOCK}px block means (deflate+base64) of masked full-page captures`, got: out })}\n`);
  process.exit(0);
}
const baseline = BASELINE;
const near = (a, b) => a.length === b.length && a.every((v, i) => (typeof v === 'number' ? Math.abs(v - b[i]) <= 1 : v === b[i]));
for (const [key, m] of Object.entries(got)) {
  if (m.overflow > 0) failures.push(`${key}: scrolls horizontally by ${m.overflow}px (N3)`);
  const b = baseline[key];
  if (!b) { failures.push(`${key}: no baseline`); continue; }
  if (m.followers.length !== b.followers.length) failures.push(`${key}: ${m.followers.length} section pairs, BASE ${b.followers.length} (N0)`);
  else m.followers.forEach((f, k) => { if (f[1] !== b.followers[k][1] && f[1] !== 0) failures.push(`${key}: section pair ${k + 1} follower padding-top ${f[1]}px, BASE ${b.followers[k][1]}px (only F2's 0 is allowed) (N0)`); });
  const blocks = m.blocks.map(([tag, top, h]) => [tag, unshift(top, m.bands), unshift(top + h - 1, m.bands) - unshift(top, m.bands) + 1]);
  if (blocks.length !== b.blocks.length || !blocks.every((x, i) => near(x, b.blocks[i]))) failures.push(`${key}: main blocks moved (removed F2 bands put back): ${JSON.stringify(blocks)}, BASE ${JSON.stringify(b.blocks)} (N1)`);
  const footTop = unshift(m.footTop, m.bands);
  if (Math.abs(footTop - b.footTop) > 1) failures.push(`${key}: footer top ${footTop} (bands put back), BASE ${b.footTop} (N1)`);
  if (m.shot.w !== b.shot.w) { failures.push(`${key}: capture width ${m.shot.w}, BASE ${b.shot.w} (N2)`); continue; }
  const base = unpack(b.shot.means);
  const diff = [];
  // Only the full 32px block rows above the footer (both captures' footer tops, so a +-1px wobble cannot pull in a footer row).
  for (let blk = 0; blk < m.shot.bw * Math.floor(Math.min(footTop, b.footTop) / BLOCK); blk++) {
    const d = Math.max(...[0, 1, 2].map((c) => Math.abs(m.shot.means[blk * 3 + c] - base[blk * 3 + c])));
    if (d > TOL.level) diff.push(`(${(blk % m.shot.bw) * BLOCK},${Math.floor(blk / m.shot.bw) * BLOCK}) d${d}`);
  }
  if (diff.length > TOL.blocks) failures.push(`${key}: ${diff.length} screenshot blocks changed (> ${TOL.blocks}): ${diff.slice(0, 8).join(' ')} (N2)`);
}
for (const key of Object.keys(baseline)) if (!got[key]) failures.push(`${key}: in the baseline but not measured`);
finish(NAME, failures, `${Object.keys(got).length} SAOC/NOS captures (${MODES.join('/')}) keep their geometry and screenshot above the footer with no horizontal overflow.`);
