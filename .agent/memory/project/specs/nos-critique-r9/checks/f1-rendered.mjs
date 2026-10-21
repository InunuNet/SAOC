// nos-critique-r9 f1 rendered (production build, next start 3010-3019, public mode): lockup image delivery on /national-show.
//   widths 1280, 701, 700, 390 - fresh context each, DPR 1. Before scrolling only the header lockup may be requested (the footer is lazy and below the fold).
//   After scrolling to the bottom: exactly ONE footer lockup request (horizontal above 700, vertical at <=700), exactly two lockup requests in all, no original .png fetched.
//   Bytes = CDP encodedDataLength per lockup response (body length as the fallback); the total must be <= 80,000.
//   Same look: displayed boxes within 1px of the r8 baseline (1280 and 390), intrinsic aspect ratios, no upscaling, alt, width/height attributes.
//   DPR 2 and 3 at 1280 and 390 (Codi FINAL): the selected candidate width (-NNN.webp in currentSrc) is >= 2x the CSS box and DPR 3 selects the SAME file as DPR 2 (2x cap);
//   no srcset candidate exceeds the cap (header 1080 wide / 828 narrow, footer horizontal 1080, vertical 750). Bytes at DPR 2 and 3 are printed, never failed.
//   Header eager + fetchpriority high; footer lazy + async + no fetchpriority; no layout shift sourced inside .nh-brand or .nf-lockup.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import { finish, repoRoot } from './_lib.mjs';
import { AUTH } from './_server.mjs';
import { F1_PATHS, openMode } from './r9-lib.mjs';

const NAME = 'f1-rendered.mjs';
const failures = [];
const sourceFiles = [...F1_PATHS].filter((rel) => existsSync(path.join(repoRoot, rel)));
const ROUTE = '/national-show';
const BUDGET = 80000;
const ALT = 'National Orchid Show, Western Cape 2027';
const LOCKUP = /nos-(full-colour|reversed)/i;
const H_RATIO = 1200 / 294;
const V_RATIO = 900 / 791;
// CSS boxes measured on the r8 build (goldens/f1-baseline.json); delivery changes must not move them.
const WIDTHS = [
  { width: 1280, vertical: false, header: [448, 109.75], footer: [448, 109.75] },
  { width: 701, vertical: false },
  { width: 700, vertical: true },
  { width: 390, vertical: true, header: [390, 95.55], footer: [342, 300.58] },
];

const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const decode = (u) => { try { return decodeURIComponent(u); } catch { return u; } };
const isLockup = (u) => LOCKUP.test(decode(u));
const isOriginalPng = (u) => /\/images\/nos\/[^?]*\.png(\?|$)/i.test(decode(u)) && !/_opt|url=/.test(decode(u));

const probe = () => {
  const box = (el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; };
  const info = (img) => img && ({
    ...box(img), src: img.currentSrc, nw: img.naturalWidth, nh: img.naturalHeight, complete: img.complete,
    alt: img.getAttribute('alt'), wAttr: img.getAttribute('width'), hAttr: img.getAttribute('height'),
    loading: img.getAttribute('loading'), decoding: img.getAttribute('decoding'), fp: img.getAttribute('fetchpriority'),
    display: getComputedStyle(img).display,
  });
  const header = document.querySelector('.nh-brand img');
  const footImgs = [...document.querySelectorAll('.nf-lockup img')];
  const footer = footImgs.find((i) => getComputedStyle(i).display !== 'none') ?? footImgs[0];
  const source = document.querySelector('.nf-lockup picture source');
  return {
    header: info(header),
    footer: info(footer),
    nFooterImgs: footImgs.length,
    nPictures: document.querySelectorAll('.nf-lockup picture').length,
    source: source && { media: source.getAttribute('media'), w: source.getAttribute('width'), h: source.getAttribute('height'), active: window.matchMedia(source.getAttribute('media')).matches },
    sh: document.documentElement.scrollHeight, vh: window.innerHeight,
  };
};

const report = [];
let browser;
let handle;
try {
  browser = await chromium.launch({ args: ['--hide-scrollbars'] });
  handle = await openMode('public', sourceFiles);
  if (handle.stale) finish(NAME, handle.stale);
  for (const spec of WIDTHS) {
    const { width } = spec;
    const tag = `${ROUTE} @${width}`;
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__nosShifts = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          const inside = (e.sources ?? []).some((s) => s.node && s.node.parentElement && s.node.parentElement.closest && s.node.parentElement.closest('.nh-brand, .nf-lockup'));
          if (inside && e.value > 0) window.__nosShifts.push(e.value);
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    const reqs = new Map();
    cdp.on('Network.responseReceived', (e) => { if (e.type === 'Image' || isLockup(e.response.url)) reqs.set(e.requestId, { url: e.response.url, bytes: null }); });
    cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
    const lockups = () => [...reqs.values()].filter((r) => isLockup(r.url));

    const res = await page.goto(`${handle.origin}${ROUTE}`, { waitUntil: 'load' });
    if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); await ctx.close(); continue; }
    await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
    await page.waitForTimeout(400);
    const before = await page.evaluate(probe);
    if (before.sh < before.vh * 3) failures.push(`${tag}: page is only ${before.sh}px tall; the lazy footer cannot be proven below the fold`);
    const early = lockups();
    if (early.length !== 1 || !/full-colour/i.test(decode(early[0].url))) failures.push(`${tag}: before scrolling want exactly the header lockup, got ${early.map((r) => decode(r.url)).join(' | ') || 'none'}`);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    try {
      await page.waitForFunction(() => { const i = [...document.querySelectorAll('.nf-lockup img')].find((x) => getComputedStyle(x).display !== 'none'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 });
    } catch { failures.push(`${tag}: the footer lockup never loaded after scrolling to the bottom`); }
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    const m = await page.evaluate(probe);
    const shifts = await page.evaluate(() => window.__nosShifts);

    const all = lockups();
    const foot = all.filter((r) => /reversed/i.test(decode(r.url)));
    const head = all.filter((r) => /full-colour/i.test(decode(r.url)));
    if (all.length !== 2 || head.length !== 1 || foot.length !== 1) failures.push(`${tag}: want 1 header + 1 footer lockup request, got ${head.length} + ${foot.length} (${all.map((r) => decode(r.url)).join(' | ')})`);
    for (const r of all) if (isOriginalPng(r.url)) failures.push(`${tag}: the original PNG was fetched (${decode(r.url)}); delivery must use the optimised candidates`);
    if (foot[0] && (spec.vertical ? !/vertical/i.test(decode(foot[0].url)) : !/horizontal/i.test(decode(foot[0].url)))) failures.push(`${tag}: footer fetched ${decode(foot[0].url)}, want the ${spec.vertical ? 'vertical' : 'horizontal'} lockup`);
    const bytes = all.reduce((s, r) => s + (r.bytes ?? 0), 0);
    if (all.some((r) => r.bytes === null)) failures.push(`${tag}: a lockup response never finished`);
    if (bytes > BUDGET) failures.push(`${tag}: lockup bytes ${bytes}, budget ${BUDGET} (baseline 537176)`);

    const { header: h, footer: f } = m;
    if (!h || !f) { failures.push(`${tag}: header or footer lockup img missing`); await ctx.close(); continue; }
    if (m.nPictures !== 1 || m.nFooterImgs !== 1) failures.push(`${tag}: footer wants one <picture> with one <img>, found ${m.nPictures} picture(s) and ${m.nFooterImgs} img(s)`);
    if (m.source && m.source.active !== spec.vertical) failures.push(`${tag}: the (max-width: 700px) source is ${m.source.active ? 'active' : 'inactive'}, want ${spec.vertical ? 'active' : 'inactive'}`);
    if (!m.source || m.source.media !== '(max-width: 700px)' || m.source.w !== '900' || m.source.h !== '791') failures.push(`${tag}: footer <source> wants media (max-width: 700px) with width 900 height 791, got ${JSON.stringify(m.source)}`);
    for (const [who, i, ratio] of [['header', h, H_RATIO], [`footer(${spec.vertical ? 'vertical' : 'horizontal'})`, f, spec.vertical ? V_RATIO : H_RATIO]]) {
      if (i.alt !== ALT) failures.push(`${tag}: ${who} alt "${i.alt}", want "${ALT}"`);
      // An img carries one width/height pair; when the media <source> is active the browser reserves space from the source's pair, so read that one.
      const viaSource = i === f && m.source && m.source.active;
      const wAttr = viaSource ? m.source.w : i.wAttr;
      const hAttr = viaSource ? m.source.h : i.hAttr;
      if (!wAttr || !hAttr) failures.push(`${tag}: ${who} lacks width/height attributes (CLS)`);
      else if (!near(wAttr / hAttr, ratio, ratio * 0.005)) failures.push(`${tag}: ${who} width/height attributes ${wAttr}x${hAttr} change the aspect ratio`);
      if (!near(i.nw / i.nh, ratio, ratio * 0.01)) failures.push(`${tag}: ${who} selected image ${i.nw}x${i.nh} is not the lockup aspect`);
      if (i.nw + 1 < i.w) failures.push(`${tag}: ${who} image is upscaled (natural ${i.nw}px for a ${i.w.toFixed(1)}px box); pick a candidate at least as wide as the display`);
      if (i.w > 0 && !near(i.nw, i.w, i.w * 2.5)) failures.push(`${tag}: ${who} image ${i.nw}px for a ${i.w.toFixed(1)}px box is far oversized`);
    }
    if (h.loading === 'lazy') failures.push(`${tag}: header lockup must be eager, got loading=lazy`);
    if (h.fp !== 'high') failures.push(`${tag}: header lockup fetchpriority ${h.fp}, want high`);
    if (f.loading !== 'lazy') failures.push(`${tag}: footer lockup loading ${f.loading}, want lazy`);
    if (f.decoding !== 'async') failures.push(`${tag}: footer lockup decoding ${f.decoding}, want async`);
    if (f.fp !== null) failures.push(`${tag}: footer lockup fetchpriority ${f.fp}, want none`);
    if (spec.header && !(near(h.w, spec.header[0]) && near(h.h, spec.header[1]))) failures.push(`${tag}: header box ${h.w.toFixed(2)}x${h.h.toFixed(2)}, want ${spec.header.join('x')} (same look)`);
    if (spec.footer && !(near(f.w, spec.footer[0]) && near(f.h, spec.footer[1]))) failures.push(`${tag}: footer box ${f.w.toFixed(2)}x${f.h.toFixed(2)}, want ${spec.footer.join('x')} (same look)`);
    if (shifts.length) failures.push(`${tag}: layout shift ${shifts.reduce((a, b) => a + b, 0).toFixed(4)} sourced in the lockups, want none`);
    await ctx.close();
  }
  // DPR 2 sharpness (Codi condition): at 1280 and 390 each lockup's selected candidate must be at least 2x its CSS box wide. Bytes are REPORTED, not budgeted.
  const picked = {};
  for (const [dpr, width] of [[2, 1280], [2, 390], [3, 1280], [3, 390]]) {
    const tag = `${ROUTE} @${width} DPR${dpr}`;
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: dpr, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    const reqs = new Map();
    cdp.on('Network.responseReceived', (e) => { if (isLockup(e.response.url)) reqs.set(e.requestId, { url: e.response.url, bytes: null }); });
    cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
    const res = await page.goto(`${handle.origin}${ROUTE}`, { waitUntil: 'load' });
    if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); await ctx.close(); continue; }
    await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    try {
      await page.waitForFunction(() => { const i = [...document.querySelectorAll('.nf-lockup img')].find((x) => getComputedStyle(x).display !== 'none'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 });
    } catch { failures.push(`${tag}: the footer lockup never loaded after scrolling`); }
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    const m = await page.evaluate(probe);
    const all = [...reqs.values()];
    const total = all.reduce((a, r) => a + (r.bytes ?? 0), 0);
    if (all.length !== 2) failures.push(`${tag}: want 2 lockup requests, got ${all.length}`);
    report.push(`DPR${dpr} @${width}: ${total} lockup bytes in ${all.length} requests (${all.map((r) => `${/vertical/i.test(decode(r.url)) ? 'footer-vertical' : /reversed/i.test(decode(r.url)) ? 'footer-horizontal' : 'header'} ${r.bytes}`).join(', ')}; the 80000 budget applies at DPR 1 only)`);
    const srcsets = await page.evaluate(() => [...document.querySelectorAll('.nh-brand img, .nh-brand source, .nf-lockup img, .nf-lockup source')].map((e) => ({ tag: e.tagName, header: !!e.closest('.nh-brand'), srcset: e.getAttribute('srcset') || '' })));
    for (const e of srcsets) {
      const cap = e.header ? (e.tag === 'SOURCE' ? 828 : 1080) : (e.tag === 'SOURCE' ? 750 : 1080);
      for (const part of e.srcset.split(',').map((x) => x.trim()).filter(Boolean)) {
        const cw = Number((decode(part).match(/-(\d+)\.webp/) ?? [])[1]);
        if (cw > cap) failures.push(`${tag}: ${e.header ? 'header' : 'footer'} <${e.tag.toLowerCase()}> srcset offers ${cw}w, the cap is ${cap}w (smallest candidate >= 2x its box)`);
      }
    }
    for (const [who, i] of [['header', m.header], ['footer', m.footer]]) {
      if (!i) { failures.push(`${tag}: ${who} lockup img missing`); continue; }
      const url = decode(i.src);
      const w = Number((url.match(/-(\d+)\.webp/) ?? url.match(/[?&]w=(\d+)/) ?? [])[1]) || i.nw;
      if (w < Math.round(i.w * 2) - 1) failures.push(`${tag}: ${who} candidate is ${w}w for a ${i.w.toFixed(1)}px box, want at least ${Math.round(i.w * 2)}w (2x) so the lockup stays sharp (${url})`);
      report.push(`DPR${dpr} @${width} ${who}: ${w}w selected for a ${i.w.toFixed(1)}px box`);
      if (dpr === 2) picked[`${width}-${who}`] = w;
      else if (picked[`${width}-${who}`] !== w) failures.push(`${tag}: ${who} selects ${w}w at DPR 3 but ${picked[`${width}-${who}`]}w at DPR 2; the 2x cap means DPR 3 must pick the same file`);
    }
    await ctx.close();
  }
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  if (handle) await handle.stop();
  if (browser) await browser.close();
}

for (const line of report) console.log(`REPORT ${line}`);
finish(NAME, failures, 'at 1280, 701, 700 and 390 a fresh /national-show load requests only the header lockup, then exactly one footer lockup after scrolling, <=80KB in all, no original PNG, same boxes, ratios and alt, header eager+high, footer lazy+async, no lockup layout shift; at DPR 2 and 3 (1280, 390) each selected candidate is >= 2x its box, capped so DPR 3 picks the DPR 2 file, with the bytes printed as REPORT lines.');
