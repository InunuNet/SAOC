// nos-critique-r6 F1 — rendered check for R65 (body text 16px / 1.55) on the production build of the worktree.
// Starts `next start` on 3010-3019 (never 3002) and, at 375 and 1280, on every NOS content route except the hub and
// tickets (lead's side):
//   ROOT   the .nos-theme element computes --fs-body = 1rem, font-size 16px and line-height 24.8px (1.55)
//   PROSE  every visible p / li / td / dd / address / .pc-clip with >= 40 characters (outside header, nav, footer, hero,
//          status markers, captions and headers; not uppercase / tracked-caps labels; not link-only) is
//          >= 16px; a sans (Karla) one is never 17px; one at 16px has line-height 1.55 (24.8px, +-0.2px)
//   ROUTES enumerated at runtime from the app/(marketing)/national-show page.tsx tree (a new route cannot escape); dynamic segments are resolved
//          from the links on their parent page. Excluded ONLY: F18-owned tickets, workshops and conferences (and /tickets), the [...slug] not-found catch-all (f2), plus the vendor
//          form routes register/payment/photos (token-gated); vendors/apply IS measured (its intro is prose, 16px/1.55, lead 2026-10-17).
//   CHIPS  the R52 FAQ chips stay 14px labels
//   PRESENTERS  on /symposium .pc-clip and .pc-jump-link, when present, compute 16px
//   C4     no horizontal overflow
// Requires a current build. Run as: node check-rendered.mjs   (NOS_CR6_ROOT selects the worktree)
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { finish, NS, repoRoot, scopeFiles } from './_lib.mjs';
import { AUTH, assertFreshBuild, require, startServer } from './_server.mjs';

const NAME = 'check-rendered.mjs';
const failures = [];
const { chromium } = require('playwright');
const SHOTS = path.resolve(repoRoot, '..', 'critique-r6-shots');
const EXCLUDED_SEGMENTS = new Set(['tickets', 'workshops', 'conferences']);
const EXCLUDED_ROUTES = new Set(['/national-show/vendors/register', '/national-show/vendors/payment', '/national-show/vendors/photos']);
/** Every route under national-show (the page.tsx tree); routes with a dynamic segment keep their [pattern]. */
function enumerateRoutes() {
  const root = path.join(repoRoot, NS);
  const out = [];
  const walkDir = (dir, segs) => {
    for (const name of readdirSync(dir)) {
      const abs = path.join(dir, name);
      if (statSync(abs).isDirectory()) walkDir(abs, name.startsWith('(') ? segs : [...segs, name]);
      else if (name === 'page.tsx') out.push(['national-show', ...segs]);
    }
  };
  walkDir(root, []);
  return out.filter((segs) => !segs.some((x) => EXCLUDED_SEGMENTS.has(x) || x.startsWith('[...')) && !EXCLUDED_ROUTES.has('/' + segs.join('/'))).map((segs) => '/' + segs.join('/'));
}
async function resolveRoutes(origin) {
  const found = [];
  for (const pattern of enumerateRoutes()) {
    if (!pattern.includes('[')) { found.push(pattern); continue; }
    const parent = pattern.slice(0, pattern.indexOf('/['));
    const res = await fetch(origin + parent, { headers: { authorization: AUTH } }).catch(() => null);
    const html = res && res.ok ? await res.text() : '';
    const m = html.match(new RegExp('href="(' + parent.split('/').join('\\/') + '\\/[^"\\/]+)"'));
    let hit = m ? m[1] : null;
    for (const y of hit ? [] : ['2024', '2021', '2018']) {
      const r = await fetch(origin + parent + '/' + y, { headers: { authorization: AUTH } }).catch(() => null);
      if (r && r.status === 200) { hit = parent + '/' + y; break; }
    }
    if (hit) found.push(hit);
    else if (pattern.includes('/archive/[')) console.log('VACUOUS: no published editions, ' + pattern + ' skipped (the archive index lists no years; its route file is asserted statically by check-static-f2)');
    else failures.push(pattern + ': no link to a live instance on ' + parent + '; the dynamic route cannot be measured');
  }
  return found;
}
const MUST_MEASURE = new Set(['/national-show/about', '/national-show/what-to-expect', '/national-show/faq', '/national-show/exhibitors', '/national-show/sponsors', '/national-show/symposium', '/national-show/wosa-conference']);
const MIN_ROUTES = 14; // a vacuous enumeration (wrong directory, empty tree) must fail
const VIEWPORTS = [{ width: 375, height: 812 }, { width: 1280, height: 800 }];

const stale = assertFreshBuild(scopeFiles());
if (stale.length > 0) finish(NAME, stale);

const measure = () => {
  const root = document.querySelector('.nos-theme');
  const rcs = root ? getComputedStyle(root) : null;
  const main = document.querySelector('main') || document.body;
  const EXCLUDE = 'header, nav, footer, [data-nos-hero], [data-confirmation-badge], [data-exhibitor-marker], caption, th, figcaption';
  const BLOCK = 'div, p, ul, ol, details, article, section, dl, figure, table';
  const linkOnly = (el) => {
    const total = el.textContent.replace(/\s+/g, '').length;
    const inLinks = [...el.querySelectorAll('a')].reduce((n, a) => n + a.textContent.replace(/\s+/g, '').length, 0);
    return total > 0 && inLinks >= total;
  };
  const els = [...main.querySelectorAll('p, li, td, dd, address, .pc-clip')].filter((el) => el.offsetParent !== null
    && el.textContent.trim().length >= 40
    && !el.closest(EXCLUDE)
    && !(el.tagName === 'LI' && el.querySelector(BLOCK))
    && !linkOnly(el));
  const prose = els.map((el) => {
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
    const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);
    const lh = cs.lineHeight === 'normal' ? NaN : parseFloat(cs.lineHeight);
    return { text: el.textContent.trim().slice(0, 40), tag: el.tagName, size, lhPx: lh, ratio: lh / size, sans: /karla/i.test(cs.fontFamily), label: cs.textTransform === 'uppercase' || ls / size >= 0.08 };
  }).filter((p) => !p.label);
  const sans17 = [...main.querySelectorAll('*')].filter((el) => el.offsetParent !== null && el.children.length === 0 && el.textContent.trim().length > 0 && !el.closest('header, nav, footer') && parseFloat(getComputedStyle(el).fontSize) === 17 && /karla/i.test(getComputedStyle(el).fontFamily)).map((el) => el.textContent.trim().slice(0, 40));
  const chip = document.querySelector('nav[aria-label="FAQ categories"] a');
  const notes = [...main.querySelectorAll('[role="note"]')].filter((el) => el.offsetParent !== null && el.textContent.trim().length >= 40 && !el.closest('header, nav, footer, [data-nos-hero]')).map((el) => { const cs = getComputedStyle(el); return { text: el.textContent.trim().slice(0, 40), size: parseFloat(cs.fontSize), lhPx: parseFloat(cs.lineHeight) }; });
  const pcs = [...document.querySelectorAll('.pc-clip, .pc-jump-link')].map((el) => ({ cls: el.className, size: parseFloat(getComputedStyle(el).fontSize) }));
  return {
    root: rcs ? { fsBody: rcs.getPropertyValue('--fs-body').trim(), size: parseFloat(rcs.fontSize), lh: parseFloat(rcs.lineHeight), } : null,
    prose, sans17, notes,
    chip: chip ? parseFloat(getComputedStyle(chip).fontSize) : null,
    pcs,
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
};

const rows = [];
let browser;
let stop = () => {};
try {
  const srv = await startServer();
  const ROUTES = await resolveRoutes(srv.origin);
  if (ROUTES.length < MIN_ROUTES) failures.push('only ' + ROUTES.length + ' NOS routes enumerated (' + ROUTES.join(', ') + '); expected at least ' + MIN_ROUTES);
  stop = srv.stop;
  mkdirSync(SHOTS, { recursive: true });
  browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    for (const route of ROUTES) {
      const tag = `${route} @${vp.width}`;
      const res = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
      if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); continue; }
      const m = await page.evaluate(measure);
      if (!m.root) { failures.push(`${tag}: no .nos-theme element`); continue; }
      if (m.root.fsBody !== '1rem') failures.push(`${tag}: --fs-body computes ${JSON.stringify(m.root.fsBody)}, want "1rem"`);
      if (m.root.size !== 16) failures.push(`${tag}: .nos-theme font-size ${m.root.size}px, want 16px`);
      if (Math.abs(m.root.lh - 24.8) > 0.2) failures.push(`${tag}: .nos-theme line-height ${m.root.lh}px, want 24.8px (1.55)`);
      if (MUST_MEASURE.has(route) && m.prose.length === 0) failures.push(`${tag}: no prose measured; the check would be vacuous`);
      // /workshops: the ticket list (components/tickets) is off limits and keeps its own sizes, so only the page's own note is measured there.
      const own = route.endsWith('/workshops') ? [] : m.prose;
      if (route.endsWith('/workshops')) {
        if (m.notes.length === 0) failures.push(`${tag}: the sessions note ([role="note"]) was not found`);
        for (const n of m.notes) if (n.size !== 16 || Math.abs(n.lhPx - 24.8) > 0.2) failures.push(`${tag}: sessions note ${n.size}px / ${n.lhPx}px, want 16px / 24.8px ("${n.text}")`);
      }
      for (const p of own) {
        if (p.size < 15.99) failures.push(`${tag}: prose ${p.size}px < 16px ("${p.text}")`);
        if (p.sans && p.size === 17) failures.push(`${tag}: sans prose at 17px ("${p.text}")`);
        if (p.sans && Math.abs(p.size - 16) < 0.01 && Math.abs(p.lhPx - 24.8) > 0.2) failures.push(`${tag}: 16px prose line-height ${p.lhPx}px (${p.ratio.toFixed(3)}), want 24.8px (1.55) ("${p.text}")`);
      }
      for (const t of route.endsWith('/workshops') ? [] : m.sans17) failures.push(`${tag}: Karla text computed at 17px ("${t}")`);
      if (route.endsWith('/faq') && m.chip !== 14) failures.push(`${tag}: FAQ chip ${m.chip}px, R52 keeps 14px labels`);
      for (const c of m.pcs) if (c.size !== 16) failures.push(`${tag}: ${c.cls} computes ${c.size}px, want 16px`);
      if (m.sw > m.cw) failures.push(`${tag}: horizontal overflow ${m.sw} > ${m.cw}`);
      rows.push(`  ${tag}: ${m.prose.length} prose blocks, sizes ${[...new Set(m.prose.map((p) => p.size))].join('/')}`);
    }
    await ctx.close();
  }
} catch (err) {
  failures.push(`${err.name}: ${err.message}`);
} finally {
  if (browser) await browser.close();
  stop();
}
finish(NAME, failures, `R65 computed: --fs-body 1rem, root 16px / 24.8px, no prose below 16px, no Karla at 17px, 16px prose at 1.55, chips 14px, no overflow. Measured:\n${rows.join('\n')}`);
