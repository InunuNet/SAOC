// F9 P2 rendered: the National Show event page has no meta table (no <dl> or <dt> outside the show band) while the
// h1, a date line and exactly one band remain; an ordinary event, when the dataset has one, keeps its meta table.
// (The live dataset holds only the show event; the ordinary-event half is asserted statically in f9-static.mjs.)
// At 390 and 1440. Run as: node contracts/checks/polish-wave-2026-10-25/f9-event-meta-rendered.mjs   (needs a current build)
import { finish } from './_lib.mjs';
import { buildProblem, require, startServer } from './_server.mjs';
import { findEventSlugs } from './f9-shared.mjs';

const failures = [];
const stale = buildProblem(['app/(marketing)/events/[slug]/page.tsx']);
if (stale.length) finish('f9-event-meta-rendered', stale);

const { chromium } = require('playwright');
const outsideBand = () => [...document.querySelectorAll('dl, dt')].filter((n) => !n.closest('[data-home-section="show-band"]')).map((n) => n.tagName);

const srv = await startServer();
const browser = await chromium.launch();
try {
  const { showSlug, otherSlug } = await findEventSlugs(srv.port);
  if (!showSlug) failures.push('no National Show event link on /events; check cannot run');
  for (const width of [390, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    if (showSlug) {
      const r = await page.goto(`http://localhost:${srv.port}/events/${showSlug}`, { waitUntil: 'load', timeout: 30000 });
      if (!r || r.status() !== 200) failures.push(`${width} show event: HTTP ${r ? r.status() : 'none'}`);
      else {
        if ((await page.locator('[data-home-section="show-band"]').count()) !== 1) failures.push(`${width} show event: want exactly one show band`);
        const stray = await page.evaluate(outsideBand);
        if (stray.length) failures.push(`${width} show event still renders a meta table outside the band (${stray.join(',')})`);
        if ((await page.locator('h1').count()) !== 1) failures.push(`${width} show event: want exactly one h1`);
        const main = await page.evaluate(() => document.body.innerText);
        if (!/\b20\d\d\b/.test(main)) failures.push(`${width} show event: no date line (a year) on the page`);
      }
    }
    if (otherSlug) {
      await page.goto(`http://localhost:${srv.port}/events/${otherSlug}`, { waitUntil: 'load', timeout: 30000 });
      if ((await page.evaluate(outsideBand)).length === 0) failures.push(`${width} ordinary event /events/${otherSlug} lost its meta table`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.stop();
}
finish('f9-event-meta-rendered', failures);
