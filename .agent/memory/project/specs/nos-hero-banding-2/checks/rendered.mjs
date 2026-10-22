// nos-hero-banding-2 (rHB2) F1 rendered check (QA input, hash-locked; @dev must not edit). Fresh PUBLIC and PREVIEW production builds
// of the checkout against the live Sanity dataset, no hero filter (every slide Sanity serves: 4 on beta, 2026-10-22), next start on
// 3010-3019 minus 3013/3016. Viewports: goldens/pull.json `viewports` (Codi's 1280@1, 2056@2, 390@3, plus Brad's 2000@1 and 2560@1 for
// the clamp's ceiling). Every slide is made active by its dot (reduced motion). Goldens: pull.css (the rule), base-pull.css (c6702259's
// rule, injected for the no-worse comparisons), pull.json (thresholds and the calibration behind them).
//   P1  NO LINE OVER THE PHOTO (Brad's case): the hero with its copy hidden, cut into 16 CSS px column blocks; per block the CIE L*
//       profile from (pull height + 16) CSS px above the seam to 8 px below it; slope = mean L* change per CSS px over a 4 CSS px
//       window; kink(y) = |slope(window below y) - slope(window above y)|. A Mach line runs the full width, so the MEDIAN over blocks is
//       taken at each row (photo texture is local and drops out of the median; row means, the rHB metric, cannot see a slope break at
//       all). max over rows of that median <= `coherentKink` L* per CSS px. Zero-slope arrival (Codi): the block-median |slope| over the
//       last 4 CSS px above the seam <= `seamSlope` L* per CSS px.
//   P2  seam: the last hero row and the first MissionBlock row (row means) differ by <= `seam` per channel, and that row equals
//       MissionBlock's computed background within `seam`.
//   P3  CODI'S PROFILE TEST, the pull alone: slides, veil, diagonal and copy hidden, the hero ground each flat `grounds` colour (the
//       hero's own --primary and slide 3's dark under the veil; pure black is P4's ground only: near L* 0 the CIE curve inflates a
//       4px slope ratio the eye cannot see, 0.27 there against 0.19 on the real grounds for the golden); the column
//       L* profile (all columns averaged, so 8-bit dither drops out) over (pull height + 8) px above the seam to 8 below; slope over
//       4 CSS px windows; no adjacent-window slope change > `slopeJump` x the profile's peak slope, the seam and the top included (C1 at
//       both ends and every joint, Codi); |slope| over the last 4 px above the seam <= `seamSlope`.
//   P4  the pull's own profile: over `profileGround` (black), every row within `profileTol` levels (any channel) of parchment x alpha(d),
//       alpha the golden stops at d / H, H = clamp(126px, 9vw, 220px) at that viewport; below the seam exactly parchment (+-1).
//   P5  copy contrast: rHB R4 unchanged (eyebrow, h1, h1 em, lede, secondary CTA, pause; ink vs the lightest backdrop pixel next to
//       the glyphs) >= `contrast`, and per element and slide no more than `dropTol` under the same page with base-pull.css injected.
//   P6  pager dots (rPL dots.mjs method): each dot's bar against the hero rows `dotPad` + 2 px above and below it, >= `dotMin` (or,
//       where c6702259 is already under it, >= c6702259's value), and per dot and slide no more than `dropTol` under base-pull.css.
//   P7  slides: >= `minSlides`, dots == slides, both builds serve the same count.
// Artefacts for Codi (always written): .tmp/sandbox/nos-hero-banding-2/shots/<mode>-<w>x<dpr>-s<k>.png (copy visible) and
// profiles/<mode>-<w>x<dpr>-s<k>.csv (CSS px above the seam, block-median L*, block-median slope, isolated-pull L* over each ground).
// --simulate injects goldens/pull.css (calibration on BASE); --calibrate prints every number and asserts nothing; --report prints the
// per-capture numbers on an asserting run too. --guard is the regression guard (Codi): it injects base-pull.css (c6702259) on the
// PREVIEW build at `guard.viewport` and measures only the `guard.asset` slide (slide 3 of 4 on beta); it PASSES only when P1 and P3
// both FAIL there, i.e. the check still sees Brad's banding.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { finish, golden, goldenJson } from './_lib.mjs';
import { WINDOW, decode, fullWidthKink, pullProfile, r2, rowMeans } from './_metrics.mjs';
import { MODES, authorize, launchOptions, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'rendered.mjs';
const T = goldenJson('pull.json');
const CALIBRATE = process.argv.includes('--calibrate');
const SIMULATE = process.argv.includes('--simulate');
const GUARD = process.argv.includes('--guard');
const REPORT = CALIBRATE || process.argv.includes('--report');
const GOLDEN_CSS = golden('pull.css');
// The BASE rule, plus the background-* longhands the golden adds, reset to their initial values.
const BASE_CSS = golden('base-pull.css').replace(/\}\s*$/, '  background-size: auto;\n  background-position: 0% 0%;\n  background-repeat: repeat;\n}\n');
const HERO = 'section[aria-roledescription="carousel"]';
const SLIDES = `${HERO} > [aria-roledescription="slide"]`;
const DOTS = `${HERO} [aria-label="Carousel navigation"] button`;
const COPY = `${HERO} > div.z-10`;
const MISSION = `${HERO} + section`;
const BELOW = 8;
const GLYPH = 24;
const GROW = 2;
const OUT = path.resolve('.tmp/sandbox/nos-hero-banding-2');
mkdirSync(path.join(OUT, 'shots'), { recursive: true });
mkdirSync(path.join(OUT, 'profiles'), { recursive: true });
const failures = [];
const report = [];
const slideCounts = {};
let measured = 0;

const rgba = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
const lum = (c) => { const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pullHeight = (vw) => Math.min(T.height.max, Math.max(T.height.min, vw * T.height.vw));
// alpha at d CSS px above the seam: the golden stops, linear between them (what the browser renders).
const alphaAt = (d, H) => {
  const p = Math.min(1, Math.max(0, d / H)) * 100;
  const s = T.stops;
  for (let k = 1; k < s.length; k++) if (p <= s[k].at) { const t = (p - s[k - 1].at) / (s[k].at - s[k - 1].at); return s[k - 1].alpha + t * (s[k].alpha - s[k - 1].alpha); }
  return 0;
};

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
  const dots = [...document.querySelectorAll(DOTS)].map((d) => { const bar = d.querySelector('span') ?? d; return { label: d.getAttribute('aria-label'), ...box(bar) }; });
  const slides = [...document.querySelectorAll(SLIDES)].map((g) => { const img = g.querySelector('img'); return { src: img ? img.currentSrc : null }; });
  const mission = document.querySelector(MISSION);
  return { hero: { x: r.left, y: r.top + scrollY, w: r.width, h: r.height }, vw: window.innerWidth, texts, dots, slides, missionBg: mission ? getComputedStyle(mission).backgroundColor : null };
}, { HERO, SLIDES, DOTS, COPY, MISSION });

async function activate(page, i) {
  await page.locator(DOTS).nth(i).click();
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(({ SLIDES, i }) => {
    const g = document.querySelectorAll(SLIDES)[i]; const img = g && g.querySelector('img');
    return g && !g.hasAttribute('aria-hidden') && img && img.complete && img.naturalWidth > 0 && getComputedStyle(g).opacity === '1';
  }, { SLIDES, i }, { timeout: 60_000 });
}

let styleSeq = 0;
async function withStyle(page, css, fn) {
  const id = String((styleSeq += 1));
  const h = await page.addStyleTag({ content: css });
  await h.evaluate((el, id) => el.setAttribute('data-hb2', id), id);
  try { return await fn(); } finally { await page.evaluate((id) => document.querySelectorAll(`style[data-hb2="${id}"]`).forEach((s) => s.remove()), id); }
}

/** Copy-visible and copy-hidden captures of the hero + BELOW px, with the contrast metrics (P5, P6). */
async function captures(page, m, dpr) {
  const clip = { x: 0, y: m.hero.y, width: m.hero.w, height: m.hero.h + BELOW };
  const shown = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
  const hidden = await withStyle(page, `${COPY}{visibility:hidden !important}`, () => page.screenshot({ clip, animations: 'disabled', caret: 'hide' }));
  const ink = await decode(shown); const bg = await decode(hidden);
  const W = bg.W; const heroRows = Math.round(m.hero.h * dpr);
  const contrast = {};
  for (const t of m.texts) {
    const pad = T.contentMargin;
    const x0 = Math.max(0, Math.floor((t.x - pad) * dpr)); const x1 = Math.min(W, Math.ceil((t.x + t.w + pad) * dpr));
    const y0 = Math.max(0, Math.floor((t.y - m.hero.y - pad) * dpr)); const y1 = Math.min(heroRows, Math.ceil((t.y - m.hero.y + t.h + pad) * dpr));
    const skip = (x, y) => t.exclude.some((e) => x >= (e.x - pad) * dpr && x < (e.x + e.w + pad) * dpr && y >= (e.y - m.hero.y - pad) * dpr && y < (e.y - m.hero.y + e.h + pad) * dpr);
    const changed = (x, y) => { const k = (y * W + x) * 3; return Math.max(Math.abs(ink.data[k] - bg.data[k]), Math.abs(ink.data[k + 1] - bg.data[k + 1]), Math.abs(ink.data[k + 2] - bg.data[k + 2])) > GLYPH; };
    const g = GROW * dpr;
    let worst = null; let worstL = -1;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (skip(x, y)) continue;
      let near = false;
      for (let dy = -g; dy <= g && !near; dy++) for (let dx = -g; dx <= g && !near; dx++) { const xx = x + dx; const yy = y + dy; if (xx >= x0 && xx < x1 && yy >= y0 && yy < y1 && changed(xx, yy)) near = true; }
      if (!near) continue;
      const k = (y * W + x) * 3; const c = { r: bg.data[k], g: bg.data[k + 1], b: bg.data[k + 2], a: 1 }; const l = lum(c);
      if (l > worstL) { worstL = l; worst = c; }
    }
    if (!worst) continue;
    const fill = rgba(t.bg); const ground = fill && fill.a > 0 ? over(fill, worst) : worst;
    const fg = rgba(t.color); const inkC = fg.a < 1 ? over(fg, ground) : fg;
    contrast[t.name] = r2(ratio(inkC, ground));
  }
  // rPL's dots.mjs method, on the same pixels: the box (bar.x - 2, bar.y - dotPad - 2, bar.w + 4, bar.h + 2 dotPad + 4) CSS px; its
  // first, middle and last device rows averaged over x from 2 dpr to width - 2 dpr; min(mid vs first, mid vs last).
  const dots = {};
  for (const d of m.dots) {
    const bx0 = Math.round(Math.max(0, d.x - 2) * dpr); const bw = Math.round((d.w + 4) * dpr);
    const by0 = Math.round((Math.max(0, d.y - T.dotPad - 2) - m.hero.y) * dpr); const bh = Math.round((d.h + 2 * T.dotPad + 4) * dpr);
    const x0 = bx0 + Math.round(2 * dpr); const x1 = bx0 + bw - Math.round(2 * dpr);
    const row = (y) => { const [c] = rowMeans(ink, by0 + y, by0 + y + 1, x0, x1); return { r: c[0], g: c[1], b: c[2], a: 1 }; };
    const mid = row(Math.floor(bh / 2)); const above = row(0); const below = row(bh - 1);
    dots[d.label] = r2(Math.min(ratio(mid, above), ratio(mid, below)));
  }
  return { shown, bg, heroRows, contrast, dots };
}

/** P1 and P2 on the copy-hidden capture. */
function photoMetrics(bg, heroRows, dpr, H, missionBg) {
  const q = fullWidthKink(bg, heroRows, dpr, H + 16, BELOW);
  const [last, first] = rowMeans(bg, heroRows - 1, heroRows + 1);
  const seam = Math.max(...last.map((v, c) => Math.abs(v - first[c])));
  const mb = rgba(missionBg ?? '');
  const mbOff = mb ? Math.max(Math.abs(first[0] - mb.r), Math.abs(first[1] - mb.g), Math.abs(first[2] - mb.b)) : null;
  return { ...q, seam: r2(seam), mbOff: mbOff === null ? null : r2(mbOff) };
}

/** P3 and P4: the pull alone over a flat ground. */
async function isolated(page, m, dpr, H, ground) {
  const css = `${SLIDES},${COPY},${HERO} > [data-hero-scrim='diagonal'],${HERO} > [data-hero-scrim='veil']{visibility:hidden !important}${HERO}{background:${ground} !important}`;
  const png = await withStyle(page, css, () => page.screenshot({ clip: { x: 0, y: m.hero.y, width: m.hero.w, height: m.hero.h + BELOW }, animations: 'disabled' }));
  const img = await decode(png); const heroRows = Math.round(m.hero.h * dpr);
  const q = pullProfile(img, heroRows, dpr, H + 8, BELOW);
  let off = 0; let offAt = 0;
  if (ground === T.profileGround) {
    const par = T.parchment;
    q.rows.forEach((c, i) => {
      const d = (heroRows - (q.top + i) - 0.5) / dpr;
      const want = d < 0 ? par : par.map((v) => v * alphaAt(d, H));
      const e = Math.max(...c.map((v, ch) => Math.abs(v - want[ch])));
      if (e > off) { off = e; offAt = d; }
    });
  }
  return { ...q, profileOff: r2(off), profileAt: r2(offAt) };
}

const RUN_MODES = GUARD ? ['preview'] : MODES;
const VIEWPORTS = GUARD ? [T.guard.viewport] : T.viewports;
for (const mode of RUN_MODES) {
  const srv = await serve(mode);
  if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
  const browser = await chromium.launch(launchOptions());
  try {
    for (const [width, dpr] of VIEWPORTS) {
      const at = `${mode} @${width}x${dpr}`;
      const ctx = await browser.newContext({ viewport: { width, height: T.viewportHeight }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
      await authorize(ctx, srv);
      const page = await ctx.newPage();
      page.setDefaultTimeout(60_000);
      const res = await page.goto(`${srv.origin}/`, { waitUntil: 'networkidle' });
      if (!res || res.status() !== 200) { failures.push(`${at}: HTTP ${res ? res.status() : 0}`); await ctx.close(); continue; }
      await page.evaluate(async () => { await document.fonts.ready; });
      if (SIMULATE) await page.addStyleTag({ content: GOLDEN_CSS });
      if (GUARD) await page.addStyleTag({ content: BASE_CSS });
      let m = await info(page);
      const n = m.slides.length;
      const H = pullHeight(m.vw);
      slideCounts[mode] = slideCounts[mode] ?? n;
      if (n < T.minSlides) failures.push(`${at}: ${n} slides, min ${T.minSlides} (P7)`);
      if (m.dots.length !== n) failures.push(`${at}: ${m.dots.length} dots for ${n} slides (P7)`);
      if (slideCounts[mode] !== n) failures.push(`${at}: ${n} slides, ${slideCounts[mode]} at the first viewport (P7)`);
      // P3/P4 once per viewport (the pull alone does not depend on the slide).
      const iso = {};
      for (const ground of [T.profileGround, ...T.grounds]) iso[ground] = await isolated(page, m, dpr, H, ground);
      for (const [ground, q] of Object.entries(iso)) {
        report.push({ at, ground, pullH: r2(H), jump: q.jump, jumpAt: q.jumpAt, peak: q.peak, seamSlope: q.seamSlope, profileOff: q.profileOff, profileAt: q.profileAt });
        if (CALIBRATE) continue;
        if (ground === T.profileGround) {
          if (q.profileOff > T.profileTol) failures.push(`${at} pull over ${ground}: ${q.profileOff} levels off parchment x the golden alpha at ${q.profileAt} CSS px above the seam (H ${r2(H)}px), max ${T.profileTol} (P4)`);
          continue;
        }
        if (q.jump > T.slopeJump) failures.push(`${at} pull over ${ground}: slope changes by ${q.jump} x its peak between adjacent ${WINDOW}px windows at ${q.jumpAt} CSS px above the seam, max ${T.slopeJump} (P3)`);
        if (q.seamSlope > T.seamSlope) failures.push(`${at} pull over ${ground}: arrives on parchment at ${q.seamSlope} L*/px, max ${T.seamSlope} (P3)`);
      }
      for (let i = 0; i < n; i++) {
        if (GUARD && !(m.slides[i].src ?? '').includes(`/production/${T.guard.asset}`)) continue;
        await activate(page, i);
        m = await info(page);
        const cand = await captures(page, m, dpr);
        const base = await withStyle(page, BASE_CSS, () => captures(page, m, dpr));
        const p = photoMetrics(cand.bg, cand.heroRows, dpr, H, m.missionBg);
        const pb = photoMetrics(base.bg, base.heroRows, dpr, H, m.missionBg);
        measured += 1;
        const asset = (m.slides[i].src ?? '').replace(/^.*\/production\/([0-9a-f]{8}).*$/, '$1');
        const tag = `${at} slide ${i + 1}/${n} ${asset}`;
        const stem = `${mode}-${width}x${dpr}-s${i + 1}`;
        writeFileSync(path.join(OUT, 'shots', `${stem}.png`), cand.shown);
        const csv = ['css_px_above_seam,block_median_lstar,block_median_slope_per_css_px,' + [T.profileGround, ...T.grounds].map((g) => `pull_alone_lstar_${g.replace('#', '')}`).join(',')];
        const k = Math.round(WINDOW * dpr);
        p.medL.forEach((L, j) => {
          const y = p.top + j; const d = (cand.heroRows - y - 0.5) / dpr;
          const sl = j + k < p.medL.length ? ((p.medL[j + k] - L) / k) * dpr : '';
          const isoL = [T.profileGround, ...T.grounds].map((g) => { const q = iso[g]; const jj = y - q.top; return jj >= 0 && jj < q.L.length ? q.L[jj].toFixed(2) : ''; });
          csv.push([d.toFixed(2), L.toFixed(2), sl === '' ? '' : sl.toFixed(3), ...isoL].join(','));
        });
        writeFileSync(path.join(OUT, 'profiles', `${stem}.csv`), `${csv.join('\n')}\n`);
        const minC = (o) => Math.min(...Object.values(o));
        report.push({ at, slide: i + 1, asset, coherentKink: p.coherentKink, kinkAt: p.kinkAt, seamSlope: p.seamSlope, baseKink: pb.coherentKink, baseSeamSlope: pb.seamSlope, seam: p.seam, mbOff: p.mbOff, copyMin: minC(cand.contrast), baseCopyMin: minC(base.contrast), dotMin: minC(cand.dots), baseDotMin: minC(base.dots) });
        if (CALIBRATE) continue;
        if (p.coherentKink > T.coherentKink) failures.push(`${tag}: a full-width slope break of ${p.coherentKink} L*/px at ${p.kinkAt} CSS px above the seam (block median), max ${T.coherentKink} (P1)`);
        if (p.seamSlope > T.seamSlope) failures.push(`${tag}: arrives on parchment at ${p.seamSlope} L*/px (block median, last ${WINDOW}px), max ${T.seamSlope} (P1)`);
        if (p.seam > T.seam) failures.push(`${tag}: seam into "Our purpose" ${p.seam} levels, max ${T.seam} (P2)`);
        if (p.mbOff === null || p.mbOff > T.seam) failures.push(`${tag}: the first MissionBlock row is ${p.mbOff} levels off its computed background ${m.missionBg} (P2)`);
        for (const [name, v] of Object.entries(cand.contrast)) {
          if (v < T.contrast) failures.push(`${tag}: ${name} contrast ${v}:1, min ${T.contrast}:1 (P5)`);
          if (name in base.contrast && base.contrast[name] - v > T.dropTol) failures.push(`${tag}: ${name} contrast ${v}:1, ${base.contrast[name]}:1 under the c6702259 pull (P5)`);
        }
        if (Object.keys(cand.dots).length !== n) failures.push(`${tag}: ${Object.keys(cand.dots).length} dot bars measured for ${n} slides (P6)`);
        for (const [label, v] of Object.entries(cand.dots)) {
          // Floor 3:1; where c6702259 itself is under 3:1 (pre-existing, reported), the floor is c6702259's value.
          const floor = Math.min(T.dotMin, base.dots[label] ?? T.dotMin);
          if (v < floor - T.dropTol) failures.push(`${tag}: pager "${label}" ${v}:1, min ${r2(floor)}:1 (P6)`);
          if (label in base.dots && base.dots[label] - v > T.dropTol) failures.push(`${tag}: pager "${label}" ${v}:1, ${base.dots[label]}:1 under the c6702259 pull (P6)`);
        }
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
    await srv.stop();
  }
}
if (GUARD) {
  const hit = (code) => failures.some((f) => f.includes(code));
  const ok = measured === 1 && hit('(P1)') && hit('(P3)');
  if (REPORT) for (const r of report) console.error(JSON.stringify(r));
  if (!ok) { console.error(`FAIL: ${NAME} --guard: c6702259's pull on preview ${T.guard.viewport.join('x')} slide ${T.guard.asset} was not caught by both P1 and P3 (${measured} captures):\n  - ${failures.join('\n  - ') || 'no failures at all'}`); process.exit(1); }
  console.log(`PASS: ${NAME} --guard: c6702259's pull still fails on preview ${T.guard.viewport.join('x')} slide ${T.guard.asset} (${failures.length} findings, P1 and P3 among them).`);
  process.exit(0);
}
const counts = Object.values(slideCounts);
if (!CALIBRATE && counts.length === MODES.length && new Set(counts).size !== 1) failures.push(`slide counts differ between builds: ${JSON.stringify(slideCounts)} (P7)`);
const expected = MODES.length * T.viewports.length * T.minSlides;
if (!CALIBRATE && measured < expected) failures.push(`${measured} slide captures, expected at least ${expected} (INFRA)`);
writeFileSync(path.join(OUT, `report${SIMULATE ? '-simulate' : ''}.json`), `${JSON.stringify(report, null, 1)}\n`);
if (REPORT) for (const r of report) console.error(JSON.stringify(r));
if (CALIBRATE) { console.log(`CALIBRATE: ${measured} slide captures${SIMULATE ? ' (golden injected)' : ''}; numbers in ${path.join(OUT, `report${SIMULATE ? "-simulate" : ""}.json`)}`); process.exit(0); }
finish(NAME, failures, `${measured} slide captures (${MODES.join('/')}, ${T.viewports.map(([w, d]) => `${w}x${d}`).join(' ')}): full-width slope break <= ${T.coherentKink} L*/px, seam slope <= ${T.seamSlope}, pull slope jump <= ${T.slopeJump} of peak per ${WINDOW}px, pull within ${T.profileTol} of the golden, seam <= ${T.seam}, copy >= ${T.contrast}:1, dots >= ${T.dotMin}:1, both no more than ${T.dropTol} under c6702259.`);
