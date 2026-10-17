// nos-critique-r6 F5 — rendered check for R80 #1 on the production build (next start, 3010-3019, never 3002).
// Hub /national-show and the four photo inner heroes (plan-your-visit, symposium, programme, what-to-expect):
//  @390x844  ORDER   .nos-hero-media sits above the h1 (media top < h1 top), 240-300px tall, then h1 < lede < actions; 220-300px tall (the fold, not a fixed number, decides: Tickets ends at y<=828)
//            FOLD    hub only: the Tickets button (data-nos-hero-text="btn-primary-label") ends at y<=828 (16px clear of the 844 fold; Codi final), and the
//                    countdown and facts follow the Tickets button in that order
//            BLOOM   the shipped crop (computed object-position over the 390x300 box) keeps within 3 percentage points of the
//                    best possible crop's bloom mass, scored from goldens/bloom-marginals.json (written by measure-bloom.py)
//            LEDE    every hero lede below 768 is 18px / 27px (1.5) with max-width 60ch; at 768 and 1280 the BASE values are unchanged
//            VENDOR  /national-show/vendors/apply at 390x844: the first field (Business name label + input) is fully on screen one
//            SHOTS   screenshots of the hub, /national-show/about and /national-show/vendors/apply at 390 go to critique-r6-shots/f5-*.png
//            C4      no horizontal overflow
//  @768x1024 UNCHANGED  the media still comes after the copy (order 2) at the 4/3 aspect, i.e. the <768 rules do not leak
//  @1280x800 UNCHANGED  the hub media stays absolutely positioned behind the copy (no stacked layout)
// Run as: node check-rendered-f5.mjs   (NOS_CR6_ROOT selects the worktree)
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { finish, repoRoot, scopeFiles, specDir } from './_lib.mjs';
import { AUTH, assertFreshBuild, require, startServer } from './_server.mjs';

const NAME = 'check-rendered-f5.mjs';
const failures = [];
const { chromium } = require('playwright');
const bloom = JSON.parse(readFileSync(path.join(specDir, 'goldens', 'bloom-marginals.json'), 'utf8')).images;
const SHOT_ROUTES = ['/national-show', '/national-show/about', '/national-show/vendors/apply'];
const BASE_LEDE = { // computed at BASE (hub clamp(1.3rem,1.1rem+0.8vw,1.625rem)/1.42, inner 1.25rem/1.6, theme clamp(22px,2vw,30px)/1.3)
  1280: { hub: [26, 36.92], inner: [20, 32], theme: [25.6, 33.28] },
  768: { hub: [23.74, 33.71], inner: [20, 32], theme: [22, 28.6] },
};
const ROUTES = ['/national-show', '/national-show/plan-your-visit', '/national-show/symposium', '/national-show/programme', '/national-show/what-to-expect'];
const TOLERANCE = 0.03;
const SHOTS = path.resolve(repoRoot, '..', 'critique-r6-shots');

const stale = assertFreshBuild(scopeFiles());
if (stale.length > 0) finish(NAME, stale);

const ledeInfo = () => [...document.querySelectorAll('[data-nos-hero-lede]')].map((el) => {
  const cs = getComputedStyle(el);
  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;visibility:hidden;width:60ch;font:${cs.font};letter-spacing:${cs.letterSpacing}`;
  document.body.appendChild(probe); const w60 = probe.getBoundingClientRect().width; probe.remove();
  const hero = el.closest('[data-nos-hero]');
  return { kind: el.getAttribute('data-nos-lede') === 'theme' ? 'theme' : hero?.getAttribute('data-nos-hero') === 'hub' ? 'hub' : 'inner', size: parseFloat(cs.fontSize), lh: parseFloat(cs.lineHeight), maxW: cs.maxWidth === 'none' ? Infinity : parseFloat(cs.maxWidth), w60 };
});

const grab = () => {
  const hero = document.querySelector('[data-nos-hero]');
  const media = hero?.querySelector('.nos-hero-media');
  const img = media?.querySelector('img');
  const y = (el) => (el ? el.getBoundingClientRect().top + window.scrollY : null);
  const bottom = (el) => (el ? el.getBoundingClientRect().bottom + window.scrollY : null);
  const btn = hero?.querySelector('[data-nos-hero-text="btn-primary-label"]')?.closest('a,button');
  const countdown = hero?.querySelector('[data-nos-hero-text="countdown-opens-in"]');
  const facts = hero?.querySelector('.nos-hero-facts');
  const mr = media?.getBoundingClientRect();
  return {
    kind: hero?.getAttribute('data-nos-hero'),
    mediaTop: y(media), mediaH: mr?.height ?? null, mediaW: mr?.width ?? null,
    mediaPos: media ? getComputedStyle(media).position : null, mediaOrder: media ? getComputedStyle(media).order : null,
    h1: y(hero?.querySelector('h1')), lede: y(hero?.querySelector('[data-nos-hero-lede]')),
    btnTop: y(btn), btnBottom: bottom(btn), countdown: y(countdown), facts: y(facts),
    src: img ? decodeURIComponent(img.getAttribute('src') ?? '') : '', objectPosition: img ? getComputedStyle(img).objectPosition : '',
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
};

/** Fraction of bloom mass visible in the window [a, b] (0-1 of the cropped axis). */
const visibleMass = (bins, a, b) => bins.reduce((sum, v, i) => {
  const lo = i / bins.length; const hi = (i + 1) / bins.length;
  const overlap = Math.max(0, Math.min(hi, b) - Math.max(lo, a));
  return sum + (v * overlap) / (hi - lo);
}, 0);

function scoreCrop(photo, boxW, boxH, objectPosition) {
  const iw = photo.width; const ih = photo.height;
  const scale = Math.max(boxW / iw, boxH / ih);
  const sw = iw * scale; const sh = ih * scale;
  const [px, py] = objectPosition.split(' ').map((t, i) => (t.endsWith('%') ? parseFloat(t) / 100 : parseFloat(t) / Math.max(1, (i === 0 ? boxW - sw : boxH - sh))));
  const cropsX = sw - boxW > 0.5;
  const bins = cropsX ? photo.cols : photo.rows;
  const full = cropsX ? sw : sh; const view = cropsX ? boxW : boxH;
  const at = (p) => { const off = (full - view) * p; return visibleMass(bins, off / full, (off + view) / full); };
  let best = 0; for (let p = 0; p <= 100; p += 1) best = Math.max(best, at(p / 100));
  return { got: at(cropsX ? px : py), best, axis: cropsX ? 'x' : 'y' };
}

// Hero LCP (moved here from f4, lead 2026-10-17): the hero <img> is fetchpriority=high, not lazy, preloaded, and the LCP element.
const lcpReport = async () => {
  const img = document.querySelector('.nos-hero-media img');
  const lcp = await new Promise((resolve) => {
    let last = null;
    new PerformanceObserver((l) => { last = l.getEntries().at(-1) ?? last; }).observe({ type: 'largest-contentful-paint', buffered: true });
    setTimeout(() => resolve(last), 600);
  });
  const srcset = (img?.getAttribute('srcset') ?? '').split(',')[0].trim().split(' ')[0];
  const preload = [...document.querySelectorAll('link[rel="preload"][as="image"]')].some((l) => (l.getAttribute('imagesrcset') ?? '').includes(srcset.split('?')[0].split('url=')[1] ?? '\u0000') || (l.getAttribute('imagesrcset') ?? '').includes(srcset));
  return { has: !!img, fetchpriority: img?.getAttribute('fetchpriority'), loading: img?.getAttribute('loading'), preload, lcpIsHero: !!(lcp && lcp.element && lcp.element === img) };
};

let browser;
let stop = () => {};
try {
  const srv = await startServer();
  stop = srv.stop;
  browser = await chromium.launch();
  const ctx = async (w, h) => browser.newContext({ viewport: { width: w, height: h }, extraHTTPHeaders: { authorization: AUTH } });

  const c390 = await ctx(390, 844); const p390 = await c390.newPage();
  for (const route of ROUTES) {
    const tag = `${route} @390x844`;
    const res = await p390.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); continue; }
    const g = await p390.evaluate(grab);
    if (g.mediaTop === null) { failures.push(`${tag}: no .nos-hero-media`); continue; }
    if (!(g.mediaTop < g.h1)) failures.push(`${tag}: the photograph (top ${g.mediaTop}) must sit above the h1 (top ${g.h1})`);
    if (g.kind !== 'hub' && !(g.mediaH > 219.5 && g.mediaH < 220.5)) failures.push(`${tag}: inner hero photograph ${g.mediaH}px tall, want exactly 220px (Codi, 2026-10-17)`);
    else if (g.kind === 'hub' && (g.mediaH < 219.5 || g.mediaH > 300.5)) failures.push(`${tag}: photograph ${g.mediaH}px tall, want 220-300px (aim for 300; the Tickets fold trims it, floor 220)`);
    if (g.lede !== null && !(g.h1 < g.lede)) failures.push(`${tag}: h1 must come before the lede`);
    if (g.kind === 'hub') {
      if (g.btnBottom === null) failures.push(`${tag}: Tickets button not found`);
      else if (g.btnBottom > 828) failures.push(`${tag}: Tickets button ends at y=${Math.round(g.btnBottom)}, must end at y<=828 (16px clear of the 844px fold)`);
      else if (g.mediaH < 299.5 && g.btnBottom + (300 - g.mediaH) <= 828) failures.push(`${tag}: photograph is ${g.mediaH}px but the Tickets button would still end at y<=828 at 300px; after f9 (the 46px utility bar is gone) the photo aims for 300`);
      if (g.btnTop !== null && g.countdown !== null && !(g.btnTop < g.countdown)) failures.push(`${tag}: countdown must follow the Tickets button`);
      if (g.countdown !== null && g.facts !== null && !(g.countdown < g.facts)) failures.push(`${tag}: facts must follow the countdown`);
    }
    const name = (g.src.match(/orchid-[a-z]+/) ?? [])[0];
    if (!name || !bloom[name]) failures.push(`${tag}: could not identify the hero photograph from "${g.src}"`);
    else {
      const s = scoreCrop(bloom[name], g.mediaW, g.mediaH, g.objectPosition);
      if (s.got < s.best - TOLERANCE) failures.push(`${tag}: ${name} crop keeps ${(s.got * 100).toFixed(1)}% of the bloom mass on the ${s.axis} axis, best possible ${(s.best * 100).toFixed(1)}% (object-position ${g.objectPosition}); measure and set it`);
    }
    if (g.sw > g.cw) failures.push(`${tag}: horizontal overflow ${g.sw} > ${g.cw}`);
  }
  for (const route of ['/national-show/about', '/national-show/vendors/apply']) {
    const tag = `${route} @390x844`;
    await p390.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
    for (const l of await p390.evaluate(ledeInfo)) {
      if (l.size !== 18 || Math.abs(l.lh - 27) > 0.6) failures.push(`${tag}: lede ${l.size}px / ${l.lh}px, want 18px / 27px (1.5)`);
      if (Math.abs(l.maxW - l.w60) > 1.5) failures.push(`${tag}: lede max-width ${l.maxW}px, want 60ch (${Math.round(l.w60)}px)`);
    }
    if (route.endsWith('/vendors/apply')) {
      const f = await p390.evaluate(() => { const lab = document.querySelector('label[for="vendor-register-businessName"]'); const inp = document.getElementById('vendor-register-businessName'); return lab && inp ? { top: lab.getBoundingClientRect().top + scrollY, bottom: inp.getBoundingClientRect().bottom + scrollY } : null; });
      if (!f) failures.push(`${tag}: Business name field not found`);
      else if (f.bottom > 844) failures.push(`${tag}: Business name label + input end at y=${Math.round(f.bottom)}, the first field must be fully on screen one (<= 844)`);
    }
  }
  for (const route of SHOT_ROUTES) {
    await p390.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
    mkdirSync(SHOTS, { recursive: true });
    await p390.screenshot({ path: path.join(SHOTS, `f5-${route.split('/').filter(Boolean).slice(1).join('-') || 'hub'}-390.png`) });
  }
  await p390.close();
  await c390.close();

  const c768 = await ctx(768, 1024); const p768 = await c768.newPage();
  for (const route of ROUTES) {
    await p768.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
    const g = await p768.evaluate(grab);
    if (g.mediaTop === null) continue;
    if (route === '/national-show' || g.kind === 'inner') {
      const l768 = await p768.evaluate(ledeInfo);
      for (const l of l768) { const want = BASE_LEDE[768][l.kind]; if (want && (Math.abs(l.size - want[0]) > 0.6 || Math.abs(l.lh - want[1]) > 0.8)) failures.push(`${route} @768: ${l.kind} lede ${l.size}px/${l.lh}px, want BASE ${want[0]}px/${want[1]}px (>=768 unchanged)`); }
    }
    if (g.mediaOrder !== '2') failures.push(`${route} @768: media order ${g.mediaOrder}, want 2 (the <768 rules must not leak to 768-1023)`);
    if (Math.abs(g.mediaH - g.mediaW * 0.75) > 3) failures.push(`${route} @768: media ${g.mediaW}x${g.mediaH} is not 4/3`);
  }
  await c768.close();

  const c1280 = await ctx(1280, 800); const p1280 = await c1280.newPage();
  for (const route of ['/national-show', '/national-show/plan-your-visit', '/national-show/symposium']) {
    await p1280.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
    for (const l of await p1280.evaluate(ledeInfo)) { const want = BASE_LEDE[1280][l.kind]; if (want && (Math.abs(l.size - want[0]) > 0.6 || Math.abs(l.lh - want[1]) > 0.8)) failures.push(`${route} @1280: ${l.kind} lede ${l.size}px/${l.lh}px, want BASE ${want[0]}px/${want[1]}px (>=768 unchanged)`); }
  }
  await p1280.goto(`${srv.origin}/national-show`, { waitUntil: 'networkidle' });
  const hub = await p1280.evaluate(grab);
  if (hub.mediaPos !== 'absolute') failures.push(`/national-show @1280: media position ${hub.mediaPos}, want absolute (desktop hero unchanged)`);
  await c1280.close();
  for (const w of [390, 1280]) {
    const c = await ctx(w, w === 390 ? 844 : 800); const pg = await c.newPage();
    for (const route of ROUTES) {
      const tag = `${route} @${w} LCP`;
      const r = await pg.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
      if (!r || r.status() !== 200) continue;
      const l = await pg.evaluate(lcpReport);
      if (!l.has) { failures.push(`${tag}: no hero <img> in .nos-hero-media`); continue; }
      if (l.fetchpriority !== 'high') failures.push(`${tag}: hero image fetchpriority=${l.fetchpriority}, want high`);
      if (l.loading === 'lazy') failures.push(`${tag}: hero image is lazy-loaded`);
      if (!l.preload) failures.push(`${tag}: no <link rel=preload as=image> for the hero image`);
      if (!l.lcpIsHero) failures.push(`${tag}: the largest-contentful-paint element is not the hero image`);
    }
    await c.close();
  }
} catch (err) {
  failures.push(`${err.name}: ${err.message}`);
} finally {
  if (browser) await browser.close();
  stop();
}
finish(NAME, failures, 'R80 #1 rendered: at 390x844 the photograph leads at 300px on the hub and the four photo heroes, Tickets is above the fold, bloom crops are within 3 points of optimal, 768 and 1280 layouts unchanged, no overflow.');
