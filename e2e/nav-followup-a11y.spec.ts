// =============================================================
// SAOC — e2e/nav-followup-a11y.spec.ts
// Header follow-up (NOS Design ruling on PR #83): the call to action is never the current page,
// the active bar survives forced colours, the footer lockups and the societies search keep a
// visible keyboard focus indicator, and the skip-link target main takes no outline.
// Every assertion reads COMPUTED style on the real rendered DOM.
// =============================================================
import { expect, test, type Locator } from '@playwright/test';

import { NOS_TICKETS, cleanHref } from './utils/nos-nav-hrefs';
import { nosBase } from './utils/site-urls';

const DESKTOP = { width: 1440, height: 900 };
const FORCED_COLORS_ACTIVE = 'forced-colors: active';

/** True when the element draws a focus indicator: an outline or a box-shadow ring. */
async function hasFocusIndicator(el: Locator): Promise<boolean> {
  return el.evaluate((node) => {
    const s = getComputedStyle(node);
    const outlined = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
    return outlined || s.boxShadow !== 'none';
  });
}

test.describe('aria-current stays on navigation items', () => {
  test('SAOC: Join a society is not aria-current on /societies', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/societies');
    await expect(page.locator('header [data-hd="cta"]')).not.toHaveAttribute('aria-current', /.*/);
  });

  test('NOS: Tickets is not aria-current on the tickets page', async ({ page, baseURL }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(`${nosBase(baseURL!)}${cleanHref(NOS_TICKETS)}`);
    await expect(page.locator('header#nh [data-hd="cta"]')).not.toHaveAttribute(
      'aria-current',
      /.*/,
    );
  });
});

test.describe('forced colours keep the active and focus indicators', () => {
  test.use({ colorScheme: 'light', forcedColors: 'active' });

  test('SAOC: the current item and a focused item are underlined', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/about');
    expect(await page.evaluate((q) => matchMedia(`(${q})`).matches, FORCED_COLORS_ACTIVE)).toBe(
      true,
    );
    const current = page.locator('header [data-hd="item"][aria-current="page"]').first();
    await expect(current).toBeVisible();
    const decoration = await current.evaluate((node) => {
      const label = node.querySelector('span') ?? node;
      return getComputedStyle(label).textDecorationLine;
    });
    expect(decoration).toContain('underline');

    const cta = page.locator('header [data-hd="cta"]');
    expect(await cta.evaluate((n) => getComputedStyle(n).borderTopStyle)).not.toBe('none');
  });

  test('NOS: the active bar and the call to action draw in system colours', async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(`${nosBase(baseURL!)}/faq`);
    const bar = await page.evaluate(() => {
      const label = document.querySelector('header#nh [aria-current]:not(.nh-cta) .nh-label');
      if (!label) return null;
      const s = getComputedStyle(label, '::after');
      return { bg: s.backgroundColor, canvas: getComputedStyle(document.body).backgroundColor };
    });
    expect(bar, 'no current nav item on /faq').not.toBeNull();
    expect(bar!.bg).not.toBe(bar!.canvas);
    expect(bar!.bg).not.toBe('rgba(0, 0, 0, 0)');

    const cta = page.locator('header#nh [data-hd="cta"]');
    expect(await cta.evaluate((n) => getComputedStyle(n).borderTopStyle)).not.toBe('none');
  });
});

test.describe('focus indicators the audit named', () => {
  test('SAOC footer lockup shows a ring on keyboard focus', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/about');
    const link = page.locator('footer a[aria-label*="Orchid Council"]').first();
    await link.scrollIntoViewIfNeeded();
    await link.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    expect(await hasFocusIndicator(link)).toBe(true);
  });

  test('NOS footer lockups show their own ring, not the UA default', async ({ page, baseURL }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(`${nosBase(baseURL!)}/faq`);
    for (const sel of ['[data-testid="nf-saoc-lockup"]', 'footer .nf-lockup']) {
      const link = page.locator(sel).first();
      await link.scrollIntoViewIfNeeded();
      await link.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(link).toBeFocused();
      const outline = await link.evaluate((n) => {
        const s = getComputedStyle(n);
        return { width: s.outlineWidth, offset: s.outlineOffset };
      });
      expect(outline.width, `${sel} outline width`).toBe('2px');
      expect(outline.offset, `${sel} outline offset`).not.toBe('0px');
    }
  });

  test('the societies search shows a ring on its wrapper while the input is focused', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/societies');
    const input = page.locator('#societies-search');
    await input.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(input).toBeFocused();
    expect(await hasFocusIndicator(input.locator('xpath=..'))).toBe(true);
  });
});

test('the skip-link target main takes no focus outline', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/about');
  const outline = await page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return null;
    main.setAttribute('tabindex', '-1');
    main.focus();
    return getComputedStyle(main).outlineStyle;
  });
  expect(outline).toBe('none');
});
