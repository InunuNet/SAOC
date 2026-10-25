// =============================================================
// NOS — e2e/ticketing-test-bar-scope.spec.ts
// The "Testing only, not live" bar belongs to the /tickets pages and the screen where a vendor
// payment is started: present there, absent on every listing, information and status page.
// =============================================================
import { expect, test } from '@playwright/test';

import { isTicketingSurfacePath } from '../lib/ticketing-test-mode';
import { nosBase } from './utils/site-urls';

const BAR = '[data-ticketing-test-bar="true"]';

const SHOWS_BAR = [
  '/tickets',
  '/tickets/',
  '/tickets/weekend-pass',
  '/tickets/weekend-pass/confirmation',
  '/national-show/tickets',
  '/national-show/tickets/weekend-pass',
  '/vendors/payment',
  '/national-show/vendors/payment',
];
const HIDES_BAR = [
  '/',
  '/conferences',
  '/workshops',
  '/wosa-conference',
  '/vsp',
  '/vendors/payment/status',
  '/national-show/conferences',
  '/national-show/workshops',
  '/national-show/wosa-conference',
  '/national-show/vendors/payment/status',
  '/ticketsfoo',
  '/faq',
];

test.describe('ticketing test bar scope', () => {
  test('path predicate shows the bar only on ticket pages and the payment start', () => {
    for (const path of SHOWS_BAR) expect(isTicketingSurfacePath(path), path).toBe(true);
    for (const path of HIDES_BAR) expect(isTicketingSurfacePath(path), path).toBe(false);
  });

  for (const path of ['/tickets', '/vendors/payment']) {
    test(`the bar is present on ${path}`, async ({ page, baseURL }) => {
      await page.goto(`${nosBase(baseURL!)}${path}`);
      await expect(page.locator(BAR)).toHaveCount(1);
    });
  }

  for (const path of ['/conferences', '/workshops', '/wosa-conference', '/vsp']) {
    test(`the bar is absent on ${path}`, async ({ page, baseURL }) => {
      const response = await page.goto(`${nosBase(baseURL!)}${path}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator('header#nh')).toHaveCount(1);
      await expect(page.locator(BAR)).toHaveCount(0);
    });
  }

  for (const path of ['/conferences', '/workshops']) {
    test(`the buy link on ${path} lands on a checkout that shows the bar`, async ({
      page,
      baseURL,
    }) => {
      await page.goto(`${nosBase(baseURL!)}${path}`);
      const buy = page.locator('a[href^="/tickets/"]').first();
      test.skip((await buy.count()) === 0, 'no sellable card rendered (no stock data in this env)');
      const href = await buy.getAttribute('href');
      await page.goto(`${nosBase(baseURL!)}${href}`);
      expect(new URL(page.url()).pathname.startsWith('/tickets/')).toBe(true);
      await expect(page.locator(BAR)).toHaveCount(1);
    });
  }
});
