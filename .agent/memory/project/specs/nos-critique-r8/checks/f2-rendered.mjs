// nos-critique-r8 f2 rendered: on the live data (no Getting-there item confirmed) the lede still shows under the "Getting there" h2, in both modes at 390 and 1280.
// (The withheld cases are covered by f2-fixture.mjs, which needs no CMS state.) Live-data dependent: the lede is the Sanity gettingThereIntro.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import { finish, repoRoot } from './_lib.mjs';
import { AUTH } from './_server.mjs';
import { F1_PATHS, F2_PATHS, openMode } from './r8-lib.mjs';

const NAME = 'f2-rendered.mjs';
const failures = [];
const sourceFiles = [...F1_PATHS, ...F2_PATHS].filter((rel) => existsSync(path.join(repoRoot, rel)));
const ROUTE = '/national-show/plan-your-visit';

const lede = () => {
  const norm = (t) => t.replace(/\s+/g, ' ').trim();
  const h = [...document.querySelectorAll('main h2')].find((x) => norm(x.textContent) === 'Getting there');
  if (!h) return { heading: false };
  const head = norm(h.textContent);
  const block = h.parentElement;
  const text = norm(block.textContent).replace(head, '').trim();
  const confirmedItems = [...document.querySelectorAll('main h3')].filter((x) => !x.closest('[role="group"]')).length;
  return { heading: true, text, plainH3: confirmedItems };
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
      const tag = `[${mode}] ${ROUTE} @${width}`;
      const res = await page.goto(`${h.origin}${ROUTE}`, { waitUntil: 'networkidle' });
      if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); await ctx.close(); continue; }
      const m = await page.evaluate(lede);
      if (!m.heading) failures.push(`${tag}: no "Getting there" h2`);
      else if (!/worked out yet/.test(m.text)) failures.push(`${tag}: the Getting-there lede is missing or changed while every item is unconfirmed (got "${m.text.slice(0, 80)}")`);
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

finish(NAME, failures, 'with no Getting-there item confirmed, the lede still renders under the h2 in both modes at 390 and 1280.');
