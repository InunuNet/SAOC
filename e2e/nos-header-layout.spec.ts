// =============================================================
// SAOC — e2e/nos-header-layout.spec.ts
// Mission nos-site-split F3 (NOS Design R1.2, R1.3, R1.4). Replaces
// mega-menu-layout4-visual-fidelity.spec.ts, which measured the geometry of the SAOC site's old
// five-track National Show mega. The NOS header now has click-only disclosure list panels hung
// under their triggers and a menu panel below 1384px; this spec measures real layout on the
// rendered DOM (bounding boxes and computed style), never a class name.
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { NOS_GROUPS } from './utils/nos-nav-hrefs';
import { nosBase } from './utils/site-urls';

// NOS header: inline nav from 1384, lockup + CTA + Menu from 768 (H-a, NOS Design), lockup on its own row below.
const PANEL_BREAKPOINT = 1384;
const ROW_BREAKPOINT = 768;
const LOCKUP_FOOTPRINT_PX = 405;
const MIN_TARGET_PX = 44;
const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_WIDTH = 400;
const SLOP_PX = 1.5;
const FIRST_GROUP = NOS_GROUPS[0];

async function gotoNos(page: Page, baseURL: string, width: number, path = '/faq') {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${nosBase(baseURL)}${path}`);
}

test.describe('NOS header — desktop panels', () => {
  for (const width of [1440, PANEL_BREAKPOINT]) {
    test(`an opened panel hangs under its trigger and stays inside the viewport at ${width}px`, async ({
      page,
      baseURL,
    }) => {
      await gotoNos(page, baseURL!, width);

      for (const group of NOS_GROUPS) {
        const trigger = page.getByRole('button', { name: group.heading, exact: true });
        await trigger.click();
        const panel = page.locator(`#nh-panel-${group.id}`);
        await expect(panel).toBeVisible();

        const t = (await trigger.boundingBox())!;
        const p = (await panel.boundingBox())!;
        expect(p.y, `${group.heading} panel overlaps its trigger`).toBeGreaterThanOrEqual(t.y + t.height - SLOP_PX);
        expect(p.x, `${group.heading} panel starts left of the page`).toBeGreaterThanOrEqual(0);
        expect(p.x + p.width, `${group.heading} panel runs off the right edge`).toBeLessThanOrEqual(width);
        expect(p.width).toBeGreaterThanOrEqual(PANEL_MIN_WIDTH - SLOP_PX);
        expect(p.width).toBeLessThanOrEqual(PANEL_MAX_WIDTH + SLOP_PX);

        const style = await panel.evaluate((el) => {
          const s = getComputedStyle(el);
          return { shadow: s.boxShadow, border: s.borderTopWidth, position: s.position };
        });
        expect(style.shadow).not.toBe('none');
        expect(style.border).toBe('1px');
        expect(style.position).toBe('absolute');
        await trigger.click();
      }
    });
  }

  test('every top-row control is a 44px touch target', async ({ page, baseURL }) => {
    await gotoNos(page, baseURL!, 1440);

    const controls = page.locator('header#nh').locator('.nh-trigger, .nh-link, .nh-cta, .nh-brand');
    const count = await controls.count();
    expect(count).toBeGreaterThanOrEqual(NOS_GROUPS.length + 2);
    for (let i = 0; i < count; i++) {
      const box = (await controls.nth(i).boundingBox())!;
      expect(box.height, `control #${i} is shorter than ${MIN_TARGET_PX}px`).toBeGreaterThanOrEqual(
        MIN_TARGET_PX - SLOP_PX,
      );
    }
  });

  test('every link inside an opened panel is a 44px touch target', async ({ page, baseURL }) => {
    await gotoNos(page, baseURL!, 1440);

    await page.getByRole('button', { name: FIRST_GROUP.heading, exact: true }).click();
    const links = page.locator(`#nh-panel-${FIRST_GROUP.id} a`);
    const count = await links.count();
    expect(count).toBe(FIRST_GROUP.links.length);
    for (let i = 0; i < count; i++) {
      const box = (await links.nth(i).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(MIN_TARGET_PX - SLOP_PX);
    }
  });

  test('the bar does not wrap or collide with the lockup at the breakpoint', async ({
    page,
    baseURL,
  }) => {
    await gotoNos(page, baseURL!, PANEL_BREAKPOINT);

    const brand = (await page.locator('header#nh .nh-brand').boundingBox())!;
    const nav = (await page.locator('header#nh .nh-nav').boundingBox())!;
    const cta = (await page.locator('header#nh .nh-cta').boundingBox())!;
    expect(brand.x + brand.width, 'lockup runs into the nav').toBeLessThanOrEqual(nav.x + SLOP_PX);
    expect(nav.x + nav.width, 'nav runs into the Tickets button').toBeLessThanOrEqual(cta.x + SLOP_PX);

    const items = page.locator('header#nh .nh-nav > ul > li');
    const tops = new Set<number>();
    for (let i = 0; i < (await items.count()); i++) {
      tops.add(Math.round((await items.nth(i).boundingBox())!.y));
    }
    expect(tops.size, 'top-row items wrapped onto more than one line').toBe(1);
  });

  test('the full nav shows from the breakpoint and the Menu button below it', async ({
    page,
    baseURL,
  }) => {
    await gotoNos(page, baseURL!, PANEL_BREAKPOINT);
    await expect(page.locator('header#nh .nh-nav')).toBeVisible();
    await expect(page.locator('#nh-burger')).toBeHidden();

    await page.setViewportSize({ width: PANEL_BREAKPOINT - 1, height: 900 });
    await expect(page.locator('header#nh .nh-nav')).toBeHidden();
    await expect(page.locator('#nh-burger')).toBeVisible();
  });

  test('the lockup is the 405px footprint at the row breakpoint and fills a one-row bar there', async ({
    page,
    baseURL,
  }) => {
    await gotoNos(page, baseURL!, ROW_BREAKPOINT);

    const brand = (await page.locator('header#nh .nh-brand').boundingBox())!;
    const cta = (await page.locator('header#nh .nh-cta').boundingBox())!;
    const burger = (await page.locator('#nh-burger').boundingBox())!;
    expect(Math.abs(brand.width - LOCKUP_FOOTPRINT_PX)).toBeLessThanOrEqual(SLOP_PX);
    expect(cta.y, 'Tickets wrapped below the lockup').toBeLessThan(brand.y + brand.height);
    expect(burger.y, 'Menu wrapped below the lockup').toBeLessThan(brand.y + brand.height);
  });

  test('below the row breakpoint the lockup takes the first row and the actions sit below it', async ({
    page,
    baseURL,
  }) => {
    await gotoNos(page, baseURL!, ROW_BREAKPOINT - 1);

    const brand = (await page.locator('header#nh .nh-brand').boundingBox())!;
    const cta = (await page.locator('header#nh .nh-cta').boundingBox())!;
    expect(Math.abs(brand.width - LOCKUP_FOOTPRINT_PX)).toBeLessThanOrEqual(SLOP_PX);
    expect(cta.y, 'Tickets stayed beside the lockup').toBeGreaterThanOrEqual(brand.y + brand.height - SLOP_PX);
  });

  test('header type resolves to a real generic family, not a lucky substring', async ({
    page,
    baseURL,
  }) => {
    await gotoNos(page, baseURL!, 1440);

    const family = await page
      .getByRole('button', { name: FIRST_GROUP.heading, exact: true })
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toMatch(/(sans-serif|serif)\s*$/);
  });

  test('panels animate only when motion is allowed', async ({ page, baseURL }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoNos(page, baseURL!, 1440);

    await page.getByRole('button', { name: FIRST_GROUP.heading, exact: true }).click();
    const animation = await page
      .locator(`#nh-panel-${FIRST_GROUP.id}`)
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe('none');
  });
});

test.describe('NOS header — no horizontal scroll', () => {
  for (const width of [1440, PANEL_BREAKPOINT, PANEL_BREAKPOINT - 1, 1280, 1024, ROW_BREAKPOINT, ROW_BREAKPOINT - 1, 390, 320]) {
    test(`the NOS home does not scroll sideways at ${width}px`, async ({ page, baseURL }) => {
      await gotoNos(page, baseURL!, width, '/');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `page is ${overflow}px wider than the viewport`).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('NOS header — menu panel', () => {
  test('Menu opens the panel, Escape closes it and returns focus to the button', async ({
    page,
    baseURL,
  }) => {
    await gotoNos(page, baseURL!, 390, '/');

    const button = page.getByRole('button', { name: 'Menu', exact: true });
    await button.click();
    const panel = page.getByRole('navigation', { name: 'Main menu' });
    await expect(panel).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await page.keyboard.press('Escape');

    await expect(panel).toBeHidden();
    await expect(button).toBeFocused();
  });

  test('every panel row and its credit link is a 44px target', async ({ page, baseURL }) => {
    await gotoNos(page, baseURL!, 390, '/');

    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const rows = page.locator('#nd .nd-item, #nd .nd-credit a');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(NOS_GROUPS.length + 3);
    for (let i = 0; i < count; i++) {
      const box = (await rows.nth(i).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(MIN_TARGET_PX - SLOP_PX);
    }
  });

  test('opening the panel locks the page behind it and closing restores it', async ({
    page,
    baseURL,
  }) => {
    await gotoNos(page, baseURL!, 390, '/');

    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await expect(page.locator('main#main-content')).toHaveAttribute('inert', '');

    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
    await expect(page.locator('main#main-content')).not.toHaveAttribute('inert', '');
  });
});
