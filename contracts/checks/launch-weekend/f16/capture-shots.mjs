#!/usr/bin/env node
// Screenshots for the F16 self-critique loop. Names are fixed (check-i-critique-artefacts.mjs requires exactly this set).
// Usage: OUT=.tmp/sandbox/lw-f16/after BASE_URL=http://localhost:3620 node --import tsx/esm contracts/checks/launch-weekend/f16/capture-shots.mjs
import { mkdirSync } from 'node:fs';
import { VIEWPORTS, HUB, SEL, launch, newPage, openPath } from './_lib.mjs';

const OUT = process.env.OUT || '.tmp/sandbox/lw-f16/shots';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  await openPath(page, HUB);
  await page.screenshot({ path: `${OUT}/${vp.name}-hub.png`, fullPage: true });
  if (vp.name === '390') await page.screenshot({ path: `${OUT}/390-index.png` });
  if (vp.name === '1280') {
    for (const [name, sel] of [['index-chip', `${SEL.index} a`], ['row-action', SEL.action]]) {
      const el = page.locator(sel).first();
      if (!(await el.count())) continue;
      await el.scrollIntoViewIfNeeded();
      await el.hover(); await page.waitForTimeout(450);
      await page.screenshot({ path: `${OUT}/1280-${name}-hover.png` });
      await page.mouse.move(0, 0);
      await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
      for (let i = 0; i < 80; i++) { await page.keyboard.press('Tab'); if (await el.evaluate((e) => e === document.activeElement)) break; }
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${OUT}/1280-${name}-focus.png` });
    }
  }
  if (vp.name !== '1920') {
    await openPath(page, '/national-show/conferences');
    await page.screenshot({ path: `${OUT}/${vp.name}-conferences.png`, fullPage: true });
  }
  await ctx.close();
}
await browser.close();
console.log(`shots written to ${OUT}`);
