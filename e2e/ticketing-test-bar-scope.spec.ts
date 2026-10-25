// =============================================================
// NOS — e2e/ticketing-test-bar-scope.spec.ts
// The "Testing only, not live" bar belongs to the purchase and payment flows only: present on
// /tickets, absent on the information pages /workshops and /wosa-conference.
// =============================================================
import { expect, test } from '@playwright/test';

import { nosBase } from './utils/site-urls';

const BAR = '[data-ticketing-test-bar="true"]';

test.describe('ticketing test bar scope', () => {
  test('the bar is present on /tickets', async ({ page, baseURL }) => {
    const response = await page.goto(`${nosBase(baseURL!)}/tickets`);
    expect(response?.status()).toBe(200);
    await expect(page.locator(BAR)).toHaveCount(1);
  });

  for (const path of ['/workshops', '/wosa-conference']) {
    test(`the bar is absent on ${path}`, async ({ page, baseURL }) => {
      const response = await page.goto(`${nosBase(baseURL!)}${path}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator('header#nh')).toHaveCount(1);
      await expect(page.locator(BAR)).toHaveCount(0);
    });
  }
});
