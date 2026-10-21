// nos-critique-r20 F3 rendered (fresh PUBLIC and PREVIEW production builds, next start 3010-3019 minus 3013). QA input, hash-locked.
// Goldens: goldens/f3-edits.json, f3-baseline.json (the SAOC footer at BASE). Both modes; 1280 and 390 (the ruling's widths) and 900 (the
// md two-column band). The SAOC footer is measured live on the same build (golden saoc.route) and the NOS footer (footer#nf) on golden
// nosRoutes; "column" = a direct child of the footer's first <div> (the grid), "bar" = the bottom bar's inner flex row.
//   L1  grid parity: the NOS footer has 4 columns whose x and width equal the SAOC footer's (+-1px) at every width (at 1280: 32, 344,
//       656, 968), its grid box equals SAOC's, and the columns start 64px under the footer top (py-16).
//   L2  height: the NOS footer is within +-40px of the SAOC footer's height at 1280 and 390 (SAOC 476px at 1280, +-1px).
//   L3  bottom bar: the bar's x, width, height and distance from the footer bottom equal SAOC's (+-1px); the copyright starts on the bar's left content edge and the
//       legal group's box sits where SAOC's does relative to the bar (+-2px).
//   L4  brand: the one NOS-2027 gold vertical lockup, 248px wide (aspect kept), centred over column 1 (+-1px), its top on the column
//       top; at 1280 also level with the "Explore" heading (+-1px).
//   L5  REG/NPO: left-aligned on column 1's left edge across its width, 32px under the lockup (+-1px), in the NOS label role (the
//       .nf-head family, size, letter-spacing, uppercase) and gold (the computed colour of the gold sign-up button's ground).
//   L6  content: columns 2-4 open with "Explore", "Partners", "Stay in touch"; column 4 also holds "Looking for wild orchids?". The
//       footer ground is the NOS royal rgb(33, 26, 87). No horizontal overflow.
//   L7  the SAOC footer is unchanged: on golden saocRoutes its box, columns, bar and lockup equal BASE (+-1px) and its pixels (16px block
//       means, colour level 8) equal BASE's.
// `--capture` prints goldens/f3-baseline.json (captured by @architect on BASE 7fb251a1, both modes).
import { BASE, finish, goldenJson } from './_lib.mjs';
import { MODES, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'f3-rendered.mjs';
const CAPTURE = process.argv.includes('--capture');
const G = goldenJson('f3-edits.json');
const WIDTHS = [1280, 900, 390];
const ROYAL = 'rgb(33, 26, 87)';
const BLOCK = 16;
const LEVEL = 8;
const failures = [];
const got = {};
const near = (a, b, t = 1) => Math.abs(a - b) <= t;
const same = (x, y, t = 1) => x && y && ['x', 'y', 'w', 'h'].every((k) => near(x[k], y[k], t));

// Boxes are relative to the footer's top-left (x stays page-relative so columns compare across footers).
const measure = (page, sel) => page.evaluate((sel) => {
  const f = sel === 'last' ? [...document.querySelectorAll('footer')].pop() : document.querySelector(sel);
  if (!f) return null;
  const top = f.getBoundingClientRect().top;
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top - top, w: r.width, h: r.height }; };
  const grid = f.firstElementChild;
  const cols = grid ? [...grid.children] : [];
  const barRow = f.children[1] ? f.children[1].firstElementChild : null;
  const cs = (el, props) => (el ? Object.fromEntries(props.map((p) => [p, getComputedStyle(el).getPropertyValue(p)])) : null);
  const lockup = cols[0] ? cols[0].querySelector('img') : null;
  const reg = f.querySelector('.nf-reg') ?? (cols[0] ? cols[0].querySelector(':scope > span') : null);
  return {
    footer: box(f), bg: getComputedStyle(f).backgroundColor, grid: box(grid), cols: cols.map(box),
    heads: cols.map((c) => (c.querySelector('.nf-head, div') ? c.querySelector('.nf-head, div').textContent.replace(/\s+/g, ' ').trim() : '')),
    texts: cols.map((c) => c.textContent.replace(/\s+/g, ' ').trim()),
    bar: box(barRow), copy: box(barRow ? barRow.firstElementChild : null), legal: box(barRow ? barRow.lastElementChild : null),
    lockup: lockup ? { ...box(lockup), src: lockup.currentSrc || lockup.src, nw: lockup.naturalWidth, nh: lockup.naturalHeight } : null,
    reg: reg ? { ...box(reg), style: cs(reg, ['font-family', 'font-size', 'letter-spacing', 'text-transform', 'color', 'text-align']) } : null,
    roleStyle: cs(f.querySelector('.nf-col .nf-head'), ['font-family', 'font-size', 'letter-spacing', 'text-transform']),
    gold: f.querySelector('.nf-form button') ? getComputedStyle(f.querySelector('.nf-form button')).backgroundColor : null,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}, sel);

const means = async (page, sel) => {
  const png = await page.locator(sel).last().screenshot({ animations: 'disabled', caret: 'hide' });
  return page.evaluate(async ({ b64, block }) => {
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
    return { w: c.width, h: c.height, means: out.map((v, k) => Math.round(v / n[Math.floor(k / 3)])) };
  }, { b64: png.toString('base64'), block: BLOCK });
};

const load = async (page, origin, route, at) => {
  const r = await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
  if (!r || r.status() !== 200) { failures.push(`${at}: HTTP ${r ? r.status() : 0}`); return false; }
  await page.evaluate(async () => {
    document.querySelectorAll('footer img[loading="lazy"]').forEach((i) => i.setAttribute('loading', 'eager'));
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('footer img')].map((i) => (i.complete ? null : i.decode().catch(() => null))));
  });
  return true;
};

for (const mode of MODES) {
  const srv = await serve(mode);
  if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
  const browser = await chromium.launch();
  try {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', extraHTTPHeaders: srv.headers ?? {} });
      const page = await ctx.newPage();
      for (const route of G.saocRoutes) {
        const at = `${mode} SAOC ${route} @${width}`;
        if (!(await load(page, srv.origin, route, at))) continue;
        got[at] = { ...(await measure(page, 'last')), shot: await means(page, 'footer') };
      }
      if (CAPTURE) { await ctx.close(); continue; }
      const saoc = got[`${mode} SAOC ${G.saoc.route} @${width}`];
      for (const route of G.nosRoutes) {
        const at = `${mode} NOS ${route} @${width}`;
        if (!(await load(page, srv.origin, route, at))) continue;
        const n = await measure(page, 'footer#nf');
        if (!n || !saoc) { failures.push(`${at}: footer not measurable (INFRA)`); continue; }
        // L1
        if (n.cols.length !== 4 || saoc.cols.length !== 4) failures.push(`${at}: ${n.cols.length} NOS / ${saoc.cols.length} SAOC columns, want 4 (L1)`);
        else n.cols.forEach((c, k) => { if (!near(c.x, saoc.cols[k].x) || !near(c.w, saoc.cols[k].w)) failures.push(`${at}: column ${k + 1} x ${Math.round(c.x)} w ${Math.round(c.w)}, SAOC x ${Math.round(saoc.cols[k].x)} w ${Math.round(saoc.cols[k].w)} (L1)`); });
        if (width === 1280 && n.cols.length === 4) n.cols.forEach((c, k) => { if (!near(c.x, G.saoc.columnsX1280[k])) failures.push(`${at}: column ${k + 1} at x ${Math.round(c.x)}, want ${G.saoc.columnsX1280[k]} (L1)`); });
        if (!near(n.grid.x, saoc.grid.x) || !near(n.grid.w, saoc.grid.w)) failures.push(`${at}: grid x/w ${Math.round(n.grid.x)}/${Math.round(n.grid.w)}, SAOC ${Math.round(saoc.grid.x)}/${Math.round(saoc.grid.w)} (L1)`);
        if (n.cols[0] && !near(n.cols[0].y, 64)) failures.push(`${at}: the columns start ${Math.round(n.cols[0].y)}px under the footer top, want 64 (L1)`);
        // L2
        if (width !== 900 && !near(n.footer.h, saoc.footer.h, G.saoc.heightTolerance)) failures.push(`${at}: NOS footer ${Math.round(n.footer.h)}px tall, SAOC ${Math.round(saoc.footer.h)}px (want +-${G.saoc.heightTolerance}) (L2)`);
        // L3
        const fromFoot = (f) => f.footer.h - f.bar.y;
        if (!n.bar || !saoc.bar || !near(n.bar.x, saoc.bar.x) || !near(n.bar.w, saoc.bar.w) || !near(n.bar.h, saoc.bar.h) || !near(fromFoot(n), fromFoot(saoc))) failures.push(`${at}: bar x ${Math.round(n.bar?.x)} w ${Math.round(n.bar?.w)} h ${Math.round(n.bar?.h)}, ${Math.round(n.bar ? fromFoot(n) : 0)}px above the footer bottom; SAOC ${Math.round(saoc.bar?.x)} / ${Math.round(saoc.bar?.w)} / ${Math.round(saoc.bar?.h)}, ${Math.round(saoc.bar ? fromFoot(saoc) : 0)}px (L3)`);
        if (n.copy && saoc.copy && !near(n.copy.x, saoc.copy.x)) failures.push(`${at}: copyright at x ${Math.round(n.copy.x)}, SAOC ${Math.round(saoc.copy.x)} (L3)`);
        if (n.legal && saoc.legal && (!near(n.legal.x, saoc.legal.x, 2) || !near(n.legal.y - n.bar.y, saoc.legal.y - saoc.bar.y, 2))) failures.push(`${at}: legal links at (${Math.round(n.legal.x)}, bar+${Math.round(n.legal.y - n.bar.y)}), SAOC (${Math.round(saoc.legal.x)}, bar+${Math.round(saoc.legal.y - saoc.bar.y)}) (L3)`);
        // L4
        const L = n.lockup; const c1 = n.cols[0];
        if (!L || !L.src.includes('NOS-2027-logo-reversed-gold-vertical')) failures.push(`${at}: column 1 does not hold the NOS-2027 gold vertical lockup (${L ? L.src : 'none'}) (L4)`);
        else {
          if (!near(L.w, G.lockup.width, 0.5) || !near(L.h, (G.lockup.width * G.lockup.natural[1]) / G.lockup.natural[0])) failures.push(`${at}: lockup ${L.w.toFixed(1)}x${L.h.toFixed(1)}, want ${G.lockup.width}x${((G.lockup.width * G.lockup.natural[1]) / G.lockup.natural[0]).toFixed(1)} (L4)`);
          if (c1 && !near(L.x + L.w / 2, c1.x + c1.w / 2)) failures.push(`${at}: lockup centre ${Math.round(L.x + L.w / 2)}, column 1 centre ${Math.round(c1.x + c1.w / 2)} (L4)`);
          if (c1 && !near(L.y, c1.y)) failures.push(`${at}: lockup top ${Math.round(L.y)}, column top ${Math.round(c1.y)} (L4)`);
          if (width === 1280 && n.cols[1] && !near(L.y, n.cols[1].y)) failures.push(`${at}: lockup top ${Math.round(L.y)} is not level with the Explore column (${Math.round(n.cols[1].y)}) (L4)`);
        }
        // L5
        const R = n.reg;
        if (!R || !c1) failures.push(`${at}: no REG/NPO line (L5)`);
        else {
          if (!near(R.x, c1.x) || !near(R.w, c1.w) || R.style['text-align'] !== 'start' && R.style['text-align'] !== 'left') failures.push(`${at}: REG/NPO at x ${Math.round(R.x)} w ${Math.round(R.w)} ${R.style['text-align']}, want column 1 (${Math.round(c1.x)}, ${Math.round(c1.w)}) left-aligned (L5)`);
          if (L && !near(R.y - (L.y + L.h), G.brandGap)) failures.push(`${at}: REG/NPO ${Math.round(R.y - (L.y + L.h))}px under the lockup, want ${G.brandGap} (L5)`);
          for (const p of ['font-family', 'font-size', 'letter-spacing', 'text-transform']) if (n.roleStyle && R.style[p] !== n.roleStyle[p]) failures.push(`${at}: REG/NPO ${p} ${R.style[p]}, label role ${n.roleStyle[p]} (L5)`);
          if (!n.gold || R.style.color !== n.gold) failures.push(`${at}: REG/NPO colour ${R.style.color}, gold ${n.gold} (L5)`);
        }
        // L6
        const want = [G.headings.explore, G.headings.partners, G.headings.touch];
        want.forEach((h, k) => { if (n.heads[k + 1] !== h) failures.push(`${at}: column ${k + 2} opens with ${JSON.stringify(n.heads[k + 1])}, want ${JSON.stringify(h)} (L6)`); });
        if (!(n.texts[3] ?? '').includes(G.headings.wild)) failures.push(`${at}: column 4 lacks "${G.headings.wild}" (L6)`);
        if (n.bg !== ROYAL) failures.push(`${at}: footer ground ${n.bg}, want ${ROYAL} (L6)`);
        if (n.overflow > 0) failures.push(`${at}: scrolls horizontally by ${n.overflow}px (L6)`);
      }
      // L2 sanity on the ruling's number
      if (width === 1280 && saoc && !near(saoc.footer.h, G.saoc.height1280)) failures.push(`${mode} SAOC ${G.saoc.route} @1280: footer ${Math.round(saoc.footer.h)}px, the ruling measured ${G.saoc.height1280} (L2)`);
      await ctx.close();
    }
  } catch (e) {
    failures.push(`render error: ${e && e.message ? e.message : e}`);
  } finally {
    await browser.close();
    await srv.stop();
  }
}

if (CAPTURE) {
  if (failures.length) finish(NAME, failures);
  process.stdout.write(`${JSON.stringify({ recorded: `${MODES.join(' and ')} builds of BASE ${BASE}: the SAOC footer (boxes and ${BLOCK}px block means) on ${G.saocRoutes.join(', ')}`, got })}\n`);
  process.exit(0);
}

// L7
const baseline = goldenJson('f3-baseline.json').got;
for (const [key, b] of Object.entries(baseline)) {
  const m = got[key];
  if (!m) { failures.push(`${key}: in the baseline but not measured (L7)`); continue; }
  const boxes = ['footer', 'grid', 'bar', 'copy', 'legal', 'lockup'];
  for (const k of boxes) if (!same(m[k], b[k])) failures.push(`${key}: SAOC footer ${k} ${JSON.stringify(m[k])}, BASE ${JSON.stringify(b[k])} (L7)`);
  if (m.cols.length !== b.cols.length || !m.cols.every((c, k) => same(c, b.cols[k]))) failures.push(`${key}: SAOC footer columns moved (L7)`);
  if (m.shot.w !== b.shot.w || m.shot.h !== b.shot.h) failures.push(`${key}: SAOC footer capture ${m.shot.w}x${m.shot.h}, BASE ${b.shot.w}x${b.shot.h} (L7)`);
  else {
    const off = m.shot.means.filter((v, k) => Math.abs(v - b.shot.means[k]) > LEVEL).length;
    if (off > 0) failures.push(`${key}: ${off} SAOC footer colour samples differ from BASE by more than ${LEVEL} (L7)`);
  }
}
finish(NAME, failures, `NOS footer on the SAOC grid (${MODES.join('/')}, ${WIDTHS.join('/')}): columns, bar and height match SAOC, 248px lockup centred with REG/NPO 32px under it in gold, SAOC footer unchanged.`);
