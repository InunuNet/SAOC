// nos-critique-r14 f1 rendered (production build, next start 3010-3019 minus 3013, PUBLIC mode). QA input, hash-locked.
// Codi FINAL 2026-10-18: on the tickets hub, adjacent full sections share ONE section unit (the bottom padding of one or the top padding of
// the next, not both): ~115px at 1280, ~72px at 390. Disclosure-ending sections keep r12 F6's 40px.
//   Unit:        derived at test time from the existing token: a probe <section class="nk-section"> inserted into the hub's .nos-theme reports
//                its computed padding-top (clamp(72px, 9vw, 120px) in nos-structure.css); never hard-coded.
//   Hub:         on /national-show/tickets, for every full section (.nk-section / .nos-section) that directly follows an .nk-section, the gap from
//                the leader's [data-nos-wrap] bottom to the follower's [data-nos-wrap] top equals the unit +-2px. The named pair Codi cites
//                ("Day tickets -> Show passes"; the hub labels it Thursday evening -> Show passes, #thursday -> #passes) must be among them.
//                Each section's content (wrap) height equals the baseline (+-1); the masthead is excluded (live countdown).
//   F6:          what-to-expect and workshops keep 40px +-2 from the status disclosure to the content after it.
//   Elsewhere:   every other F24 NOS route and two ticket pages keep their top-level block geometry relative to the hero bottom (the hero's
//                own height excluded, as r12 F6 did) and their document height less that shift.
//   Overflow:    no measured route scrolls horizontally at any width.
// Widths 375, 390, 768, 1280. `--capture` prints goldens/f1-baseline.json (captured by @architect on 9d16cf96).
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { CSS, finish, golden, repoRoot } from './_lib.mjs';
import { AUTH, assertFreshBuild, require, startServer } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'f1-rendered.mjs';
const CAPTURE = process.argv.includes('--capture');
const WIDTHS = [375, 390, 768, 1280];
const TOL_GAP = 2;
const TOL = 1;
const HUB = '/national-show/tickets';
const NAMED = ['thursday', 'passes'];
const F6 = [
  { route: '/national-show/what-to-expect', follower: '.nos-longform' },
  { route: '/national-show/workshops', follower: '#programme .nk-head' },
];
const F6_GAP = 40;
const TICKET_PAGES = ['/tickets/vip', '/tickets/day-visitor'];
const F24 = path.join(repoRoot, 'contracts/checks/launch-weekend/f24');
const { sweepRoutes } = await import(pathToFileURL(path.join(F24, '_meta.mjs')).href);
const failures = [];
const got = {};

const blocksOf = () => {
  const theme = document.querySelector('main .nos-theme') ?? document.querySelector('main');
  const kids = [...theme.children];
  return {
    blocks: kids.map((c) => { const r = c.getBoundingClientRect(); return [c.tagName.toLowerCase(), Math.round((r.top + scrollY) * 10) / 10, Math.round(r.height * 10) / 10]; }),
    hero: kids.findIndex((c) => c.classList.contains('nos-hero') || c.classList.contains('nk-masthead')),
    docHeight: document.documentElement.scrollHeight,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
};

let browser;
let srv;
try {
  if (!process.env.NOS_CR14_ORIGIN) {
    const stale = assertFreshBuild([CSS]);
    if (stale.length > 0) finish(NAME, stale);
  }
  srv = process.env.NOS_CR14_ORIGIN ? { origin: process.env.NOS_CR14_ORIGIN, stop: () => {} } : await startServer({ publicMode: true });
  browser = await chromium.launch();
  const others = [...sweepRoutes().map((r) => r.route).filter((r) => r.startsWith('/national-show/') && r !== HUB && !F6.some((f) => f.route === r)), ...TICKET_PAGES];
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    // Hub
    let res = await page.goto(`${srv.origin}${HUB}`, { waitUntil: 'networkidle' });
    if (res.status() !== 200) failures.push(`${HUB} @${width}: HTTP ${res.status()}`);
    else got[`${HUB} @${width}`] = await page.evaluate(() => {
      const theme = document.querySelector('main .nos-theme');
      const probe = document.createElement('section');
      probe.className = 'nk-section';
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      theme.appendChild(probe);
      const unit = parseFloat(getComputedStyle(probe).paddingTop);
      probe.remove();
      const kids = [...theme.children].filter((c) => c.getBoundingClientRect().height > 0);
      const wrap = (s) => s.querySelector(':scope > [data-nos-wrap]') ?? s;
      const pairs = [];
      for (let i = 1; i < kids.length; i++) {
        const a = kids[i - 1];
        const b = kids[i];
        if (!a.classList.contains('nk-section') || !(b.matches('section.nk-section, section.nos-section'))) continue;
        pairs.push({ from: a.id || a.className, to: b.id || b.className, gap: Math.round((wrap(b).getBoundingClientRect().top - wrap(a).getBoundingClientRect().bottom) * 10) / 10 });
      }
      const wraps = kids.filter((k) => k.matches('section.nk-section, section.nos-section')).map((k) => [k.id || k.className, Math.round(wrap(k).getBoundingClientRect().height * 10) / 10]);
      return { unit, pairs, wraps, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    // F6 routes
    for (const { route, follower } of F6) {
      res = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
      if (res.status() !== 200) { failures.push(`${route} @${width}: HTTP ${res.status()}`); continue; }
      got[`${route} @${width}`] = await page.evaluate((sel) => {
        const f = document.querySelector(sel);
        if (!f) return { error: `no follower ${sel}` };
        const fTop = f.getBoundingClientRect().top;
        const above = [...document.querySelectorAll('main [data-status-disclosure]')].filter((d) => d.getBoundingClientRect().height > 0 && d.getBoundingClientRect().bottom <= fTop);
        if (!above.length) return { error: 'no visible status disclosure above the follower' };
        const d = above.reduce((x, y) => (y.getBoundingClientRect().bottom > x.getBoundingClientRect().bottom ? y : x));
        return { gap: Math.round((fTop - d.getBoundingClientRect().bottom) * 10) / 10, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      }, follower);
    }
    // Everything else
    for (const route of others) {
      res = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
      if (res.status() !== 200) { failures.push(`${route} @${width}: HTTP ${res.status()}`); continue; }
      got[`${route} @${width}`] = await page.evaluate(blocksOf);
    }
    await ctx.close();
  }
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  if (srv) await srv.stop();
  if (browser) await browser.close();
}

if (CAPTURE) {
  if (failures.length) finish(NAME, failures);
  process.stdout.write(`${JSON.stringify({ recorded: 'from the 9d16cf96 build (next start, public mode); hub gaps are the BASE (doubled) values, for the record', got }, null, 1)}\n`);
  process.exit(0);
}
const baseline = JSON.parse(golden('f1-baseline.json')).got;
const near = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => (typeof v === 'number' ? Math.abs(v - b[i]) <= TOL : v === b[i]));

for (const [key, m] of Object.entries(got)) {
  if (m.overflow > 0) failures.push(`${key}: scrolls horizontally by ${m.overflow}px`);
  const b = baseline[key];
  if (key.startsWith(`${HUB} @`)) {
    const width = Number(key.split('@')[1]);
    const token = Math.min(120, Math.max(72, width * 0.09));
    if (Math.abs(m.unit - token) > 0.5) failures.push(`${key}: the section token reads ${m.unit}px, the shared clamp(72px, 9vw, 120px) gives ${token}px; the rhythm itself must not change`);
    if (!m.pairs.length) failures.push(`${key}: no full section follows an .nk-section; the hub structure changed`);
    for (const p of m.pairs) if (Math.abs(p.gap - m.unit) > TOL_GAP) failures.push(`${key}: ${p.from} -> ${p.to} gap ${p.gap}px, want ONE section unit ${m.unit}px +-${TOL_GAP} (Codi FINAL)`);
    if (!m.pairs.some((p) => p.from === NAMED[0] && p.to === NAMED[1])) failures.push(`${key}: the #${NAMED[0]} -> #${NAMED[1]} pair (Codi's "Day tickets -> Show passes") is missing`);
    if (!b) { failures.push(`${key}: no baseline`); continue; }
    if (m.wraps.length !== b.wraps.length || !m.wraps.every((x, i) => near(x, b.wraps[i]))) failures.push(`${key}: section content heights changed: ${JSON.stringify(m.wraps)}, baseline ${JSON.stringify(b.wraps)}`);
  } else if (F6.some((f) => key.startsWith(`${f.route} @`))) {
    if (m.error) failures.push(`${key}: ${m.error}`);
    else if (Math.abs(m.gap - F6_GAP) > TOL_GAP) failures.push(`${key}: ${m.gap}px after the status disclosure, want r12 F6's ${F6_GAP}px +-${TOL_GAP}`);
  } else {
    if (!b) { failures.push(`${key}: no baseline`); continue; }
    const hi = m.hero;
    const shift = hi >= 0 && b.blocks[hi] && m.blocks[hi] ? m.blocks[hi][2] - b.blocks[hi][2] : 0;
    const expect = b.blocks.map((x, i) => (i === hi ? [x[0], x[1], m.blocks[hi][2]] : hi >= 0 && i > hi ? [x[0], Math.round((x[1] + shift) * 10) / 10, x[2]] : x));
    if (m.blocks.length !== b.blocks.length || !m.blocks.every((x, i) => near(x, expect[i]))) failures.push(`${key}: top-level blocks moved (hero shift ${shift.toFixed(1)} allowed): ${JSON.stringify(m.blocks)}, baseline ${JSON.stringify(b.blocks)}`);
    if (Math.abs(m.docHeight - shift - b.docHeight) > TOL + 1) failures.push(`${key}: document height ${m.docHeight} (hero shift ${shift.toFixed(1)}), baseline ${b.docHeight}`);
  }
}
for (const key of Object.keys(baseline)) if (!got[key]) failures.push(`${key}: in the baseline but not measured`);

finish(NAME, failures, `the tickets hub shows ONE section unit between adjacent full sections at ${WIDTHS.join('/')}, F6's 40px holds, ${Object.keys(got).length} measurements keep their geometry with no horizontal overflow.`);
