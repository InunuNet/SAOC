#!/usr/bin/env node
// A5 — the MobileMenu drawer traps focus while open: real Playwright keyboard input,
// not DOM-attribute presence. See contracts/golden/mobilemenu-focus-trap-f1/
// mobile-menu-spec.golden.md ("Focusable set" / "Behavior contract") for the exact
// contract this proves.
//
// TARGET: http://localhost:3002 — this repo's actual `pnpm dev` port (see
// package.json's "dev": "next dev --port 3002"). NOT 3333 — that default (used by
// other contracts' _shared.mjs for their own dev-server target) does not match this
// project's real dev workflow and already caused one broken check suite earlier in
// this project's history. Override with MMFT_CHECK_BASE_URL.

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
  await page.goto(`${BASE_URL}${PAGE_PATH}`, { waitUntil: 'networkidle' });

  const hamburger = page.getByRole('button', { name: 'Open menu' });
  await hamburger.waitFor({ state: 'visible', timeout: 15_000 });

  // (a) opening moves focus to the close button.
  await hamburger.click();
  await page.locator('[role="dialog"] [aria-label="Close menu"]').waitFor({ state: 'visible' });
  await page.waitForTimeout(100);

  const focusedOnOpen = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    label: document.activeElement?.getAttribute('aria-label'),
  }));
  check(
    focusedOnOpen.label === 'Close menu',
    'opening the drawer moves focus to the close button',
    `focused ${focusedOnOpen.tag} aria-label=${focusedOnOpen.label}`,
  );

  const insideDialog = async () =>
    page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
  const activeLabel = async () =>
    page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim() ?? document.activeElement?.tagName);

  // (b) a full Tab cycle never leaves the drawer, and wraps back to the close button.
  const focusableCount = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(dialog.querySelectorAll(selector)).filter((el) => el.offsetParent !== null).length;
  });
  check(focusableCount > 0, 'the drawer has at least one focusable element', `found ${focusableCount}`);

  let leftDialog = false;
  let sawSearchButton = false;
  let sawHeaderLink = false;
  for (let i = 0; i < focusableCount; i += 1) {
    await page.keyboard.press('Tab');
    if (!(await insideDialog())) leftDialog = true;
    const label = await activeLabel();
    if (label === 'Open search') sawSearchButton = true;
  }
  const sawHeaderNavLink = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('header nav[aria-label="Primary"]')),
  );
  sawHeaderLink = sawHeaderNavLink;

  check(!leftDialog, 'a full Tab cycle never lands on an element outside the drawer subtree');
  check(!sawSearchButton, 'the header search button is never focused while the drawer is open');
  check(!sawHeaderLink, 'a header primary-nav link is never focused while the drawer is open');

  const wrappedLabel = await activeLabel();
  check(
    wrappedLabel === 'Close menu',
    'Tab wraps from the last focusable element back to the close button',
    `landed on ${wrappedLabel}`,
  );

  // (c) Shift+Tab from the close button wraps to the last focusable element.
  await page.keyboard.press('Shift+Tab');
  const afterShiftTabInside = await insideDialog();
  const afterShiftTabLabel = await activeLabel();
  check(afterShiftTabInside, 'Shift+Tab from the close button stays inside the drawer');
  check(
    afterShiftTabLabel !== 'Close menu',
    'Shift+Tab from the close button wraps to the last focusable element (not itself)',
    `landed on ${afterShiftTabLabel}`,
  );

  // Tab forward again: from the wrapped-to last element this should land back on the
  // close button, confirming the forward wrap is consistent with the backward one.
  await page.keyboard.press('Tab');
  const backOnClose = await activeLabel();
  check(backOnClose === 'Close menu', 'Tab from the wrapped-to element returns to the close button');

  // (d) Escape closes the drawer and returns focus to the hamburger trigger.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const dialogGoneAfterEscape = (await page.locator('[role="dialog"]').count()) === 0;
  check(dialogGoneAfterEscape, 'Escape removes the drawer from the DOM');

  const focusedAfterEscape = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  check(
    focusedAfterEscape === 'Open menu',
    'Escape returns focus to the hamburger trigger button',
    `focus is on aria-label=${focusedAfterEscape}`,
  );

  // (e) background inert/aria-hidden while open, cleared after close.
  await hamburger.click();
  await page.locator('[role="dialog"]').waitFor({ state: 'visible' });
  await page.waitForTimeout(100);

  const bgStateWhileOpen = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return Array.from(document.body.children)
      .filter((el) => el !== dialog)
      .map((el) => ({
        tag: el.tagName,
        inert: el.hasAttribute('inert'),
        ariaHidden: el.getAttribute('aria-hidden') === 'true',
      }));
  });
  check(bgStateWhileOpen.length > 0, 'there is at least one background sibling to check', `found ${bgStateWhileOpen.length}`);
  const allHiddenWhileOpen = bgStateWhileOpen.every((el) => el.inert || el.ariaHidden);
  check(
    allHiddenWhileOpen,
    'every background sibling is inert or aria-hidden while the drawer is open',
    JSON.stringify(bgStateWhileOpen),
  );

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  const bgStateAfterClose = await page.evaluate(() =>
    Array.from(document.body.children).map((el) => ({
      tag: el.tagName,
      inert: el.hasAttribute('inert'),
      ariaHidden: el.getAttribute('aria-hidden') === 'true',
    })),
  );
  const noneHiddenAfterClose = bgStateAfterClose.every((el) => !el.inert && !el.ariaHidden);
  check(
    noneHiddenAfterClose,
    'no element retains inert/aria-hidden after the drawer closes',
    JSON.stringify(bgStateAfterClose),
  );

  await context.close();
} finally {
  await browser.close();
}

if (failures > 0) {
  console.error(`\ncheck-focus-trap: ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log('\ncheck-focus-trap: all assertions passed');
