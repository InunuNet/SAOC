// e2e/no-horizontal-overflow-drawer-open.spec.ts
// Mission menu-system-layout4 M3/F11 -- extends
// no-horizontal-overflow.spec.ts's coverage to the state mission
// section 6 property 5 actually names: "390px drawer... no
// horizontal scroll" means no overflow WHILE THE DRAWER IS OPEN, not
// merely on the collapsed homepage. no-horizontal-overflow.spec.ts
// never opens the drawer before measuring (confirmed by reading its
// source) -- this file closes that gap.
import { expect, test } from '@playwright/test';

import { NOS_GROUPS } from './utils/nos-nav-hrefs';
import { nosBase } from './utils/site-urls';

const VIEWPORT_HEIGHT = 900;

async function measureOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

test.describe('no horizontal overflow -- drawer open', () => {
  test('no horizontal overflow at 390px with the mobile drawer open', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const { scrollWidth, clientWidth } = await measureOverflow(page);
    expect(
      scrollWidth,
      `drawer open at 390px: scrollWidth (${scrollWidth}) exceeds clientWidth (${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });

  // nos-site-split R3.3: on SAOC, National Show is a plain link to the NOS site (no disclosure).
  test('no horizontal overflow at 390px with the SAOC drawer open and its National Show link shown', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'National Show', exact: true })).toBeVisible();

    const { scrollWidth, clientWidth } = await measureOverflow(page);
    expect(
      scrollWidth,
      `SAOC drawer open at 390px: scrollWidth (${scrollWidth}) exceeds clientWidth (${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });

  test('no horizontal overflow at 390px with the NOS menu open and a group expanded', async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
    await page.goto(`${nosBase(baseURL!)}/`);
    await page.locator('#nh-burger').click();

    const trigger = page
      .getByRole('button', { name: NOS_GROUPS[0].heading, exact: true })
      .locator('visible=true')
      .first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const { scrollWidth, clientWidth } = await measureOverflow(page);
    expect(
      scrollWidth,
      `NOS menu + group expanded at 390px: scrollWidth (${scrollWidth}) exceeds clientWidth (${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });
});
