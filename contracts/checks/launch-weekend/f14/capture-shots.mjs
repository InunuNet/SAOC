#!/usr/bin/env node
// Screenshots the two home sections (NavCards, ShowBand) at 390, 1280 and 1920, plus a hovered card and the
// keyboard-focused first card at 1280. Works on the untouched tree (text locators) and on the F14 build (hooks).
// Usage: OUT=.tmp/sandbox/lw-f14/before BASE_URL=http://localhost:3614 node contracts/checks/launch-weekend/f14/capture-shots.mjs
import { mkdirSync } from 'node:fs';
import { VIEWPORTS, launch, newPage, openHome } from './_lib.mjs';

const OUT = process.env.OUT || '.tmp/sandbox/lw-f14/shots';
mkdirSync(OUT, { recursive: true });

const browser = await launch();
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  await openHome(page);
  const nav = page.locator('section', { has: page.getByRole('heading', { name: 'Four ways into SAOC' }) }).first();
  const band = page.locator('section', { has: page.getByRole('heading', { level: 2, name: /National Orchid Show/ }) }).first();
  await page.addStyleTag({ content: 'header, [role=banner], .sticky, .fixed { visibility: hidden !important; }' });
  await nav.scrollIntoViewIfNeeded();
  await nav.screenshot({ path: `${OUT}/${vp.name}-navcards.png` });
  await band.scrollIntoViewIfNeeded();
  await band.screenshot({ path: `${OUT}/${vp.name}-showband.png` });
  if (vp.name === '1280') {
    const card = nav.locator('a[href="/societies"]').first();
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await page.waitForTimeout(400);
    await nav.screenshot({ path: `${OUT}/1280-navcards-hover.png` });
    await page.mouse.move(0, 0);
    await card.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(400);
    await nav.screenshot({ path: `${OUT}/1280-navcards-focus.png` });
    const cta = band.locator('a[href="/national-show"]').first();
    await cta.hover();
    await page.waitForTimeout(300);
    await band.screenshot({ path: `${OUT}/1280-showband-cta-hover.png` });
  }
  await ctx.close();
}
await browser.close();
console.log(`shots written to ${OUT}`);
