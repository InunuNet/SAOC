#!/usr/bin/env node
// Proves /tickets is reachable by clicking on a real mobile viewport (375px),
// not just present as a desktop-only link. At 375px the header's own zone-3
// CTA (see components/chrome/Header.tsx, "hidden sm:inline-block") is hidden
// entirely below the 640px "sm" breakpoint, and the primary nav is hidden
// below 1180px — the only surviving path to any nav destination on a phone
// is the hamburger -> MobileMenu overlay. This check opens that overlay and
// clicks through to /tickets, so a link that exists only in the desktop-width
// nav or the desktop-only CTA button cannot make this pass.
//
// Usage: node check-mobile-tickets-link.mjs [url]

import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:3333/about';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto(url, { waitUntil: 'networkidle' });

const menuButton = page.getByRole('button', { name: /open menu/i });
const menuButtonVisible = await menuButton.isVisible().catch(() => false);
if (!menuButtonVisible) {
  console.error('hamburger "Open menu" button not visible at 375px viewport');
  await browser.close();
  process.exit(2);
}
await menuButton.click();

const dialog = page.getByRole('dialog');
await dialog.waitFor({ state: 'visible', timeout: 5000 });

const ticketsLink = dialog.locator('a[href="/tickets"]');
const count = await ticketsLink.count();
if (count === 0) {
  console.error('no a[href="/tickets"] found inside the mobile menu dialog');
  await browser.close();
  process.exit(1);
}

const visible = await ticketsLink.first().isVisible();
if (!visible) {
  console.error('a[href="/tickets"] present in mobile menu but not visible');
  await browser.close();
  process.exit(1);
}

// Click through and confirm it actually navigates to a working /tickets page.
await ticketsLink.first().click();
await page.waitForURL('**/tickets', { timeout: 5000 });
const bodyText = await page.locator('body').innerText();
await browser.close();

if (!/tickets?/i.test(bodyText)) {
  console.error('navigated to /tickets but page body does not look like the tickets page');
  process.exit(1);
}

console.log('OK: /tickets reachable via mobile menu at 375px and navigation succeeded');
process.exit(0);
