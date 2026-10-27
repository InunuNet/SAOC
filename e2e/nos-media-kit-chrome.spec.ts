// =============================================================
// SAOC — e2e/nos-media-kit-chrome.spec.ts
// The NOS media kit is admin-gated, so an anonymous NOS visitor is redirected (same host) to the
// host-neutral /admin/login. That page takes the chrome of the host it is served on: NOS header and
// footer on the NOS host, the SAOC header and footer on the SAOC host. Asserts on the rendered DOM
// after the redirect, never a class name.
import { expect, test } from '@playwright/test';

import { nosBase } from './utils/site-urls';

const SAOC_CTA = 'Join a society';

test.describe('NOS media kit lands on sign-in inside NOS chrome', () => {
  // The clean NOS path; the /national-show/ spelling is canonicalised to this by the proxy using the
  // configured site origins, which the Playwright dev server does not set.
  test('/media-kit redirects to /admin/login with the NOS header and footer', async ({ page, baseURL }) => {
    await page.goto(`${nosBase(baseURL!)}/media-kit`);

    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.locator('header#nh')).toHaveCount(1);
    await expect(page.locator('footer#nf')).toHaveCount(1);
    await expect(page.getByText(SAOC_CTA)).toHaveCount(0);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Sign in' }).first()).toBeVisible();
  });
});

test.describe('SAOC sign-in keeps the SAOC chrome', () => {
  test('/admin/login on the SAOC host has the SAOC header and no NOS chrome', async ({ page }) => {
    await page.goto('/admin/login');

    await expect(page.getByText(SAOC_CTA).first()).toBeVisible();
    await expect(page.locator('header#nh')).toHaveCount(0);
    await expect(page.locator('footer#nf')).toHaveCount(0);
  });
});
