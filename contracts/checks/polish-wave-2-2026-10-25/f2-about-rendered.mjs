// F2 rendered (/about, SAOC host) at 390@3, 768@1, 1280@1 and 1440@2.
//   - the heritage stats <dl> shows exactly the terms "28 July 1968", "4", "15" (no bare "1968" term)
//   - from 640px up the three stats sit in one row and fill the width in three columns: the third stat starts
//     at least 55% of the way across (in a four-column grid it starts at 50%, leaving an empty fourth cell)
//   - the verbatim prose still says "Established in 1968"
// Run as: node contracts/checks/polish-wave-2-2026-10-25/f2-about-rendered.mjs
import { finish } from './_lib.mjs';
import { buildProblem, require, startServer } from './_server.mjs';
import { VIEWPORTS } from './_viewports.mjs';

const failures = [];
const stale = buildProblem(['app/(marketing)/about/page.tsx']);
if (stale.length) finish('f2-about-rendered', stale);

const { chromium } = require('playwright');
const srv = await startServer();
const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    const tag = `${vp.width}@${vp.dpr}`;
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${srv.port}/about`, { waitUntil: 'load', timeout: 30000 });
    const stats = await page.evaluate(() => {
      const dl = [...document.querySelectorAll('main dl')].find((d) => /Founding societies/.test(d.textContent ?? ''));
      if (!dl) return null;
      const box = dl.getBoundingClientRect();
      const items = [...dl.querySelectorAll(':scope > div')].map((d) => {
        const r = d.getBoundingClientRect();
        return { term: (d.querySelector('dt')?.textContent ?? '').trim(), left: r.left, top: r.top };
      });
      return { left: box.left, width: box.width, items, prose: document.querySelector('main')?.textContent ?? '' };
    });
    if (!stats) { failures.push(`${tag}: heritage stats <dl> not found`); await ctx.close(); continue; }
    const terms = stats.items.map((i) => i.term);
    if (terms.join('|') !== '28 July 1968|4|15') failures.push(`${tag}: stat terms are [${terms.join(' | ')}], want [28 July 1968 | 4 | 15]`);
    if (!/Established in\s*1968/.test(stats.prose)) failures.push(`${tag}: prose "Established in 1968" is missing`);
    if (vp.width >= 640 && stats.items.length === 3) {
      const tops = stats.items.map((i) => i.top);
      if (Math.max(...tops) - Math.min(...tops) > 2) failures.push(`${tag}: the three stats are not in one row (tops ${tops.map((t) => t.toFixed(0)).join(', ')})`);
      const third = (stats.items[2].left - stats.left) / stats.width;
      if (third < 0.55) failures.push(`${tag}: third stat starts ${(third * 100).toFixed(0)}% across, want >=55% (three columns)`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.stop();
}
finish('f2-about-rendered', failures);
