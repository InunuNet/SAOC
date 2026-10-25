// F9 P3 rendered: at 1440 the /events/submit form column is centred and no wider than 640px, via the env-gated
// fixture route /events-fixtures/submit (404 without EVENT_SUBMIT_FIXTURES=1, see f6-submit-rendered.mjs).
//   the form's centre is within 2px of the page's centre (documentElement.clientWidth / 2), its width is 480..640.5px,
//   its wrapper is also <= 640.5px, and nothing overflows horizontally. Re-checked at 1920 so a max-width that only
//   happens to look centred at 1440 is caught.
// Run as: node contracts/checks/polish-wave-2026-10-25/f9-submit-rendered.mjs   (needs a current build)
import { finish } from './_lib.mjs';
import { buildProblem, require, startServer } from './_server.mjs';

const failures = [];
const stale = buildProblem(['components/events/SubmitEventPageBody.tsx']);
if (stale.length) finish('f9-submit-rendered', stale);

const { chromium } = require('playwright');
const srv = await startServer({ env: { EVENT_SUBMIT_FIXTURES: '1' } });
const browser = await chromium.launch();
try {
  for (const [width, dpr] of [[1440, 2], [1920, 1]]) {
    const tag = `${width}@${dpr}`;
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    const r = await page.goto(`http://localhost:${srv.port}/events-fixtures/submit`, { waitUntil: 'load', timeout: 30000 });
    if (!r || r.status() !== 200) { failures.push(`${tag} fixture: HTTP ${r ? r.status() : 'none'}`); await ctx.close(); continue; }
    const m = await page.evaluate(() => {
      const form = document.querySelector('form');
      const f = form.getBoundingClientRect();
      const w = form.parentElement.getBoundingClientRect();
      return { centre: (f.left + f.right) / 2, page: document.documentElement.clientWidth / 2, form: f.width, wrapper: w.width, overflow: document.documentElement.scrollWidth - window.innerWidth };
    });
    if (Math.abs(m.centre - m.page) > 2) failures.push(`${tag} form column centre is ${m.centre.toFixed(1)}, page centre ${m.page.toFixed(1)} (not centred)`);
    if (m.form > 640.5 || m.form < 480) failures.push(`${tag} form column is ${m.form.toFixed(1)}px wide, want 480..640`);
    if (m.wrapper > 640.5) failures.push(`${tag} form wrapper is ${m.wrapper.toFixed(1)}px wide, want <= 640`);
    if (m.overflow > 1) failures.push(`${tag} horizontal overflow of ${m.overflow}px`);
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.stop();
}
finish('f9-submit-rendered', failures);
