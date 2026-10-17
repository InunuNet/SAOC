#!/usr/bin/env node
// The dev's self-critique evidence: full-page screenshots of the eight critique routes at 390 and 1280, plus the four home hero slides
// at both widths, into .tmp/sandbox/lw-f19/after/ (AFTER_DIR to override). Re-run after the LAST source edit: check-k fails on stale shots.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/capture-shots.mjs
import { mkdirSync } from 'node:fs';
import { VIEWPORTS, ROOT, launch, newPage, open } from './_lib.mjs';
import { CRITIQUE_ROUTES, routeSlug } from './_routes.mjs';

const AFTER = process.env.AFTER_DIR || `${ROOT}.tmp/sandbox/lw-f19/after`;
mkdirSync(AFTER, { recursive: true });
const browser = await launch();
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  for (const r of CRITIQUE_ROUTES) {
    await open(page, r);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${AFTER}/${vp.name}-${routeSlug(r)}.png`, fullPage: true });
  }
  await open(page, '/');
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  if (await pause.count()) await pause.first().click();
  const dots = page.locator('section[aria-roledescription="carousel"] button[aria-label^="Show slide"]');
  const n = await dots.count();
  for (let i = 0; i < n; i++) {
    await dots.nth(i).click();
    await page.waitForTimeout(1900);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('section[aria-roledescription="carousel"]').screenshot({ path: `${AFTER}/${vp.name}-hero-slide${i + 1}.png` });
  }
  await ctx.close();
}
await browser.close();
console.log(`shots written to ${AFTER}`);
