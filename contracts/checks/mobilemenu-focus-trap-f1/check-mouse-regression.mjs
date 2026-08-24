#!/usr/bin/env node
// A6 — regression: mouse/tap-only interaction with the MobileMenu drawer still works
// exactly as before this feature. Same base-URL convention as check-focus-trap.mjs
// (this repo's real `pnpm dev` port is 3002, not the 3333 default used by unrelated
// contracts' _shared.mjs — see that file's comment for the prior incident).

import { chromium } from 'playwright';

const BASE_URL = process.env.MMFT_CHECK_BASE_URL ?? 'http://localhost:3002';
const PAGE_PATH = '/about';
const VIEWPORT = { width: 375, height: 812 };

let failures = 0;
function check(condition, description, detail) {
  if (condition) {
    console.log(`PASS: ${description}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${description}${detail ? ` — ${detail}` : ''}`);
  }
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  // --- open via hamburger click, close via the X button ---
  await page.goto(`${BASE_URL}${PAGE_PATH}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('[role="dialog"]').waitFor({ state: 'visible' });
  check(await page.locator('[role="dialog"]').isVisible(), 'clicking the hamburger opens the drawer');

  await page.getByRole('button', { name: 'Close menu' }).click();
  await page.waitForTimeout(150);
  check((await page.locator('[role="dialog"]').count()) === 0, 'clicking the X button closes the drawer');

  // --- open via hamburger click, close via backdrop click ---
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('[role="dialog"]').waitFor({ state: 'visible' });
  await page.mouse.click(5, 5); // corner of the backdrop, outside the aside panel
  await page.waitForTimeout(150);
  check((await page.locator('[role="dialog"]').count()) === 0, 'clicking the backdrop closes the drawer');

  // --- clicking a plain nav link navigates and closes the drawer ---
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('[role="dialog"]').waitFor({ state: 'visible' });
  const navLinks = page.locator('[role="dialog"] nav[aria-label="Mobile primary"] ul > li > a[href]');
  const navLinkCount = await navLinks.count();
  check(navLinkCount > 0, 'the drawer renders at least one plain nav link', `found ${navLinkCount}`);
  if (navLinkCount > 0) {
    const firstLink = navLinks.first();
    const href = await firstLink.getAttribute('href');
    await firstLink.click();
    await page.waitForURL((url) => url.pathname === href, { timeout: 10_000 }).catch(() => {});
    check(page.url().endsWith(href), `clicking a plain nav link navigates to ${href}`, `ended at ${page.url()}`);
    check((await page.locator('[role="dialog"]').count()) === 0, 'the drawer closes after a nav link click');
  }

  // --- the /contact link navigates and closes the drawer ---
  await page.goto(`${BASE_URL}${PAGE_PATH}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('[role="dialog"]').waitFor({ state: 'visible' });
  const contactLink = page.locator('[role="dialog"] a[href="/contact"]');
  check((await contactLink.count()) > 0, 'the drawer renders the /contact link');
  await contactLink.click();
  await page.waitForURL((url) => url.pathname === '/contact', { timeout: 10_000 }).catch(() => {});
  check(page.url().endsWith('/contact'), 'clicking the /contact link navigates to /contact', `ended at ${page.url()}`);
  check((await page.locator('[role="dialog"]').count()) === 0, 'the drawer closes after the /contact link click');

  // --- the mailto link fires (still present, still a real mailto href) ---
  await page.goto(`${BASE_URL}${PAGE_PATH}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('[role="dialog"]').waitFor({ state: 'visible' });
  const mailtoHref = await page.locator('[role="dialog"] a[href^="mailto:"]').getAttribute('href');
  check(mailtoHref === 'mailto:council@saoc.co.za', 'the mailto link is present with the correct address', `got ${mailtoHref}`);

  await context.close();
} finally {
  await browser.close();
}

if (failures > 0) {
  console.error(`\ncheck-mouse-regression: ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log('\ncheck-mouse-regression: all assertions passed');
