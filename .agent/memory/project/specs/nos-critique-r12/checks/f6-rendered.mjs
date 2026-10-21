// nos-critique-r12 f6 rendered (production build, next start 3010-3019, PUBLIC mode: the status disclosures only render there). QA input, hash-locked.
// F6 [P2]: a section that ENDS in a status disclosure ([data-status-disclosure]) is followed by a second full section, so the page shows two stacked
// rhythm units (26fde668: 230px at 1280, 144px at 390). Only /national-show/what-to-expect and /national-show/workshops have one (architect sweep of
// every F24 NOS route and every /tickets/* page, f6-spec.md).
//   Gap:        on both routes at 375, 390, 768 and 1280, the distance from the disclosure's bottom to the top of the content that follows it (FOLLOWER)
//               is ONE section gap: 40px +-2 (lead ruling 2026-10-18, inside Codi's <=96 at 1280 and <=64 at 390).
//   Unchanged:  on both routes, the disclosure's box, the follower's height, the hero box and the <main> text equal goldens/f6-baseline.json.
//   Elsewhere:  on KEEP (hub, ticket hub, plan-your-visit, exhibitors: same-ground joins, stacked nk-sections and a mid-section disclosure), the box of
//               every top-level block in .nos-theme and the document height equal the baseline at every width ("no other site-wide change"); the hero's
//               own height is excluded (live countdown and CMS price) and later blocks may shift by exactly that difference.
// `--capture` prints the baseline (captured by @architect on 26fde668).
import { existsSync } from 'node:fs';
import path from 'node:path';

import { FEATURES, finish, golden, repoRoot, specDir } from './_lib.mjs';
import { assertFreshBuild, require, startServer } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'f6-rendered.mjs';
const CAPTURE = process.argv.includes('--capture');
const WIDTHS = [375, 390, 768, 1280];
// Lead ruling 2026-10-18: 40px, the space-y-10 step these sections already use (Codi FINAL caps: <=96 at 1280, <=64 at 390), +-2px.
const GAP_PX = 40;
const GAP = Object.fromEntries(WIDTHS.map((w) => [w, [GAP_PX - 2, GAP_PX + 2]]));
const TOL = 1;
const TARGETS = [
  { route: '/national-show/what-to-expect', follower: '.nos-longform' },
  { route: '/national-show/workshops', follower: '#programme .nk-head' },
];
const KEEP = ['/national-show', '/national-show/tickets', '/national-show/plan-your-visit', '/national-show/exhibitors'];
const failures = [];
const got = {};

let browser;
let srv;
try {
  const sourceFiles = [...new Set(FEATURES.filter((n) => existsSync(path.join(specDir, 'goldens', `f${n}-footprint.json`))).flatMap((n) => JSON.parse(golden(`f${n}-footprint.json`))))].filter((rel) => existsSync(path.join(repoRoot, rel)));
  if (!process.env.NOS_CR12_ORIGIN) {
    const stale = assertFreshBuild(sourceFiles);
    if (stale.length > 0) finish(NAME, stale);
  }
  srv = process.env.NOS_CR12_ORIGIN ? { origin: process.env.NOS_CR12_ORIGIN, stop: () => {} } : await startServer({ publicMode: true });
  browser = await chromium.launch();
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    for (const { route, follower } of TARGETS) {
      const res = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
      if (res.status() !== 200) { failures.push(`${route} @${width}: HTTP ${res.status()}`); continue; }
      got[`${route} @${width}`] = await page.evaluate((sel) => {
        const box = (el) => { const r = el.getBoundingClientRect(); return [Math.round((r.left + scrollX) * 10) / 10, Math.round((r.top + scrollY) * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; };
        const f = document.querySelector(sel);
        const hero = document.querySelector('.nos-hero');
        const main = document.querySelector('main');
        if (!f) return { error: `no follower ${sel}` };
        const fTop = f.getBoundingClientRect().top;
        const above = [...document.querySelectorAll('main [data-status-disclosure]')].filter((d) => d.getBoundingClientRect().height > 0 && d.getBoundingClientRect().bottom <= fTop);
        if (above.length === 0) return { error: 'no visible status disclosure above the follower' };
        const d = above.reduce((a, b) => (b.getBoundingClientRect().bottom > a.getBoundingClientRect().bottom ? b : a));
        return {
          gap: Math.round((fTop - d.getBoundingClientRect().bottom) * 10) / 10,
          disclosure: box(d),
          followerHeight: box(f)[3],
          hero: hero ? box(hero) : null,
          text: main ? main.textContent.replace(/\s+/g, ' ').trim() : '',
        };
      }, follower);
    }
    for (const route of KEEP) {
      const res = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
      if (res.status() !== 200) { failures.push(`${route} @${width}: HTTP ${res.status()}`); continue; }
      got[`${route} @${width}`] = await page.evaluate(() => {
        const theme = document.querySelector('main .nos-theme') ?? document.querySelector('main');
        const blocks = [...theme.children].map((c) => { const r = c.getBoundingClientRect(); return [c.tagName.toLowerCase(), Math.round((r.top + scrollY) * 10) / 10, Math.round(r.height * 10) / 10]; });
        return { blocks, hero: [...theme.children].findIndex((c) => c.classList.contains('nos-hero')), docHeight: document.documentElement.scrollHeight };
      });
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
  process.stdout.write(`${JSON.stringify({ recorded: 'from the 26fde668 build (next start, public mode); target gaps are the BASE (doubled) values, for the record', got }, null, 1)}\n`);
  process.exit(0);
}
const baseline = JSON.parse(golden('f6-baseline.json')).got;
const near = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => (typeof v === 'number' ? Math.abs(v - b[i]) <= TOL : v === b[i]));

for (const width of WIDTHS) {
  for (const { route } of TARGETS) {
    const key = `${route} @${width}`;
    const m = got[key];
    const b = baseline[key];
    if (!m) { failures.push(`${key}: not measured`); continue; }
    if (m.error) { failures.push(`${key}: ${m.error}`); continue; }
    const [lo, hi] = GAP[width];
    if (m.gap < lo || m.gap > hi) failures.push(`${key}: ${m.gap}px from the disclosure to the next content, want ONE section gap (${lo}-${hi}px; 26fde668 ${b ? b.gap : '?'}px)`);
    if (!b) { failures.push(`${key}: no baseline`); continue; }
    if (!near(m.disclosure, b.disclosure)) failures.push(`${key}: disclosure box ${JSON.stringify(m.disclosure)}, baseline ${JSON.stringify(b.disclosure)}`);
    if (Math.abs(m.followerHeight - b.followerHeight) > TOL) failures.push(`${key}: follower height ${m.followerHeight}, baseline ${b.followerHeight}`);
    if (!near(m.hero, b.hero)) failures.push(`${key}: hero box ${JSON.stringify(m.hero)}, baseline ${JSON.stringify(b.hero)}`);
    if (m.text !== b.text) failures.push(`${key}: <main> text changed (content or order)`);
  }
  for (const route of KEEP) {
    const key = `${route} @${width}`;
    const m = got[key];
    const b = baseline[key];
    if (!m || !b) { failures.push(`${key}: not measured or no baseline`); continue; }
    // The hub hero holds a live countdown and a CMS price line, so its height varies with time and content (dev, 2026-10-18: 1236.7 vs 1097.9 at 768,
    // identical on 26fde668 and the tip). F6 never touches the hero, so its height is excluded: every later block may shift by exactly the hero's
    // height difference, and nothing else may move or resize.
    const hi = m.hero ?? -1;
    const shift = hi >= 0 && b.blocks[hi] ? m.blocks[hi][2] - b.blocks[hi][2] : 0;
    const expect = b.blocks.map((x, i) => (i === hi ? [x[0], x[1], m.blocks[hi][2]] : hi >= 0 && i > hi ? [x[0], Math.round((x[1] + shift) * 10) / 10, x[2]] : x));
    if (m.blocks.length !== b.blocks.length || !m.blocks.every((x, i) => near(x, expect[i]))) failures.push(`${key}: top-level block boxes changed (hero height ${shift >= 0 ? '+' : ''}${shift.toFixed(1)} allowed): ${JSON.stringify(m.blocks)}, baseline ${JSON.stringify(b.blocks)}`);
    if (Math.abs(m.docHeight - shift - b.docHeight) > TOL + 1) failures.push(`${key}: document height ${m.docHeight} (hero shift ${shift.toFixed(1)}), baseline ${b.docHeight}`);
  }
}

finish(NAME, failures, `what-to-expect and workshops show ONE 40px section gap after their status disclosure at 375, 390, 768 and 1280, everything else on them unchanged; ${KEEP.length} other NOS routes keep their 26fde668 geometry.`);
