// launch-weekend F13: the SAOC main header carries no standalone "Tickets" CTA button (Brad, 2026-10-16:
// "Remove the random tickets button, it has no context on saoc site"), while Tickets stays reachable through the
// National Show menu and the NOS header is unchanged.
// Runtime check against BASE_URL (default http://localhost:3613), a production build started with
// SITE_PUBLIC_LAUNCH=true and the beta basic-auth vars empty. Exit 2 = server unreachable, 1 = finding.
//
//   node check-f13.mjs                  assert
//   node check-f13.mjs --shots <dir>    also save a 1280 screenshot of the SAOC header
import { mkdirSync } from 'node:fs';

import { chromium } from 'playwright';

const BASE = (process.env.BASE_URL || 'http://localhost:3613').replace(/\/$/, '');
const ROUTES = ['/', '/about', '/societies'];
const WIDTHS = [390, 1024, 1280, 1920];
const DESKTOP_NAV_MIN_WIDTH = 1240;
const TICKETS_HREF = '/national-show/tickets';
const VIEWPORT_HEIGHT = 900;
const FOOTER_PARAGRAPH = 'A national coordinating body for affiliated orchid societies';
const FOOTER_REG = /REG# 1978\/004040\/08\s+NPO 043-901/;

const shotsIdx = process.argv.indexOf('--shots');
const shotsDir = shotsIdx === -1 ? null : process.argv[shotsIdx + 1];

const problems = [];
const fail = (msg) => problems.push(msg);

async function openPage(browser, width, route) {
  const ctx = await browser.newContext({ viewport: { width, height: VIEWPORT_HEIGHT } });
  const page = await ctx.newPage();
  try {
    const res = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
    if (!res || res.status() >= 400) throw new Error(`HTTP ${res ? res.status() : 'none'}`);
  } catch (e) {
    console.error(`INFRA: cannot load ${BASE}${route} (${e.message})`);
    process.exit(2);
  }
  return { ctx, page };
}

const overflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

async function checkSaoc(browser, width, route) {
  const tag = `SAOC ${route} @${width}`;
  const { ctx, page } = await openPage(browser, width, route);
  const bar = page.locator('header').first();

  const visibleTickets = await bar
    .locator('a')
    .evaluateAll((els) =>
      els
        .filter((a) => a.getClientRects().length > 0 && getComputedStyle(a).visibility !== 'hidden')
        .filter((a) => a.textContent.replace(/\s+/g, ' ').trim() === 'Tickets')
        .map((a) => a.getAttribute('href')),
    );
  if (visibleTickets.length) fail(`${tag}: header shows a "Tickets" link/button (${visibleTickets})`);

  if ((await overflow(page)) > 0) fail(`${tag}: horizontal overflow`);

  const footer = (await page.locator('footer').last().innerText()).replace(/\s+/g, ' ');
  if (footer.includes(FOOTER_PARAGRAPH)) fail(`${tag}: footer still shows the brand paragraph`);
  if (!FOOTER_REG.test(footer)) fail(`${tag}: footer lacks the REG#/NPO line`);

  if (width >= DESKTOP_NAV_MIN_WIDTH) {
    await bar.locator('button[aria-haspopup="true"]', { hasText: 'National Show' }).click();
    const menu = page.locator('[role="menu"][aria-label="National Show"]');
    await menu.waitFor({ state: 'visible' });
    if (!(await menu.locator(`a[href="${TICKETS_HREF}"]`).first().isVisible())) {
      fail(`${tag}: National Show menu has no visible Tickets link`);
    }
  } else {
    await bar.getByRole('button', { name: 'Open menu' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /National Show/ }).click();
    const link = dialog.locator(`a[href="${TICKETS_HREF}"]`);
    if (!(await link.first().isVisible())) fail(`${tag}: mobile menu has no visible Tickets link`);
  }
  if ((await overflow(page)) > 0) fail(`${tag}: horizontal overflow with menu open`);

  if (shotsDir && width === 1280 && route === '/') {
    mkdirSync(shotsDir, { recursive: true });
    await ctx.close();
    const shot = await openPage(browser, width, route);
    await shot.page.screenshot({ path: `${shotsDir}/saoc-header-1280.png`, clip: { x: 0, y: 0, width, height: 140 } });
    await shot.ctx.close();
    return;
  }
  await ctx.close();
}

async function checkNos(browser, width) {
  const tag = `NOS /national-show @${width}`;
  const { ctx, page } = await openPage(browser, width, '/national-show');
  if (width >= DESKTOP_NAV_MIN_WIDTH) {
    const cta = page.locator('header#nh a.nh-cta');
    if ((await cta.count()) !== 1) fail(`${tag}: NOS header lost its Tickets CTA`);
    else if ((await cta.getAttribute('href')) !== TICKETS_HREF) fail(`${tag}: NOS CTA href changed`);
  } else if (!(await page.locator('header#nh').count())) {
    fail(`${tag}: NOS header missing`);
  }
  if ((await overflow(page)) > 0) fail(`${tag}: horizontal overflow`);
  await ctx.close();
}

const browser = await chromium.launch();
try {
  for (const width of WIDTHS) {
    for (const route of ROUTES) await checkSaoc(browser, width, route);
    await checkNos(browser, width);
    console.log(`checked @${width}`);
  }
} finally {
  await browser.close();
}

if (problems.length) {
  for (const p of problems) console.error(`FAIL: ${p}`);
  process.exit(1);
}
console.log('F13 OK');
