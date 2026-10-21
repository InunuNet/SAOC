// nos-critique-r12 f5 rendered: REGRESSION GUARD (lead ruling 2026-10-18; no app change). QA input, hash-locked.
// Codi's report (both art-directed lockups at <=700: {1080, 828, 750}) reproduces only when a page loaded at 1280 DPR 2 is resized to 405 —
// standard <picture> re-selection (the iframe/device-toggle resize). Every fresh load is clean at 26fde668 (f5-spec.md); this guards that it stays so.
// Extends nos-critique-r9 f1-rendered (one header + one footer lockup request) to real device emulation and the art-direction edges.
//   Contexts (fresh each, public mode, production build, Chromium): 390 as a phone (isMobile + hasTouch, DPR 1/2/3), 405 as a phone at DPR 2 (Codi's
//   width), 1280 desktop (DPR 1/2), and the breakpoint edges 699/700/701 (DPR 1 and 2). Routes: /national-show and /national-show/tickets (both wear the NOS chrome).
//   After a full scroll and network idle, per context:
//     - exactly ONE header lockup request (full-colour) and exactly ONE footer lockup request (reversed); never an original /images/nos/*.png;
//     - art direction: header narrow file (<=699) or wide file (>=700); footer vertical (<=700) or horizontal (>=701) — the other variant is NEVER requested;
//     - the request is the file the browser displays (currentSrc), so nothing was fetched and discarded;
//     - r9's 2x cap: the displayed candidate is >= 2x its CSS box and no srcset entry exceeds the cap (header 1080 / narrow 828, footer 1080 / vertical 750).
//   Lockup bytes per context are printed as REPORT lines, never failed (r9's 80KB DPR-1 budget is unchanged and stays r9's).
import { existsSync } from 'node:fs';
import path from 'node:path';

import { FEATURES, finish, golden, repoRoot, specDir } from './_lib.mjs';
import { AUTH, assertFreshBuild, require, startServer } from './_server.mjs';

const playwright = require('playwright');
// Chromium only (lead 2026-10-18). WebKit's <img src> fallback is a logged post-launch investigation (f5-spec.md), not part of the gate.
const ENGINES = ['chromium'];
const NAME = 'f5-rendered.mjs';
const ROUTES = ['/national-show', '/national-show/tickets'];
const PHONE = { isMobile: true, hasTouch: true };
const CONTEXTS = [
  ...[1, 2, 3].map((dpr) => ({ width: 390, dpr, ...PHONE })),
  { width: 405, dpr: 2, ...PHONE },
  ...[1, 2].map((dpr) => ({ width: 1280, dpr })),
  ...[699, 700, 701].flatMap((width) => [1, 2].map((dpr) => ({ width, dpr }))),
];
const LOCKUP = /nos-(full-colour|reversed)/i;
const CAP = { headerWide: 1080, headerNarrow: 828, footerH: 1080, footerV: 750 };
const decode = (u) => { try { return decodeURIComponent(u); } catch { return u; } };
const isOriginalPng = (u) => /\/images\/nos\/[^?]*\.png(\?|$)/i.test(decode(u)) && !/_opt|url=/.test(decode(u));
const isVertical = (u) => /vertical/i.test(decode(u));
// The header art-directs with (max-width: 699px); which file is "narrow" is read from the rendered <source>, not assumed.
const failures = [];
const report = [];

let browser;
let srv;
try {
  const sourceFiles = [...new Set(FEATURES.filter((n) => existsSync(path.join(specDir, 'goldens', `f${n}-footprint.json`))).flatMap((n) => JSON.parse(golden(`f${n}-footprint.json`))))].filter((rel) => existsSync(path.join(repoRoot, rel)));
  if (!process.env.NOS_CR12_ORIGIN) {
    const stale = assertFreshBuild(sourceFiles);
    if (stale.length > 0) finish(NAME, stale);
  }
  srv = process.env.NOS_CR12_ORIGIN ? { origin: process.env.NOS_CR12_ORIGIN, stop: () => {} } : await startServer({ publicMode: true });
  for (const engine of ENGINES) {
  if (browser) await browser.close();
  browser = await playwright[engine].launch(engine === 'chromium' ? { args: ['--hide-scrollbars'] } : {});
  for (const route of ROUTES) for (const c of CONTEXTS) {
    const tag = `${engine} ${route} @${c.width} DPR${c.dpr}${c.isMobile ? ' phone' : ''}`;
    const ctx = await browser.newContext({ viewport: { width: c.width, height: c.isMobile ? 844 : 900 }, deviceScaleFactor: c.dpr, isMobile: !!c.isMobile, hasTouch: !!c.hasTouch, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    // Every lockup request the page issues (preload scanner included), counted on the request, not the response, so a fetch the browser later
    // abandons still counts. Bytes come from Playwright's per-request sizes, so the same code runs on Chromium and WebKit.
    const reqs = new Map();
    page.on('request', (req) => { if (LOCKUP.test(decode(req.url()))) reqs.set(req, { url: req.url(), bytes: null }); });
    page.on('requestfinished', async (req) => { const r = reqs.get(req); if (r) { try { r.bytes = (await req.sizes()).responseBodySize; } catch { r.bytes = 0; } } });
    const res = await page.goto(`${srv.origin}${route}`, { waitUntil: 'load' });
    if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); await ctx.close(); continue; }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    try {
      await page.waitForFunction(() => { const i = document.querySelector('.nf-lockup img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 });
    } catch { failures.push(`${tag}: the footer lockup never loaded after scrolling`); }
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const one = (sel) => { const i = document.querySelector(sel); if (!i) return null; const r = i.getBoundingClientRect(); return { src: i.currentSrc, w: r.width, srcset: i.getAttribute('srcset') || '' }; };
      const srcset = (sel) => { const s = document.querySelector(sel); return s ? s.getAttribute('srcset') || '' : ''; };
      return { header: one('.nh-brand img'), footer: one('.nf-lockup img'), headerSource: srcset('.nh-brand picture source'), footerSource: srcset('.nf-lockup picture source'), vw: window.innerWidth };
    });
    const all = [...reqs.values()];
    const head = all.filter((r) => /full-colour/i.test(decode(r.url)));
    const foot = all.filter((r) => /reversed/i.test(decode(r.url)));
    if (m.vw !== c.width) failures.push(`${tag}: layout viewport is ${m.vw}px, want ${c.width}px (the page must declare a device-width viewport)`);
    if (head.length !== 1 || foot.length !== 1) failures.push(`${tag}: want 1 header + 1 footer lockup request, got ${head.length} + ${foot.length} (${all.map((r) => decode(r.url).replace(/^.*\//, '')).join(' | ')})`);
    for (const r of all) if (isOriginalPng(r.url)) failures.push(`${tag}: the original PNG was fetched (${decode(r.url)})`);
    if (!m.header || !m.footer) { failures.push(`${tag}: header or footer lockup img missing`); await ctx.close(); continue; }
    const narrow = c.width <= 699;
    const vertical = c.width <= 700;
    const inSet = (url, set) => set.split(',').some((p) => decode(p.trim().split(/\s+/)[0]).replace(/^.*\//, '') === decode(url).replace(/^.*\//, '').replace(/\?.*$/, ''));
    // Header: the displayed file must come from the <source> srcset at <=699 and from the img srcset at >=700, and it must be the one request.
    // At DPR 1 both header srcsets start with the same 640 file, so art direction is only observable where the candidates differ.
    const ambiguous = inSet(m.header.src, m.headerSource) && inSet(m.header.src, m.header.srcset);
    if (!ambiguous && narrow !== inSet(m.header.src, m.headerSource)) failures.push(`${tag}: header shows ${decode(m.header.src).replace(/^.*\//, '')}, want the ${narrow ? 'narrow (<source>)' : 'wide (<img>)'} candidate`);
    if (vertical !== isVertical(m.footer.src)) failures.push(`${tag}: footer shows ${decode(m.footer.src).replace(/^.*\//, '')}, want the ${vertical ? 'vertical' : 'horizontal'} lockup`);
    for (const [who, r, shown] of [['header', head[0], m.header], ['footer', foot[0], m.footer]]) {
      if (r && decode(r.url).replace(/\?.*$/, '').replace(/^.*\//, '') !== decode(shown.src).replace(/\?.*$/, '').replace(/^.*\//, '')) failures.push(`${tag}: ${who} requested ${decode(r.url).replace(/^.*\//, '')} but displays ${decode(shown.src).replace(/^.*\//, '')}`);
      const w = Number((decode(shown.src).match(/-(\d+)\.webp/) ?? [])[1]);
      if (c.dpr >= 2 && w && w < Math.round(shown.w * 2) - 1) failures.push(`${tag}: ${who} shows ${w}w for a ${shown.w.toFixed(1)}px box, want >= 2x`);
    }
    for (const [set, cap, who] of [[m.header.srcset, CAP.headerWide, 'header <img>'], [m.headerSource, CAP.headerNarrow, 'header <source>'], [m.footer.srcset, CAP.footerH, 'footer <img>'], [m.footerSource, CAP.footerV, 'footer <source>']]) {
      for (const part of set.split(',').map((x) => x.trim()).filter(Boolean)) {
        const cw = Number((decode(part).match(/-(\d+)\.webp/) ?? [])[1]);
        if (cw > cap) failures.push(`${tag}: ${who} srcset offers ${cw}w, cap ${cap}w (r9)`);
      }
    }
    report.push(`${tag}: ${all.reduce((a, r) => a + (r.bytes ?? 0), 0)} lockup bytes (${all.map((r) => `${decode(r.url).replace(/^.*\//, '').replace(/\?.*$/, '')} ${r.bytes}`).join(', ')})`);
    await ctx.close();
  }
  }
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  if (srv) await srv.stop();
  if (browser) await browser.close();
}

for (const line of report) console.log(`REPORT ${line}`);
finish(NAME, failures, `on ${ROUTES.length} NOS routes, at 390 as a phone (DPR 1/2/3), 405 as a phone (DPR 2), 1280 (DPR 1/2) and 699/700/701 (DPR 1/2), each page requests exactly one header and one footer lockup, the art-directed one it displays, within r9's 2x cap.`);
