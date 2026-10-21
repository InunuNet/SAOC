// nos-critique-r7 f3 rendered: the gold disclosure surfaces really are gold. ABSOLUTE literal, never a var probe (the r6 probe resolved the same undefined var on both sides).
//   default disclosure = gold rgb(243, 242, 214); .on-pale variant = gold-100 rgb(251, 250, 240). The surface element itself is measured, never an ancestor of the chip.
//   public: every [data-status-disclosure] on exhibitors and what-to-expect (at least one each) has background-color rgb(243, 242, 214) = #f3f2d6 (nos-v4 index.html --gold)
//   both modes: plan-your-visit Getting-there group is gold, the emergency group is pale; hub /national-show: every disclosure is gold, or pale when it is marked .on-pale / [data-tone="pale"]
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import { finish, repoRoot } from './_lib.mjs';
import { AUTH } from './_server.mjs';
import { F1_PATHS, F2_PATHS, F3_PATHS, openMode } from './r7-lib.mjs';

const NAME = 'f3-rendered.mjs';
const failures = [];
const GOLD_RGB = 'rgb(243, 242, 214)'; // #f3f2d6, default disclosure
const PALE_RGB = 'rgb(251, 250, 240)'; // #fbfaf0 = --gold-100, the .on-pale variant (nos-v4 index.html:17)
const sourceFiles = [...F1_PATHS, ...F2_PATHS, ...F3_PATHS].filter((rel) => existsSync(path.join(repoRoot, rel)));
const GROUPS = ['Details to be confirmed by the show committee', 'Emergency contacts, to be confirmed by the show committee'];

const bgs = (arg) => {
  const q = (s) => [...document.querySelectorAll(s)];
  const bg = (e) => getComputedStyle(e).backgroundColor;
  const pale = (e) => e.matches('.on-pale, [data-tone="pale"]');
  return {
    disclosures: q('[data-status-disclosure]').map((e) => ({ bg: bg(e), pale: pale(e) })),
    groups: arg.labels.map((l) => q('[role="group"]').filter((g) => g.getAttribute('aria-label') === l).map(bg)),
  };
};

let browser;
const handles = [];
try {
  browser = await chromium.launch();
  for (const mode of ['public', 'preview']) {
    const h = await openMode(mode, sourceFiles);
    if (h.stale) finish(NAME, h.stale);
    handles.push(h);
    for (const width of [390, 1280]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, extraHTTPHeaders: { authorization: AUTH } });
      const page = await ctx.newPage();
      const routes = mode === 'public' ? ['/national-show/exhibitors', '/national-show/what-to-expect', '/national-show/plan-your-visit', '/national-show'] : ['/national-show/plan-your-visit', '/national-show'];
      for (const route of routes) {
        const tag = `[${mode}] ${route} @${width}`;
        const res = await page.goto(`${h.origin}${route}`, { waitUntil: 'networkidle' });
        if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); continue; }
        const m = await page.evaluate(bgs, { labels: GROUPS });
        if (route.endsWith('plan-your-visit')) {
          GROUPS.forEach((l, i) => {
            const want = i === 0 ? GOLD_RGB : PALE_RGB;
            // the golden Getting-there label is shared by the Getting-there and attractions disclosures (0-2 on the page, none when all confirmed); the emergency one is exactly 1
            if (i === 1 ? m.groups[i].length !== 1 : m.groups[i].length > 2) failures.push(`${tag}: ${m.groups[i].length} group(s) labelled "${l}"`);
           
            for (const c of m.groups[i]) if (c !== want) failures.push(`${tag}: "${l}" background ${c}, want ${want}`);
          });
        } else if (route === '/national-show') {
          for (const d of m.disclosures) if (d.bg !== (d.pale ? PALE_RGB : GOLD_RGB)) failures.push(`${tag}: ${d.pale ? 'pale' : 'default'} disclosure background ${d.bg}, want ${d.pale ? PALE_RGB : GOLD_RGB}`);
        } else {
          if (m.disclosures.length < 1) failures.push(`${tag}: no [data-status-disclosure] in public mode`);
          for (const d of m.disclosures) if (d.bg !== (d.pale ? PALE_RGB : GOLD_RGB)) failures.push(`${tag}: ${d.pale ? 'pale' : 'default'} disclosure background ${d.bg}, want ${d.pale ? PALE_RGB : GOLD_RGB}`);
        }
      }
      await ctx.close();
    }
    h.stop();
  }
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  for (const h of handles) h.stop();
  if (browser) await browser.close();
}

finish(NAME, failures, 'default disclosures compute rgb(243, 242, 214) and pale ones (plan-your-visit emergency) rgb(251, 250, 240), on exhibitors, what-to-expect, plan-your-visit and the hub.');
