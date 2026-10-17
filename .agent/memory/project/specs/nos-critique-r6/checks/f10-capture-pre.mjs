// nos-critique-r6 f10 -- run ONCE, before NosSubNav.tsx / nos-structure.css are edited for f10 (after f1..f8 are in the tree):
// it records the >=768 appearance of the stack so f10-rendered.mjs can prove f10 is pixel-identical at 1280, and it measures whether any
// sub-nav row overflows at 701/720/767 (goldens/f10-breakpoint.json: 767 if so, else the R27 700 stays).
//   node f10-capture-pre.mjs        writes goldens/f10-pre-<slug>-1280.png for 2 routes and goldens/f10-breakpoint.json; refuses to overwrite or to run on an edited tree
// Needs a fresh production build of the tree (next start 3010-3019). Not part of the gate.
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { finish, readRepoFile, scopeFiles, specDir } from './_lib.mjs';
import { AUTH, require } from './_server.mjs';
import { openOrigin } from './f6-f8-lib.mjs';
import { F10_SHOTS, subnavClip } from './f10-shots.mjs';

const failures = [];
if (/scrollIntoView|data-fade-start/.test(readRepoFile('components/nos/NosSubNav.tsx') ?? '')) finish('f10-capture-pre.mjs', ['NosSubNav.tsx already carries f10 changes; the pre-f10 appearance can no longer be captured from this tree']);
const handle = await openOrigin(scopeFiles());
if (handle.stale) finish('f10-capture-pre.mjs', handle.stale);
const { chromium } = require('playwright');
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, extraHTTPHeaders: { authorization: AUTH } });
  const page = await ctx.newPage();
  for (const shot of F10_SHOTS) {
    const file = path.join(specDir, 'goldens', shot.file);
    if (existsSync(file)) { failures.push(`${shot.file} exists; refusing to overwrite (delete it deliberately to re-capture)`); continue; }
    const res = await page.goto(`${handle.origin}${shot.route}`, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) { failures.push(`${shot.route}: HTTP ${res && res.status()}`); continue; }
    const clip = await subnavClip(page);
    if (!clip) { failures.push(`${shot.route}: no nav.nos-subnav`); continue; }
    writeFileSync(file, await page.screenshot({ clip, animations: 'disabled', caret: 'hide' }));
  }
// Breakpoint measurement (Codi): 767 only if a sub-nav row genuinely overflows between 701 and 767; otherwise the R27 700 stays.
const bpFile = path.join(specDir, 'goldens', 'f10-breakpoint.json');
if (existsSync(bpFile)) failures.push('f10-breakpoint.json exists; refusing to overwrite (delete it deliberately to re-measure)');
else {
  const ctx = await browser.newContext({ viewport: { width: 720, height: 800 }, extraHTTPHeaders: { authorization: AUTH } });
  const page = await ctx.newPage();
  const measured = [];
  for (const route of ['about', 'programme', 'sa-exhibitors', 'sponsors'].map((r) => `/national-show/${r}`)) {
    for (const width of [701, 720, 767]) {
      await page.setViewportSize({ width, height: 800 });
      const res = await page.goto(`${handle.origin}${route}`, { waitUntil: 'networkidle' });
      if (!res || res.status() !== 200) { failures.push(`${route} @${width}: HTTP ${res && res.status()}`); continue; }
      const m = await page.evaluate(() => {
        const row = document.querySelector('nav.nos-subnav ul');
        if (!row) return null;
        const links = [...row.querySelectorAll('a')];
        const cs = getComputedStyle(row);
        const gap = parseFloat(cs.columnGap) || 0;
        const natural = links.reduce((t, a) => t + a.getBoundingClientRect().width, 0) + gap * (links.length - 1);
        const avail = row.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        return { n: links.length, natural: Math.round(natural), avail: Math.round(avail) };
      });
      if (!m) { failures.push(`${route} @${width}: no nav.nos-subnav row`); continue; }
      measured.push({ route, width, ...m, overflows: m.natural > m.avail + 1 });
    }
  }
  await ctx.close();
  const maxWidthPx = measured.some((m) => m.overflows) ? 767 : 700;
  if (failures.length === 0) writeFileSync(bpFile, `${JSON.stringify({ maxWidthPx, rule: 'Codi: 767 only if a row genuinely overflows at 701-767, else the R27 700px stays', measured }, null, 2)}\n`);
}
} finally {
  await browser.close();
  handle.stop();
}
finish('f10-capture-pre.mjs', failures, `captured ${F10_SHOTS.length} pre-f10 reference screenshots at 1280.`);
