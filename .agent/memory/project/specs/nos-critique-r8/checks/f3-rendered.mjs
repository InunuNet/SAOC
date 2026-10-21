// nos-critique-r8 f3 rendered: the green tokens resolve inside .nos-theme, and the one thing that uses --green-1 draws it.
//   --green-1 = #A7A841, --green-2 = #7F7D33 on the .nos-theme element (literal, nos-v4 index.html:19-20), on what-to-expect and plan-your-visit
//   ShowHoldingNote's link underline (when the holding note renders) computes rgb(167, 168, 65)
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import { finish, repoRoot } from './_lib.mjs';
import { AUTH } from './_server.mjs';
import { F3_PATHS, openMode } from './r8-lib.mjs';

const NAME = 'f3-rendered.mjs';
const failures = [];
const sourceFiles = [...F3_PATHS].filter((rel) => existsSync(path.join(repoRoot, rel)));
const GREEN1 = '#a7a841';
const GREEN2 = '#7f7d33';
const GREEN1_RGB = 'rgb(167, 168, 65)';

const probe = () => {
  const root = document.querySelector('.nos-theme');
  if (!root) return { theme: false };
  const cs = getComputedStyle(root);
  const notes = [...document.querySelectorAll('main a[href="/contact"][class*="decoration-2"]')].map((a) => getComputedStyle(a).textDecorationColor);
  return { theme: true, g1: cs.getPropertyValue('--green-1').trim().toLowerCase(), g2: cs.getPropertyValue('--green-2').trim().toLowerCase(), notes };
};

let browser;
const handles = [];
try {
  browser = await chromium.launch();
  for (const mode of ['public', 'preview']) {
    const h = await openMode(mode, sourceFiles);
    if (h.stale) finish(NAME, h.stale);
    handles.push(h);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    for (const route of ['/national-show/what-to-expect', '/national-show/plan-your-visit']) {
      const tag = `[${mode}] ${route}`;
      const res = await page.goto(`${h.origin}${route}`, { waitUntil: 'networkidle' });
      if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); continue; }
      const m = await page.evaluate(probe);
      if (!m.theme) { failures.push(`${tag}: no .nos-theme element`); continue; }
      if (m.g1 !== GREEN1) failures.push(`${tag}: --green-1 resolves to "${m.g1}", want ${GREEN1}`);
      if (m.g2 !== GREEN2) failures.push(`${tag}: --green-2 resolves to "${m.g2}", want ${GREEN2}`);
      for (const c of m.notes) if (c !== GREEN1_RGB) failures.push(`${tag}: holding-note underline ${c}, want ${GREEN1_RGB}`);
    }
    await ctx.close();
    h.stop();
  }
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  for (const h of handles) h.stop();
  if (browser) await browser.close();
}

finish(NAME, failures, '--green-1 resolves to #a7a841 and --green-2 to #7f7d33 inside .nos-theme; the holding-note underline, where drawn, is rgb(167, 168, 65).');
