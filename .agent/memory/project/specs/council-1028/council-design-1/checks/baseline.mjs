// council-design-1 baselines: measured ONCE on the post-wave main (the saoc-design-consistency wave merged, before any council-design-1 edit) by
//   node --env-file-if-exists=.env.local .agent/memory/project/specs/council-1028/council-design-1/checks/baseline.mjs capture
// and committed as goldens/baseline-post-wave.json. It is a measurement, not an expectation: it freezes (a) the SAOC header heights and part widths
// at six viewports and (b) the computed text style of every NOS element that carries `font-mono` / `mono-label` today (NOS reskins that class to
// Karla through nos-theme.css), so retiring the class on the SAOC side provably changes nothing on the NOS host.
//   baseline.mjs header   -> A: header height identical, brand/nav/cta/search widths within 1px, Menu button within +12px, one row
//   baseline.mjs nos      -> B: every recorded NOS element computes the same family-first/size/weight/tracking/transform/line-height
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { withSite, openPage, check, finish, nosBaseFor } from './council-lib.mjs';

const FILE = '.agent/memory/project/specs/council-1028/council-design-1/goldens/baseline-post-wave.json';
const HEADER_WIDTHS = [390, 768, 1100, 1280, 1366, 1440];
const NOS_ROUTES = ['/', '/what-to-expect', '/faq', '/tickets', '/vendors', '/vendors/apply', '/exhibitors', '/about', '/contact'];
const PARTS = ['brand', 'nav', 'cta', 'search', 'menu'];
const MENU_GROWTH_PX = 12;
const mode = process.argv[2];

const HEADER_PROBE = `() => { const h = document.querySelector('header'); const bar = document.querySelector('[data-hd=bar]'); const o = { header: h.getBoundingClientRect().height, bar: bar ? bar.getBoundingClientRect().height : null, parts: {} };
  for (const p of ${JSON.stringify(PARTS)}) { const e = document.querySelector('[data-hd=' + p + ']'); const r = e ? e.getBoundingClientRect() : null; o.parts[p] = r && r.width > 0 ? { w: r.width, h: r.height } : null; } return o; }`;
const NOS_RECORD = `() => { const props = ['fontSize', 'fontWeight', 'letterSpacing', 'textTransform', 'lineHeight']; const own = (e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\\s+/g, ' ').trim().slice(0, 60);
  const out = []; for (const e of document.querySelectorAll('.nos-theme .font-mono, .nos-theme .mono-label, .font-mono, .mono-label')) { if (e.closest('footer')) continue; const t = own(e); if (!t) continue; const r = e.getBoundingClientRect(); if (r.width === 0) continue;
    const c = getComputedStyle(e); out.push({ t, fam: c.fontFamily.split(',')[0].replace(/["']/g, ''), s: props.map((p) => c[p]) }); } return out; }`;
const NOS_LOOKUP = `(rec) => { const props = ['fontSize', 'fontWeight', 'letterSpacing', 'textTransform', 'lineHeight']; const own = (e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\\s+/g, ' ').trim().slice(0, 60);
  const all = [...document.querySelectorAll('body *')].filter((e) => !e.closest('footer') && !e.closest('script,style') && e.getBoundingClientRect().width > 0); const used = new Map(); const res = [];
  for (const x of rec) { const n = used.get(x.t) ?? 0; const hits = all.filter((e) => own(e) === x.t); const e = hits[n]; used.set(x.t, n + 1); if (!e) { res.push({ t: x.t, missing: true }); continue; }
    const c = getComputedStyle(e); res.push({ t: x.t, fam: c.fontFamily.split(',')[0].replace(/["']/g, ''), s: props.map((p) => c[p]), want: x }); } return res; }`;

await withSite(async (site) => {
  const { base, browser, ctxOpts } = site; const nos = nosBaseFor(base);
  if (mode === 'capture') {
    const sha = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(); const out = { capturedAt: new Date().toISOString().slice(0, 10), gitSha: sha, header: {}, nos: {} };
    for (const w of HEADER_WIDTHS) { const { page, ctx } = await openPage(browser, ctxOpts, base, '/about', w, 900); out.header[w] = await page.evaluate(`(${HEADER_PROBE})()`); await ctx.close(); }
    if (nos) for (const path of NOS_ROUTES) { const { page, ctx, status } = await openPage(browser, ctxOpts, nos, path, 1440, 900); if (status === 200) out.nos[path] = await page.evaluate(`(${NOS_RECORD})()`); await ctx.close(); }
    writeFileSync(FILE, JSON.stringify(out, null, 1)); console.log(`captured ${FILE}: header ${Object.keys(out.header).length} widths, nos ${Object.values(out.nos).reduce((a, b) => a + b.length, 0)} elements on ${Object.keys(out.nos).length} routes`); return;
  }
  check(existsSync(FILE), `${FILE} does not exist: @dev step 0 captures it on the post-wave main BEFORE any edit (see this file's header)`);
  if (!existsSync(FILE)) return; const B = JSON.parse(readFileSync(FILE, 'utf8'));
  if (mode === 'header') for (const w of HEADER_WIDTHS) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, '/about', w, 900); const now = await page.evaluate(`(${HEADER_PROBE})()`); const was = B.header[w]; const t = `@${w}`;
    check(Math.abs(now.header - was.header) <= 0.5, `${t}: header height ${now.header} vs baseline ${was.header}`);
    if (was.bar !== null) check(now.bar !== null && Math.abs(now.bar - was.bar) <= 0.5, `${t}: header bar height ${now.bar} vs baseline ${was.bar}`);
    for (const p of PARTS) { const a = now.parts[p]; const b = was.parts[p]; if (!b) { check(!a, `${t}: ${p} appears but was absent in the baseline`); continue; } if (!a) { check(false, `${t}: ${p} disappeared`); continue; }
      const grow = p === 'menu' ? MENU_GROWTH_PX : 1; check(a.w - b.w <= grow && b.w - a.w <= (p === 'menu' ? 1 : 1), `${t}: ${p} width ${a.w.toFixed(1)} vs baseline ${b.w.toFixed(1)} (allowed +${grow}/-1)`); check(Math.abs(a.h - b.h) <= 0.5 || p === 'menu', `${t}: ${p} height ${a.h} vs ${b.h}`); }
    await ctx.close();
  }
  if (mode === 'nos') {
    check(Object.keys(B.nos).length > 0, 'baseline carries no NOS elements: it was captured without a NOS origin (set COUNCIL_NOS_BASE or use the saoc.localhost build)');
    for (const [path, rec] of Object.entries(B.nos)) { const { page, ctx } = await openPage(browser, ctxOpts, nos, path, 1440, 900); const rows = await page.evaluate(`(${NOS_LOOKUP})(${JSON.stringify(rec)})`);
      for (const r of rows) { if (r.missing) { check(false, `NOS ${path}: "${r.t}" no longer renders (or its own text changed)`); continue; } check(r.fam === r.want.fam && r.s.join('|') === r.want.s.join('|'), `NOS ${path}: "${r.t}" now ${r.fam} ${r.s.join('/')} vs baseline ${r.want.fam} ${r.want.s.join('/')}`); }
      await ctx.close(); }
  }
});
if (mode !== 'capture') finish(`baseline-${mode}`);
