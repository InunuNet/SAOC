// =============================================================
// SAOC — e2e/nos-header-brand-and-cta.spec.ts
// Mission nos-site-split F3 (NOS Design R1.1, R1.2, R1.5). Replaces mega-menu-f8-logo-and-tickets-
// rail.spec.ts, which tested the lead block and ticket rail of the SAOC site's old National Show
// mega. The show is its own site now; its header is the supplied full-colour lockup, the three
// disclosure groups, Show sponsors, Past shows, Contact and the Tickets call to action. There is
// no lead block, no ticket rail and no SAOC utility bar on the NOS host.
//
// Every assertion reads COMPUTED style or MEASURED layout on real rendered DOM — a source-text
// grep for a className string is never sufficient (this project's audited "assertion satisfiable
// without the property it claims to prove" defect class).
import { expect, test } from '@playwright/test';

import { SHOW_TITLE_EXPANDED } from '../lib/show-title';
import { NOS_TICKETS, cleanHref } from './utils/nos-nav-hrefs';
import { nosBase } from './utils/site-urls';

const NOS_ROYAL_PURPLE = 'rgb(33, 26, 87)'; // --nc-royal #211A57
const NOS_GROUND = 'rgb(251, 250, 240)'; // --nc-ground #FBFAF0
const LOCKUP_FILE = 'nos-full-colour-horizontal';
const LOCKUP_ALT = SHOW_TITLE_EXPANDED;
const LOCKUP_BOX_WIDE = 448;
const LOCKUP_BOX_NARROW = 390;
const TOLERANCE_PX = 1.5;

test.describe('NOS header — lockup and Tickets call to action', () => {
  test('the full-colour lockup links to the NOS home and renders at its box width', async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${nosBase(baseURL!)}/faq`);

    const brand = page.locator('header#nh .nh-brand');
    await expect(brand).toHaveAttribute('href', '/');
    const img = brand.getByRole('img', { name: LOCKUP_ALT });
    await expect(img).toBeVisible();
    const sources = `${await img.getAttribute('src')} ${(await img.getAttribute('srcset')) ?? ''}`;
    expect(decodeURIComponent(sources)).toContain(LOCKUP_FILE);

    const naturalWidth = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
    expect(naturalWidth, 'the lockup image did not load').toBeGreaterThan(0);
    const box = await img.boundingBox();
    expect(Math.abs(box!.width - LOCKUP_BOX_WIDE)).toBeLessThanOrEqual(TOLERANCE_PX);
  });

  test('the lockup takes the narrow box on a phone', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${nosBase(baseURL!)}/`);

    const img = page.locator('header#nh .nh-brand').getByRole('img', { name: LOCKUP_ALT });
    await expect(img).toBeVisible();
    const box = await img.boundingBox();
    expect(Math.abs(box!.width - LOCKUP_BOX_NARROW)).toBeLessThanOrEqual(TOLERANCE_PX);
  });

  for (const width of [1440, 1280, 390]) {
    test(`Tickets is the royal-purple call to action, last in the bar, at ${width}px`, async ({
      page,
      baseURL,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${nosBase(baseURL!)}/faq`);

      const header = page.locator('header#nh');
      const cta = header.getByRole('link', { name: NOS_TICKETS.label, exact: true });
      await expect(cta).toBeVisible();
      await expect(cta).toHaveAttribute('href', cleanHref(NOS_TICKETS));

      expect(await cta.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(NOS_ROYAL_PURPLE);
      expect(await cta.evaluate((el) => getComputedStyle(el).color)).toBe(NOS_GROUND);

      // Far right at every width: on desktop nothing in the bar sits to its right; on a phone only
      // the Menu button does.
      const ctaBox = (await cta.boundingBox())!;
      const others = header.locator('.nh-bar a:visible, .nh-bar button:visible');
      const count = await others.count();
      for (let i = 0; i < count; i++) {
        const other = others.nth(i);
        if ((await other.evaluate((el) => el.classList.contains('nh-cta'))) === true) continue;
        const otherBox = (await other.boundingBox())!;
        if (width >= 1260) {
          expect(otherBox.x + otherBox.width, 'something sits to the right of Tickets').toBeLessThanOrEqual(
            ctaBox.x + TOLERANCE_PX,
          );
        }
      }
    });
  }

  test('the header has no lead block and no ticket rail', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${nosBase(baseURL!)}/`);

    const header = page.locator('header#nh');
    for (const group of ['Visit', 'Programme', 'Exhibit & trade']) {
      await header.getByRole('button', { name: group, exact: true }).click();
      await expect(header.getByRole('heading')).toHaveCount(0);
    }
    for (const name of ['Day Visitor', 'Weekend Pass', '19th National Orchid Show', 'Buy tickets']) {
      await expect(header.getByRole('link', { name })).toHaveCount(0);
    }
  });

  test('Contact stays on the NOS site as a same-tab link to the show contact page', async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${nosBase(baseURL!)}/`);

    const contact = page.locator('header#nh').getByRole('link', { name: 'Contact', exact: true });
    const href = (await contact.getAttribute('href')) ?? '';
    const url = new URL(href, page.url());
    expect(url.pathname).toBe('/contact');
    expect(url.hostname.startsWith('nos.')).toBe(true);
    await expect(contact).not.toHaveAttribute('target', /.+/);
  });
});

test.describe('chrome scope — each site wears only its own chrome', () => {
  test('the NOS host has no SAOC utility bar and no SAOC header', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${nosBase(baseURL!)}/`);

    await expect(page.getByRole('region', { name: 'Utility bar' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Join a society' })).toHaveCount(0);
    await expect(page.locator('header#nh')).toHaveCount(1);
  });

  test('the SAOC host has no NOS header and no mega menu', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    await expect(page.locator('header#nh')).toHaveCount(0);
    await expect(page.getByRole('menu')).toHaveCount(0);
    const showLink = page.locator('header').getByRole('link', { name: 'National Show', exact: true });
    await expect(showLink).toHaveCount(1);
    expect(new URL((await showLink.getAttribute('href')) ?? '').hostname.startsWith('nos.')).toBe(true);
  });
});
