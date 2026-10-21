// nos-critique-r10 f2 rendered (production build, next start 3010-3019, public mode, where the R11 disclosure renders): /national-show/what-to-expect at 375, 768 and 1280.
//   Order (R50 P1): the "Show dates" card and the disclosure ([data-status-disclosure]) are siblings in the page's first NosSection; the dates card is its FIRST element child and
//   the disclosure comes directly after it (dates index + 1).
//   Content: the normalised textContent of the dates card and of the disclosure equal goldens/f2-baseline.json, captured by @architect on the d05c85a5 build (`--capture` prints it,
//   it never writes a file), so the move changes neither block.
//   Chip non-regression (r8 F1): exactly one disclosure on the page, exactly one chip in it, one label painted (displayed, not sr-only) and one exposed to assistive tech.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import { finish, golden, repoRoot } from './_lib.mjs';
import { AUTH, assertFreshBuild, startServer } from './_server.mjs';

const NAME = 'f2-rendered.mjs';
const CAPTURE = process.argv.includes('--capture');
const failures = [];
const sourceFiles = JSON.parse(golden('f2-footprint.json')).filter((rel) => existsSync(path.join(repoRoot, rel)));
const ROUTE = '/national-show/what-to-expect';
const WIDTHS = [375, 768, 1280];

const measure = () => {
  const norm = (t) => t.replace(/\s+/g, ' ').trim();
  const dates = [...document.querySelectorAll('section.nos-surface')].filter((s) => norm(s.querySelector('h2')?.textContent ?? '') === 'Show dates');
  const discs = [...document.querySelectorAll('[data-status-disclosure]')];
  const d = dates[0] ?? null;
  const n = discs[0] ?? null;
  const idx = (el) => (el && el.parentElement ? [...el.parentElement.children].indexOf(el) : -1);
  const chips = n ? [...n.querySelectorAll('[data-confirmation-badge], [data-exhibitor-marker]')].map((b) => {
    const spans = [...b.children].filter((c) => c.textContent.trim() !== '※').map((c) => {
      const s = getComputedStyle(c);
      const r = c.getBoundingClientRect();
      const shown = s.display !== 'none' && s.visibility !== 'hidden';
      return { painted: shown && !(s.position === 'absolute' && r.width <= 1 && r.height <= 1), at: shown && c.getAttribute('aria-hidden') !== 'true' };
    });
    return { painted: spans.filter((x) => x.painted).length, at: spans.filter((x) => x.at).length };
  }) : [];
  return {
    datesCount: dates.length, discCount: discs.length,
    sameParent: !!d && !!n && d.parentElement === n.parentElement,
    datesFirst: !!d && d.parentElement.firstElementChild === d,
    datesIdx: idx(d), discIdx: idx(n),
    datesText: d ? norm(d.textContent) : null, discText: n ? norm(n.textContent) : null,
    chips,
  };
};

let browser;
let srv;
const got = {};
try {
  if (!process.env.NOS_CR10_ORIGIN) {
    const stale = assertFreshBuild(sourceFiles);
    if (stale.length > 0) finish(NAME, stale);
  }
  process.env.SHOW_PLACEHOLDER_PREVIEW = ''; // public mode; the withhold switch matches 'true' exactly
  srv = process.env.NOS_CR10_ORIGIN ? { origin: process.env.NOS_CR10_ORIGIN, stop: () => {} } : await startServer();
  browser = await chromium.launch({ args: ['--hide-scrollbars'] });
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    const res = await page.goto(`${srv.origin}${ROUTE}`, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) failures.push(`${ROUTE} @${width}: HTTP ${res && res.status()}`);
    else {
      await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
      got[width] = await page.evaluate(measure);
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
  const out = Object.fromEntries(Object.entries(got).map(([w, m]) => [w, { datesText: m.datesText, discText: m.discText, datesIdx: m.datesIdx, discIdx: m.discIdx }]));
  process.stdout.write(`${JSON.stringify({ recorded: 'from the d05c85a5 build (next start, public mode, DPR 1); datesIdx/discIdx are the BASE order, for the record only', measured: out }, null, 1)}\n`);
  process.exit(0);
}
const want = JSON.parse(golden('f2-baseline.json')).measured;
for (const width of WIDTHS) {
  const m = got[width];
  const tag = `${ROUTE} @${width}`;
  if (!m) { failures.push(`${tag}: not measured`); continue; }
  if (m.datesCount !== 1) failures.push(`${tag}: ${m.datesCount} "Show dates" cards, want 1`);
  if (m.discCount !== 1) failures.push(`${tag}: ${m.discCount} R11 disclosures, want 1`);
  if (!m.sameParent) failures.push(`${tag}: the dates card and the disclosure must be siblings in the first NosSection`);
  if (!m.datesFirst) failures.push(`${tag}: the dates card must be the section's first block (index ${m.datesIdx}, disclosure ${m.discIdx})`);
  if (m.discIdx !== m.datesIdx + 1) failures.push(`${tag}: the disclosure must come directly after the dates card (dates ${m.datesIdx}, disclosure ${m.discIdx})`);
  const w = want[width];
  if (!w) failures.push(`${tag}: no baseline`);
  else {
    if (m.datesText !== w.datesText) failures.push(`${tag}: dates card text ${JSON.stringify(m.datesText)}, baseline ${JSON.stringify(w.datesText)}`);
    if (m.discText !== w.discText) failures.push(`${tag}: disclosure text changed: ${JSON.stringify(m.discText)}, baseline ${JSON.stringify(w.discText)}`);
  }
  if (m.chips.length !== 1) failures.push(`${tag}: ${m.chips.length} chips in the disclosure, want 1 (r8 F1)`);
  for (const c of m.chips) if (c.painted !== 1 || c.at !== 1) failures.push(`${tag}: chip paints ${c.painted} and exposes ${c.at} label strings, want 1 and 1 (r8 F1)`);
}

finish(NAME, failures, 'at 375, 768 and 1280 the Show dates card opens the section with the R11 disclosure directly after it, both texts equal the d05c85a5 baseline, and the disclosure holds one chip with one painted and one exposed label.');
