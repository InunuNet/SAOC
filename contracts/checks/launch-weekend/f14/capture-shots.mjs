#!/usr/bin/env node
// Screenshots the four F14 home sections at 390, 1280 and 1920, plus hover (and, at 1280, keyboard-focus) states.
// Names: <vp>-<section>.png with section in nav-cards, show-band, yearbook, partners; 1280-<name>-hover.png for
// nav-cards, show-band-cta, yearbook-cta, partners-row; 1280-nav-cards-focus.png. Works on the untouched tree
// (text locators) and the F14 build. check-k-critique-artefacts.mjs requires exactly this set.
// Usage: OUT=.tmp/sandbox/lw-f14/after BASE_URL=http://localhost:3614 node contracts/checks/launch-weekend/f14/capture-shots.mjs
import { mkdirSync } from 'node:fs';
import { VIEWPORTS, launch, newPage, openHome } from './_lib.mjs';

const OUT = process.env.OUT || '.tmp/sandbox/lw-f14/shots';
mkdirSync(OUT, { recursive: true });
const HIDE = 'header, [role=banner], .sticky, .fixed { visibility: hidden !important; }';

const browser = await launch();
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  await openHome(page);
  await page.addStyleTag({ content: HIDE });
  const sec = {
    'nav-cards': page.locator('main > section', { has: page.getByRole('heading', { level: 2, name: 'Four ways into SAOC' }) }).first(),
    'show-band': page.locator('main > section', { has: page.getByRole('heading', { level: 2, name: /National Orchid Show/ }) }).first(),
    yearbook: page.locator('main > section', { has: page.getByRole('heading', { level: 2, name: /yearbook/ }) }).first(),
    partners: page.locator('main > section', { hasText: 'In collaboration with' }).first(),
  };
  for (const [name, loc] of Object.entries(sec)) {
    await loc.scrollIntoViewIfNeeded();
    await loc.screenshot({ path: `${OUT}/${vp.name}-${name}.png` });
  }
  if (vp.name === '1280') {
    const hovers = [
      ['nav-cards', 'nav-cards', sec['nav-cards'].locator('a[href="/societies"]').first()],
      ['show-band-cta', 'show-band', sec['show-band'].locator('a[href="/tickets"]').first()],
      ['yearbook-cta', 'yearbook', sec.yearbook.locator('a').first()],
      ['partners-row', 'partners', sec.partners.locator('a').first()],
    ];
    for (const [name, owner, el] of hovers) {
      await el.scrollIntoViewIfNeeded();
      await el.hover();
      await page.waitForTimeout(450);
      await sec[owner].screenshot({ path: `${OUT}/1280-${name}-hover.png` });
      await page.mouse.move(0, 0);
    }
    const first = sec['nav-cards'].locator('a').first();
    await first.scrollIntoViewIfNeeded();
    await first.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(450);
    await sec['nav-cards'].screenshot({ path: `${OUT}/1280-nav-cards-focus.png` });
  }
  await ctx.close();
}
await browser.close();
console.log(`shots written to ${OUT}`);
