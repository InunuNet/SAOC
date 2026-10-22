// nos-hero-banding F1 rendered (fresh PUBLIC and PREVIEW production builds against the live Sanity dataset, with the harness-only
// hero-filter.cjs dropping asset a620a97f; next start 3010-3019 minus 3013/3016). QA input, hash-locked.
// Goldens: goldens/f1-edits.json (scrims, dropAsset), f1-thresholds.json, f1-calibration.json (the BASE numbers behind the thresholds).
// Home hero at 1440 and 1920, DPR 1 and 2, every slide made active by its dot (reduced motion, so no autoplay), the copy hidden for the
// capture (visibility only), the capture covering the hero plus 8 CSS px of MissionBlock.
//   R1  delivery: every slide's currentSrc is on cdn.sanity.io with q=88 and auto=format; no slide names the dropped asset (else the
//       harness filter did not run: INFRA).
//   R2  BAND METRIC, two parts, both over the scrim region (the hero's bottom third through 8 CSS px into MissionBlock):
//       (a) step: the per-row mean colour (all columns), any channel 0-255, read two ways. The smoothed step, |row(y+1) - row(y-1)| / 2,
//           must be <= `rowStep`; the raw step between adjacent device rows must be <= `rawStep`. A horizontally coherent step - a band
//           edge, a stripe, the seam - moves the whole row mean; photo texture and Chrome's +-1 gradient dither average out. The raw step
//           alternates high/low row to row inside the veil's linear segments (8-bit alpha), so it is only bounded loosely; the smoothed step
//           carries the tight ceiling. BASE smoothed 8.72-10.2, raw 16.0-17.0 (bone pull vs parchment section); golden fix smoothed
//           1.50-3.63, raw 2.36-4.32; 5663bab3 smoothed 1.49-3.59, raw 2.38-4.41.
//       (b) starvation: source bytes x 8 / delivered pixels of the active slide >= `sourceBpp`. A source with fewer bits than the
//           delivered pixels contours (rings) in smooth areas whatever q is asked; BASE yellow 0.46-0.53, pink 1.38-1.57.
//   R3  seam: the last hero row and the first MissionBlock row (row means) differ by <= `seam` per channel, and that MissionBlock row
//       equals MissionBlock's computed background within `seam`.
//   R4  text zone: each copy element (eyebrow, h1, the h1 em, the lede when shown, the secondary CTA, the pause button) has >= 4.5:1
//       between its computed colour and the lightest backdrop pixel in its box (+ contentMargin), the eyebrow pill's own fill composited.
//   R5  slide count: slides, dots and the "n of N" labels all equal `slides` (3 under the filter); dot k is "Show slide k"; with motion
//       allowed, autoplay (clock-driven, `intervalMs`) visits 1 -> 2 -> 3 -> 1.
//   R6  no 2560 variant: at 1280 DPR2 the hero picks its largest srcset candidate under sizes 100vw, and that candidate is >= 1920w.
//   R7  no line at the pull's top (Codi's amendment): from the pull's computed stops, the slope change at the top stop is <= 10% of BASE's
//       join kink (0 -> 1/72 alpha/px) and every other joint at or above 46px <= 25%; the pull rendered alone over black matches
//       parchment x alpha(y) within 3 levels (1280x1, 1280x2, 390x2, 1920x1).
// --calibrate runs the unfiltered (yellow) build and prints the R2-R4 numbers per slide; --calibrate --simulate also injects the golden
// scrim stops and q=88 into BASE's page (calibration only: what the thresholds were set against). Neither asserts.
// --report also prints the per-slide numbers (smoothed and raw step among them) to stderr on an asserting run.
import { finish, goldenJson } from './_lib.mjs';
import { MODES, authorize, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const sharp = require('sharp');
const NAME = 'f1-rendered.mjs';
const G = goldenJson('f1-edits.json');
const T = goldenJson('f1-thresholds.json');
const CALIBRATE = process.argv.includes('--calibrate');
const SIMULATE = CALIBRATE && process.argv.includes('--simulate');
const HERO = 'section[aria-roledescription="carousel"]';
const SLIDES = `${HERO} > [aria-roledescription="slide"]`;
const DOTS = `${HERO} [aria-label="Carousel navigation"] button`;
const COPY = `${HERO} > div.z-10`;
const MISSION = `${HERO} + section`;
const BELOW = 8;
const GLYPH = 24;
const GROW = 2;
const failures = [];
const report = [];
let measured = 0;

const SIM_CSS = `[data-hero-scrim='veil']{background-image:radial-gradient(ellipse 100% 62% at 50% 50%, ${G.scrims.veilMobile.join(', ')})}
@media (min-width:768px){[data-hero-scrim='veil']{background-image:radial-gradient(ellipse 56% 54% at 50% 50%, ${G.scrims.veilDesktop.join(', ')})}}
[data-hero-scrim='bone']{background-image:linear-gradient(to top, ${G.scrims.pull.join(', ')})}`;

const rgba = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
const lum = (c) => { const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const info = (page) => page.evaluate(({ HERO, SLIDES, DOTS, COPY, MISSION }) => {
  const hero = document.querySelector(HERO);
  const r = hero.getBoundingClientRect();
  const box = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top + scrollY, w: b.width, h: b.height }; };
  const copy = document.querySelector(COPY);
  const pick = [['eyebrow', 'span'], ['h1', 'h1'], ['h1 em', 'h1 em'], ['lede', '[data-hero-lede]'], ['secondary CTA', '[data-hero-cta="secondary"]'], ['pause', 'button[aria-label="Pause"], button[aria-label="Play"]']];
  const texts = pick.map(([name, sel]) => {
    const el = copy.querySelector(sel); if (!el) return null; const cs = getComputedStyle(el);
    const exclude = name === 'h1' ? [...el.querySelectorAll('em')].flatMap((em) => [...em.getClientRects()].map((q) => ({ x: q.left, y: q.top + scrollY, w: q.width, h: q.height }))) : [];
    return { name, ...box(el), color: cs.color, bg: cs.backgroundColor, exclude };
  }).filter(Boolean);
  const slides = [...document.querySelectorAll(SLIDES)].map((g) => { const img = g.querySelector('img'); return { label: g.getAttribute('aria-label'), hidden: g.getAttribute('aria-hidden'), src: img ? img.currentSrc : null, nw: img ? img.naturalWidth : 0, nh: img ? img.naturalHeight : 0 }; });
  const dots = [...document.querySelectorAll(DOTS)].map((d) => ({ label: d.getAttribute('aria-label'), current: d.getAttribute('aria-current') }));
  const mission = document.querySelector(MISSION);
  return { hero: { x: r.left, y: r.top + scrollY, w: r.width, h: r.height }, texts, slides, dots, missionBg: mission ? getComputedStyle(mission).backgroundColor : null, missionTop: mission ? mission.getBoundingClientRect().top + scrollY : null };
}, { HERO, SLIDES, DOTS, COPY, MISSION });

async function sourceBytes(page, src) {
  const asset = src.replace(/\?.*$/, '');
  const res = await page.request.head(asset);
  const n = Number(res.headers()['content-length']);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Decoded pixels of a cdn.sanity.io slide: w= (never upscaled) and the source aspect from the asset name (-WxH.). naturalWidth is no
// use here: with a w-descriptor srcset Chrome divides it by the candidate's density.
function delivered(src) {
  let url; try { url = new URL(src); } catch { return null; }
  const m = url.pathname.match(/-(\d+)x(\d+)\.\w+$/);
  const w = Number(url.searchParams.get('w'));
  if (!m || !w) return null;
  const [sw, sh] = [Number(m[1]), Number(m[2])];
  const dw = Math.min(w, sw);
  return { w: dw, h: Math.round((dw * sh) / sw) };
}

async function measure(page, i, at, dpr) {
  await page.locator(DOTS).nth(i).click();
  await page.waitForFunction(({ SLIDES, i }) => {
    const g = document.querySelectorAll(SLIDES)[i]; const img = g && g.querySelector('img');
    return g && !g.hasAttribute('aria-hidden') && img && img.complete && img.naturalWidth > 0 && getComputedStyle(g).opacity === '1';
  }, { SLIDES, i }, { timeout: 60_000 });
  const m = await info(page);
  const slide = m.slides[i];
  const shown = await page.screenshot({ clip: { x: 0, y: m.hero.y, width: m.hero.w, height: m.hero.h + BELOW }, animations: 'disabled', caret: 'hide' });
  await page.addStyleTag({ content: `${COPY}{visibility:hidden !important}` }).then((h) => h.evaluate((el) => el.setAttribute('data-rhb-hide', '')));
  const png = await page.screenshot({ clip: { x: 0, y: m.hero.y, width: m.hero.w, height: m.hero.h + BELOW }, animations: 'disabled', caret: 'hide' });
  await page.evaluate(() => document.querySelectorAll('style[data-rhb-hide]').forEach((s) => s.remove()));
  const { data, info: px } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: inkPx } = await sharp(shown).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = px.width; const heroRows = Math.round(m.hero.h * dpr);
  const rowMean = (y) => { const s = [0, 0, 0]; for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) s[c] += data[(y * W + x) * 3 + c]; return s.map((v) => v / W); };
  // R2a
  const top = Math.round((heroRows * 2) / 3);
  const rm = []; for (let y = top - 1; y < px.height; y++) rm.push(rowMean(y));
  let step = 0; let stepAt = 0; let rawStep = 0;
  for (let k = 1; k < rm.length; k++) {
    rawStep = Math.max(rawStep, ...rm[k].map((v, c) => Math.abs(v - rm[k - 1][c])));
    if (k + 1 >= rm.length) break;
    const d = Math.max(...rm[k + 1].map((v, c) => Math.abs(v - rm[k - 1][c]) / 2));
    if (d > step) { step = d; stepAt = top - 1 + k; }
  }
  // R2b
  const bytes = slide.src ? await sourceBytes(page, slide.src) : null;
  const dims = delivered(slide.src);
  const bpp = bytes && dims ? (bytes * 8) / (dims.w * dims.h) : null;
  // R3
  const last = rowMean(heroRows - 1); const first = rowMean(heroRows);
  const seam = Math.max(...last.map((v, c) => Math.abs(v - first[c])));
  const mb = rgba(m.missionBg ?? '');
  const mbOff = mb ? Math.max(Math.abs(first[0] - mb.r), Math.abs(first[1] - mb.g), Math.abs(first[2] - mb.b)) : null;
  // R4
  const contrast = [];
  for (const t of m.texts) {
    const pad = T.contentMargin;
    const x0 = Math.max(0, Math.floor((t.x - pad) * dpr)); const x1 = Math.min(W, Math.ceil((t.x + t.w + pad) * dpr));
    const y0 = Math.max(0, Math.floor((t.y - m.hero.y - pad) * dpr)); const y1 = Math.min(heroRows, Math.ceil((t.y - m.hero.y + t.h + pad) * dpr));
    // The backdrop under the glyphs: pixels the copy changed (> GLYPH in a channel), widened by GROW device px, minus the boxes of
    // nested copy measured on its own (the h1's em); the lightest backdrop pixel there is the worst case.
    const skip = (x, y) => t.exclude.some((e) => x >= (e.x - pad) * dpr && x < (e.x + e.w + pad) * dpr && y >= (e.y - m.hero.y - pad) * dpr && y < (e.y - m.hero.y + e.h + pad) * dpr);
    const changed = (x, y) => { const k = (y * W + x) * 3; return Math.max(Math.abs(inkPx[k] - data[k]), Math.abs(inkPx[k + 1] - data[k + 1]), Math.abs(inkPx[k + 2] - data[k + 2])) > GLYPH; };
    const g = GROW * dpr;
    let worst = null; let worstL = -1;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (skip(x, y)) continue;
      let near = false;
      for (let dy = -g; dy <= g && !near; dy++) for (let dx = -g; dx <= g && !near; dx++) { const xx = x + dx; const yy = y + dy; if (xx >= x0 && xx < x1 && yy >= y0 && yy < y1 && changed(xx, yy)) near = true; }
      if (!near) continue;
      const k = (y * W + x) * 3; const c = { r: data[k], g: data[k + 1], b: data[k + 2], a: 1 }; const l = lum(c);
      if (l > worstL) { worstL = l; worst = c; }
    }
    if (!worst) continue;
    const fill = rgba(t.bg); const ground = fill && fill.a > 0 ? over(fill, worst) : worst;
    const fg = rgba(t.color); const ink = fg.a < 1 ? over(fg, ground) : fg;
    contrast.push({ name: t.name, ratio: Number(ratio(ink, ground).toFixed(2)) });
  }
  return { m, slide, dims, step: Number(step.toFixed(2)), rawStep: Number(rawStep.toFixed(2)), stepAt: Number((stepAt / dpr).toFixed(1)), bytes, bpp: bpp === null ? null : Number(bpp.toFixed(3)), seam: Number(seam.toFixed(2)), mbOff: mbOff === null ? null : Number(mbOff.toFixed(2)), contrast };
}

for (const mode of MODES) {
  const srv = await serve(mode, { yellow: CALIBRATE });
  if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
  const browser = await chromium.launch();
  try {
    for (const [width, dpr] of T.viewports) {
      const at = `${mode} @${width}x${dpr}`;
      const ctx = await browser.newContext({ viewport: { width, height: 1200 }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
      await authorize(ctx, srv);
      const page = await ctx.newPage();
      page.setDefaultTimeout(60_000);
      const r = await page.goto(`${srv.origin}/`, { waitUntil: 'networkidle' });
      if (!r || r.status() !== 200) { failures.push(`${at}: HTTP ${r ? r.status() : 0}`); await ctx.close(); continue; }
      await page.evaluate(async () => { await document.fonts.ready; });
      if (SIMULATE) {
        await page.addStyleTag({ content: SIM_CSS });
        await page.evaluate((SLIDES) => document.querySelectorAll(`${SLIDES} img`).forEach((img) => { img.srcset = img.srcset.replace(/q=75/g, 'q=88'); }), SLIDES);
      }
      const base = await info(page);
      const n = base.slides.length;
      if (!CALIBRATE) {
        // R5 (static part) and R1
        if (n !== T.slides) failures.push(`${at}: ${n} slides, want ${T.slides} under the harness filter${base.slides.some((s) => s.src && s.src.includes(G.dropAsset)) ? ' (the dropped asset is still served: hero-filter.cjs did not run, INFRA)' : ''} (R5)`);
        if (base.dots.length !== n) failures.push(`${at}: ${base.dots.length} dots for ${n} slides (R5)`);
        base.slides.forEach((s, k) => { if (s.label !== `${k + 1} of ${n}`) failures.push(`${at}: slide ${k + 1} label ${JSON.stringify(s.label)}, want "${k + 1} of ${n}" (R5)`); });
        base.dots.forEach((d, k) => { if (d.label !== `Show slide ${k + 1}`) failures.push(`${at}: dot ${k + 1} label ${JSON.stringify(d.label)}, want "Show slide ${k + 1}" (R5)`); });
      }
      for (let i = 0; i < n; i++) {
        const k = await measure(page, i, at, dpr);
        measured += 1;
        const tag = `${at} slide ${i + 1}/${n} ${(k.slide.src ?? '').replace(/^.*\/production\/([0-9a-f]{8}).*$/, '$1')}`;
        report.push({ at, slide: i + 1, asset: (k.slide.src ?? '').replace(/^.*\/production\/([0-9a-f]{8}).*?(\?.*)$/, '$1 $2'), delivered: k.dims ? `${k.dims.w}x${k.dims.h}` : null, step: k.step, rawStep: k.rawStep, stepAt: k.stepAt, bpp: k.bpp, seam: k.seam, mbOff: k.mbOff, minContrast: Math.min(...k.contrast.map((c) => c.ratio)), contrast: k.contrast });
        if (CALIBRATE) continue;
        let url = null; try { url = new URL(k.slide.src); } catch { /* reported below */ }
        if (!url || url.hostname !== 'cdn.sanity.io' || url.searchParams.get('q') !== String(T.quality) || url.searchParams.get('auto') !== 'format') failures.push(`${tag}: currentSrc ${k.slide.src}, want cdn.sanity.io with q=${T.quality}&auto=format (R1)`);
        if (k.slide.src && k.slide.src.includes(G.dropAsset)) failures.push(`${tag}: the dropped asset is served (INFRA: hero-filter.cjs) (R1)`);
        if (k.step > T.rowStep) failures.push(`${tag}: smoothed band step ${k.step} levels at y=${k.stepAt} (hero-relative CSS px), max ${T.rowStep} (R2a)`);
        if (k.rawStep > T.rawStep) failures.push(`${tag}: raw band step ${k.rawStep} levels between adjacent rows, max ${T.rawStep} (R2a)`);
        if (k.bpp === null) failures.push(`${tag}: no source size for ${k.slide.src} (INFRA) (R2b)`);
        else if (k.bpp < T.sourceBpp) failures.push(`${tag}: source ${k.bpp} bits per delivered pixel (${k.bytes} bytes over ${k.dims ? `${k.dims.w}x${k.dims.h}` : '?'}), min ${T.sourceBpp} (R2b)`);
        if (k.seam > T.seam) failures.push(`${tag}: seam into "Our purpose" ${k.seam} levels, max ${T.seam} (R3)`);
        if (k.mbOff === null || k.mbOff > T.seam) failures.push(`${tag}: the first MissionBlock row is ${k.mbOff} levels off its computed background ${base.missionBg} (R3)`);
        for (const c of k.contrast) if (c.ratio < T.contrast) failures.push(`${tag}: ${c.name} contrast ${c.ratio}:1, min ${T.contrast}:1 (R4)`);
      }
      await ctx.close();
      // R5 autoplay: motion allowed, the clock drives the interval.
      if (!CALIBRATE && width === T.viewports[0][0] && dpr === T.viewports[0][1]) {
        const mctx = await browser.newContext({ viewport: { width, height: 1200 }, reducedMotion: 'no-preference' });
      await authorize(mctx, srv);
        const mp = await mctx.newPage();
        await mp.clock.install();
        await mp.goto(`${srv.origin}/`, { waitUntil: 'networkidle' });
        const current = () => mp.evaluate((DOTS) => [...document.querySelectorAll(DOTS)].findIndex((d) => d.getAttribute('aria-current') === 'true'), DOTS);
        const seen = [await current()];
        for (let s = 0; s < T.slides; s++) { await mp.clock.runFor(T.intervalMs); seen.push(await current()); }
        const want = [...Array(T.slides).keys(), 0];
        if (JSON.stringify(seen) !== JSON.stringify(want)) failures.push(`${mode} @${width}: autoplay visited ${JSON.stringify(seen.map((v) => v + 1))}, want ${JSON.stringify(want.map((v) => v + 1))} (R5)`);
        await mctx.close();
      }
    }
    // R6: no 2560 variant, so at 1280 DPR2 (2560 device px) sizes="100vw" must pick the largest candidate, and that must be >= 1920w.
    for (const [width, dpr] of T.largestAt) {
      const ctx = await browser.newContext({ viewport: { width, height: 1200 }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
      await authorize(ctx, srv);
      const page = await ctx.newPage();
      await page.goto(`${srv.origin}/`, { waitUntil: 'networkidle' });
      if (SIMULATE) await page.evaluate((SLIDES) => document.querySelectorAll(`${SLIDES} img`).forEach((img) => { img.srcset = img.srcset.replace(/q=75/g, 'q=88'); }), SLIDES);
      await page.waitForFunction((SLIDES) => { const img = document.querySelector(`${SLIDES} img`); return img && img.complete && img.naturalWidth > 0; }, SLIDES, { timeout: 60_000 });
      const pick = await page.evaluate((SLIDES) => { const img = document.querySelector(`${SLIDES} img`); return { src: img.currentSrc, sizes: img.sizes, widths: img.srcset.split(',').map((c) => Number(c.trim().split(/\s+/)[1].replace('w', ''))) }; }, SLIDES);
      let w = null; try { w = Number(new URL(pick.src).searchParams.get('w')); } catch { /* reported below */ }
      const largest = Math.max(...pick.widths);
      report.push({ at: `${mode} @${width}x${dpr}`, largestCandidate: largest, picked: w, sizes: pick.sizes });
      if (!CALIBRATE) {
        if (largest < T.minLargestWidth) failures.push(`${mode} @${width}x${dpr}: the largest hero candidate is ${largest}w, want >= ${T.minLargestWidth}w (R6)`);
        if (w !== largest || pick.sizes !== '100vw') failures.push(`${mode} @${width}x${dpr}: picked w=${w} with sizes ${JSON.stringify(pick.sizes)}, want the largest candidate (${largest}w) under sizes 100vw (R6)`);
      }
      await ctx.close();
    }
    // R7 kink, in the alpha domain where it is exact: the pull layer's computed stops (alpha, px from the bottom) give the chord slope of
    // every segment; the slope above the top stop is 0. A joint's kink is the change of slope across it. Every joint at or above
    // kinkZone px must change the slope by <= kinkInterior x BASE's join kink (BASE: 0 -> 1/72 = 0.0139/px at 72px), and the top stop
    // (the join, Codi's criterion) by <= kinkRatio x it. The 8-bit render cannot resolve a 10% slope change row by row (a vertical gradient paints whole rows one level apart), so the
    // render is held to the stops instead: the pull alone over a black field (slides, copy, diagonal and veil hidden) must match
    // parchment x alpha(y) within profileTol levels on every row of the bottom kinkBand px.
    for (const [width, dpr] of T.kinkViewports) {
      const vp = `${width}x${dpr}`;
      const ctx = await browser.newContext({ viewport: { width, height: 1200 }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
      await authorize(ctx, srv);
      const page = await ctx.newPage();
      await page.goto(`${srv.origin}/`, { waitUntil: 'networkidle' });
      if (SIMULATE) await page.addStyleTag({ content: SIM_CSS });
      const bg = await page.evaluate((HERO) => getComputedStyle(document.querySelector(`${HERO} > [data-hero-scrim='bone']`)).backgroundImage, HERO);
      const stops = [...bg.matchAll(/rgba?\(([^)]*)\)\s+(-?[\d.]+)px/g)].map((m) => { const c = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { a: c.length > 3 ? c[3] : 1, at: Number(m[2]), rgb: c.slice(0, 3) }; });
      if (!/^linear-gradient\(to top,/.test(bg) || stops.length < 2) { failures.push(`${mode} @${vp}: cannot read the pull's stops from ${JSON.stringify(bg.slice(0, 120))} (R7)`); await ctx.close(); continue; }
      const seg = stops.slice(1).map((q, k) => (stops[k].a - q.a) / (q.at - stops[k].at));
      const joints = stops.slice(1).map((q, k) => ({ at: q.at, kink: Math.abs((k + 1 < seg.length ? seg[k + 1] : 0) - seg[k]) }));
      const zone = joints.filter((j) => j.at >= T.kinkZone);
      const worst = zone.reduce((m, j) => (j.kink > m.kink ? j : m), { at: null, kink: 0 });
      const alphaAt = (d) => { if (d <= stops[0].at) return stops[0].a; for (let k = 1; k < stops.length; k++) if (d <= stops[k].at) return stops[k - 1].a + ((stops[k].a - stops[k - 1].a) * (d - stops[k - 1].at)) / (stops[k].at - stops[k - 1].at); return 0; };
      await page.addStyleTag({ content: `${HERO}{background:#000 !important}${SLIDES},${COPY},${HERO} > [data-hero-scrim='diagonal'],${HERO} > [data-hero-scrim='veil']{visibility:hidden !important}` });
      const { hero } = await info(page);
      const shot = await page.screenshot({ clip: { x: 0, y: hero.y + hero.h - T.kinkBand, width: hero.w, height: T.kinkBand }, animations: 'disabled', caret: 'hide' });
      const { data: kd, info: ki } = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const ground = stops[0].rgb.reduce((t, v) => t + v, 0) / 3;
      let off = 0; let offAt = 0;
      for (let y = 0; y < ki.height - T.profileSkip * dpr; y++) {
        let t = 0; for (let x = 0; x < ki.width; x++) { const k = (y * ki.width + x) * 3; t += kd[k] + kd[k + 1] + kd[k + 2]; }
        const d = T.kinkBand - (y + 0.5) / dpr;
        const e = Math.abs(t / (3 * ki.width) - ground * alphaAt(d));
        if (e > off) { off = e; offAt = d; }
      }
      report.push({ at: `${mode} @${vp}`, top: stops[stops.length - 1].at, joinKink: Number((joints[joints.length - 1].kink / T.kinkBase).toFixed(3)), worstKink: Number((worst.kink / T.kinkBase).toFixed(3)), worstAt: worst.at, profileOff: Number(off.toFixed(2)), profileOffAt: Number(offAt.toFixed(1)) });
      if (!CALIBRATE) {
        const join = joints[joints.length - 1];
        if (join.kink > T.kinkRatio * T.kinkBase) failures.push(`${mode} @${vp}: the pull's slope jumps by ${(join.kink / T.kinkBase).toFixed(3)} x BASE's at its top (${join.at}px), max ${T.kinkRatio} (R7)`);
        if (worst.kink > T.kinkInterior * T.kinkBase) failures.push(`${mode} @${vp}: the pull's slope changes by ${(worst.kink / T.kinkBase).toFixed(3)} x BASE's join kink at ${worst.at}px, max ${T.kinkInterior} for a joint below the top (R7)`);
        if (off > T.profileTol) failures.push(`${mode} @${vp}: the rendered pull is ${off.toFixed(2)} levels off its stops at ${offAt.toFixed(1)}px above the hero's bottom, max ${T.profileTol} (R7)`);
      }
      await ctx.close();
    }
  } catch (e) {
    failures.push(`${mode}: render error: ${e && e.message ? e.message : e}`);
  } finally {
    await browser.close();
    await srv.stop();
  }
}

if (CALIBRATE) {
  for (const f of failures) console.error(`calibration: ${f}`);
  process.stdout.write(`${JSON.stringify({ recorded: `${SIMULATE ? 'golden fix simulated on ' : ''}BASE, unfiltered (yellow kept)`, report }, null, 1)}\n`);
  process.exit(failures.length ? 1 : 0);
}
if (measured === 0 && failures.length === 0) failures.push('nothing measured (INFRA)');
if (process.argv.includes('--report')) process.stderr.write(`${JSON.stringify(report)}\n`);
finish(NAME, failures, `${measured} slide captures (${MODES.join('/')}, ${T.viewports.map(([w, d]) => `${w}x${d}`).join(' ')}): q=${T.quality}, band step <= ${T.rowStep} smoothed / ${T.rawStep} raw, source >= ${T.sourceBpp} bpp, no seam, copy >= ${T.contrast}:1, ${T.slides} slides/dots/labels and autoplay 1-${T.slides}.`);
